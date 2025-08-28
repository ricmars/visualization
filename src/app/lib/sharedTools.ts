import { Pool } from "pg";
import { DB_TABLES } from "../types/database";
import { removeViewReferencesFromCaseModel } from "./modelUtils";
import { stepTypes } from "../utils/stepTypes";
import { fieldTypes, FieldType } from "../utils/fieldTypes";
import {
  LLMTool,
  SaveCaseParams,
  SaveFieldsParams,
  SaveViewParams,
  DeleteParams,
  ToolParams,
  ToolResult,
  CreateCaseParams,
} from "./toolTypes";

// Shared tool interface that works for both LLM and MCP
export interface SharedTool<TParams, TResult> {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, unknown>;
    required: string[];
  };
  execute: (params: TParams) => Promise<TResult>;
}

// Convert LLM tools to shared tools with MCP-compatible schemas
export function createSharedTools(pool: Pool): Array<SharedTool<any, any>> {
  const tools: SharedTool<any, any>[] = [
    {
      name: "createCase",
      description:
        "STEP 1: Creates a new case with only name and description. Returns the case ID that you MUST use for all subsequent operations (saveField, saveView). This is the FIRST tool to call when creating a new workflow.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Case name" },
          description: { type: "string", description: "Case description" },
        },
        required: ["name", "description"],
      },
      execute: async (params: CreateCaseParams) => {
        console.log("=== createCase EXECUTION STARTED ===");
        console.log("createCase parameters:", JSON.stringify(params, null, 2));
        console.log("createCase called at:", new Date().toISOString());

        const { name, description } = params;

        // Validation
        if (!name) throw new Error("Case name is required for createCase");
        if (!description)
          throw new Error("Case description is required for createCase");

        // Create new case with empty model
        const query = `
          INSERT INTO "${DB_TABLES.CASES}" (name, description, model)
          VALUES ($1, $2, $3)
          RETURNING id, name, description, model
        `;
        console.log("createCase INSERT query:", query);
        console.log("createCase INSERT query values:", [
          name,
          description,
          JSON.stringify({ stages: [] }),
        ]);

        const result = await pool.query(query, [
          name,
          description,
          JSON.stringify({ stages: [] }),
        ]);
        const caseData = result.rows[0] || {};

        console.log("createCase INSERT successful:", {
          id: caseData?.id,
          name: caseData?.name,
        });

        return {
          id: caseData.id,
          name: caseData.name,
          description: caseData.description,
          model:
            typeof caseData.model === "string"
              ? (() => {
                  try {
                    return JSON.parse(caseData.model);
                  } catch {
                    return { stages: [] };
                  }
                })()
              : caseData.model ?? { stages: [] },
        };
      },
    },
    {
      name: "saveCase",
      description:
        "Updates a case with the complete workflow model (stages, processes, steps, viewId references). Use ONLY for structural changes or finalizing new workflows. DO NOT call this for field-only edits (defaults, primary, required) or view tweaks—use saveFields/saveView instead.",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "integer",
            description:
              "Case ID (REQUIRED - use the ID returned from createCase)",
          },
          name: { type: "string", description: "Case name" },
          description: { type: "string", description: "Case description" },
          model: {
            type: "object",
            description:
              "Complete workflow model with stages, processes, steps, and viewId references",
            properties: {
              stages: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "integer", description: "Stage ID" },
                    name: { type: "string", description: "Stage name" },
                    order: { type: "integer", description: "Stage order" },
                    processes: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "integer", description: "Process ID" },
                          name: { type: "string", description: "Process name" },
                          order: {
                            type: "integer",
                            description: "Process order",
                          },
                          steps: {
                            type: "array",
                            items: {
                              type: "object",
                              properties: {
                                id: { type: "integer", description: "Step ID" },
                                type: {
                                  type: "string",
                                  enum: [...stepTypes],
                                  description:
                                    "Step type. Must be one of the allowed step types.",
                                },
                                name: {
                                  type: "string",
                                  description: "Step name",
                                },
                                order: {
                                  type: "integer",
                                  description: "Step order",
                                },
                                viewId: {
                                  type: "integer",
                                  description:
                                    "View ID for 'Collect information' steps (optional for other step types)",
                                },
                              },
                              required: ["id", "type", "name", "order"],
                            },
                            description: "Steps array",
                          },
                        },
                        required: ["id", "name", "order", "steps"],
                      },
                      description: "Processes array",
                    },
                  },
                  required: ["id", "name", "order", "processes"],
                },
                description: "Stages array with processes and steps",
              },
            },
            required: ["stages"],
          },
        },
        required: ["id", "name", "description", "model"],
      },
      execute: async (params: SaveCaseParams) => {
        console.log("=== saveCase EXECUTION STARTED ===");
        console.log("saveCase parameters:", JSON.stringify(params, null, 2));
        console.log("saveCase called at:", new Date().toISOString());

        const { id, name, description, model } = params;

        // Validation
        if (!id)
          throw new Error(
            "Case ID is required for saveCase - use the ID returned from createCase",
          );
        if (!name) throw new Error("Case name is required for saveCase");
        if (!description)
          throw new Error("Case description is required for saveCase");
        if (!model) throw new Error("Case model is required for saveCase");

        if (!Array.isArray(model.stages)) {
          throw new Error("Model stages must be an array");
        }

        // Validation: embedded fields arrays in steps are not allowed
        for (const stage of model.stages) {
          for (const process of stage.processes || []) {
            for (const step of process.steps || []) {
              if (step && (step as any).fields) {
                throw new Error(
                  `Step "${step.name}" contains a fields array. Fields should be stored in views, not in steps. Remove the fields array from the step.`,
                );
              }
            }
          }
        }

        // Validate collect_information steps have viewId (warning only)
        for (const stage of model.stages) {
          for (const process of stage.processes || []) {
            for (const step of process.steps || []) {
              if (step.type === "Collect information" && !step.viewId) {
                console.warn(
                  `Step "${step.name}" is a collect_information step but doesn't have a viewId. Add a viewId to reference the view containing the fields.`,
                );
              }
            }
          }
        }

        // Collect viewIds used by steps
        const referencedViewIds = new Set<number>();
        for (const stage of model.stages) {
          for (const process of stage.processes || []) {
            for (const step of process.steps || []) {
              if (typeof step.viewId === "number") {
                referencedViewIds.add(step.viewId);
              }
            }
          }
        }

        // Load existing views for this case and error on invalid references
        if (referencedViewIds.size > 0) {
          const checkIds = Array.from(referencedViewIds);
          const viewQuery = `SELECT id FROM "${DB_TABLES.VIEWS}" WHERE id = ANY($1) AND caseid = $2`;
          const viewResult = await pool.query(viewQuery, [checkIds, id]);
          const validViewIdsForCase = new Set<number>(
            viewResult.rows.map((row) => row.id),
          );

          const missing = checkIds.filter(
            (vid) => !validViewIdsForCase.has(vid),
          );
          if (missing.length > 0) {
            throw new Error(
              `The following viewId values do not exist in the database: ${missing.join(
                ", ",
              )}. Make sure to use the actual IDs returned from saveView calls.`,
            );
          }
        }

        // Allow reuse of the same viewId across steps; warn if repeated
        const seenViewIds = new Set<number>();
        for (const stage of model.stages) {
          for (const process of stage.processes || []) {
            for (const step of process.steps || []) {
              if (typeof step.viewId === "number") {
                if (seenViewIds.has(step.viewId)) {
                  console.warn(
                    `Duplicate viewId "${step.viewId}" found in steps – proceeding`,
                  );
                } else {
                  seenViewIds.add(step.viewId);
                }
              }
            }
          }
        }
        // Auto-assign missing IDs for new stages/processes/steps to reduce friction for the model
        // This allocator only assigns IDs where they are missing or non-integer. It never changes existing numeric IDs.
        const cleanedModel = { ...model } as typeof model;
        try {
          // Determine max IDs present to ensure uniqueness within the case model
          let maxStageId = 0;
          let maxProcessId = 0;
          let maxStepId = 0;
          for (const stage of cleanedModel.stages) {
            if (typeof (stage as any).id === "number") {
              maxStageId = Math.max(maxStageId, (stage as any).id);
            }
            for (const process of stage.processes || []) {
              if (typeof (process as any).id === "number") {
                maxProcessId = Math.max(maxProcessId, (process as any).id);
              }
              for (const step of process.steps || []) {
                if (typeof (step as any).id === "number") {
                  maxStepId = Math.max(maxStepId, (step as any).id);
                }
              }
            }
          }

          for (const stage of cleanedModel.stages) {
            if (typeof (stage as any).id !== "number") {
              (stage as any).id = ++maxStageId;
            }
            for (const process of stage.processes || []) {
              if (typeof (process as any).id !== "number") {
                (process as any).id = ++maxProcessId;
              }
              for (const step of process.steps || []) {
                if (typeof (step as any).id !== "number") {
                  (step as any).id = ++maxStepId;
                }
              }
            }
          }
        } catch (e) {
          console.warn(
            "saveCase: ID auto-assignment failed; proceeding with provided model.",
            e,
          );
        }

        // Update existing case
        const query = `
          UPDATE "${DB_TABLES.CASES}"
          SET name = $1, description = $2, model = $3
          WHERE id = $4
          RETURNING id, name, description, model
        `;
        console.log("saveCase UPDATE query:", query);
        const modelJson = JSON.stringify(cleanedModel);
        console.log("saveCase UPDATE query values:", [
          name,
          description,
          modelJson,
          id,
        ]);

        const result = await pool.query(query, [
          name,
          description,
          modelJson,
          id,
        ]);
        if (result.rowCount === 0) {
          console.error(`saveCase ERROR: No case found with id ${id}`);
          throw new Error(`No case found with id ${id}`);
        }

        const caseData = result.rows[0] || {};
        console.log("saveCase UPDATE successful:");
        console.log({
          id: caseData?.id,
          name: caseData?.name,
          modelStages: (() => {
            try {
              const m =
                typeof caseData?.model === "string"
                  ? JSON.parse(caseData.model)
                  : caseData?.model;
              return m?.stages?.length || 0;
            } catch {
              return 0;
            }
          })(),
        });

        return {
          id: caseData.id ?? id,
          name: caseData.name ?? name,
          description: caseData.description ?? description,
          model:
            typeof caseData.model === "string"
              ? (() => {
                  try {
                    return JSON.parse(caseData.model);
                  } catch {
                    return cleanedModel ?? null;
                  }
                })()
              : caseData.model ?? cleanedModel ?? null,
        };
      },
    },
    {
      name: "saveFields",
      description:
        "Creates or updates one or more fields for a case. Use this tool for ALL field-level changes (sampleValue, primary, required, label, order, options, type). PERFORMANCE: Batch changes in a single call whenever possible (25–50 fields per call is ideal). REQUIRED PER FIELD: name, type, caseid, label, sampleValue. If you only need to toggle boolean flags like primary/required, you STILL MUST provide type, label, and sampleValue for each field (fetch them once via listFields if not in context). NEVER call saveView or saveCase after field-only changes; those are unrelated. Views define layout/membership; saveCase updates workflow structure (stages/processes/steps).",
      parameters: {
        type: "object",
        properties: {
          fields: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: {
                  type: "integer",
                  description:
                    "Field ID (required for update, omit for create)",
                },
                name: { type: "string", description: "Field name" },
                type: {
                  type: "string",
                  enum: [...fieldTypes],
                  description:
                    "Field type (REQUIRED). Must be one of the allowed field types. Always include this even when only changing primary/required.",
                },
                caseid: {
                  type: "integer",
                  description: "Case ID this field belongs to (REQUIRED)",
                },
                label: {
                  type: "string",
                  description:
                    "Display label for the field (REQUIRED; use existing value if updating)",
                },
                description: {
                  type: "string",
                  description: "Field description",
                },
                order: { type: "integer", description: "Display order" },
                options: {
                  type: "array",
                  items: { type: "string" },
                  description: "Array of options for dropdown/radio fields",
                },
                required: {
                  type: "boolean",
                  description: "Whether the field is required",
                },
                primary: {
                  type: "boolean",
                  description: "Whether this is a primary field",
                },
                sampleValue: {
                  type: "string",
                  description:
                    "Sample value for live preview (REQUIRED; reuse existing value if updating).",
                },
              },
              required: ["name", "type", "caseid", "label", "sampleValue"],
            },
            description: "Array of fields to create or update",
          },
        },
        required: ["fields"],
      },
      execute: async (params: SaveFieldsParams) => {
        console.log("=== saveFields EXECUTION STARTED ===");
        console.log("saveFields parameters:", JSON.stringify(params, null, 2));
        console.log("saveFields called at:", new Date().toISOString());

        const { fields } = params;

        // Validation
        if (!Array.isArray(fields) || fields.length === 0) {
          throw new Error(
            "Fields array is required and must not be empty for saveFields",
          );
        }

        const results: Array<{
          id: number;
          name: string;
          type: string;
          caseid: number;
          label: string;
          description: string;
          order: number;
          options: unknown;
          required: boolean;
          primary: boolean;
          sampleValue?: unknown;
        }> = [];

        // Process each field
        for (const field of fields) {
          const {
            id,
            name,
            type,
            caseid,
            label,
            description,
            order,
            options,
            required,
            primary,
            sampleValue,
          } = field;

          // Validation
          if (!name) throw new Error("Field name is required for saveFields");
          if (!type) throw new Error("Field type is required for saveFields");
          if (!caseid) throw new Error("Case ID is required for saveFields");
          if (!label) throw new Error("Field label is required for saveFields");

          // Validate field type first so tests expecting this error pass even if sampleValue is missing
          if (!fieldTypes.includes(type as FieldType)) {
            throw new Error(`Invalid field type "${type}"`);
          }

          if (sampleValue === undefined) {
            throw new Error("sampleValue is required for saveFields");
          }

          // Check for existing field with same name in the same case
          const existingFieldQuery = `SELECT id FROM "${DB_TABLES.FIELDS}" WHERE name = $1 AND caseid = $2`;
          const existingFieldResult = await pool.query(existingFieldQuery, [
            name,
            caseid,
          ]);

          if (
            existingFieldResult.rowCount &&
            existingFieldResult.rowCount > 0
          ) {
            // Update the existing field (matched by name + case) to persist incoming changes like sampleValue
            const existingFieldId = existingFieldResult.rows[0].id;
            const fullFieldQuery = `SELECT * FROM "${DB_TABLES.FIELDS}" WHERE id = $1`;
            const fullFieldResult = await pool.query(fullFieldQuery, [
              existingFieldId,
            ]);
            const existingRow =
              fullFieldResult && fullFieldResult.rows && fullFieldResult.rows[0]
                ? fullFieldResult.rows[0]
                : {};

            const nextLabel = label ?? existingRow.label ?? name;
            const nextDescription =
              description ?? existingRow.description ?? "";
            const nextOrder = order ?? existingRow.order ?? 0;
            const nextRequired =
              required ?? (existingRow.required as boolean) ?? false;
            const nextPrimary =
              primary ?? (existingRow.primary as boolean) ?? false;
            const normalizedOptions = Array.isArray(options)
              ? JSON.stringify(options)
              : options ??
                (typeof existingRow.options === "string"
                  ? existingRow.options
                  : JSON.stringify(existingRow.options ?? []));
            const normalizedSampleValue =
              sampleValue === undefined ||
              sampleValue === null ||
              sampleValue === ""
                ? existingRow.sampleValue ?? null
                : typeof sampleValue === "string"
                ? sampleValue
                : JSON.stringify(sampleValue);

            const updateExistingQuery = `
              UPDATE "${DB_TABLES.FIELDS}"
              SET name = $1, type = $2, caseid = $3, label = $4, description = $5, "order" = $6, options = $7, required = $8, "primary" = $9, "sampleValue" = $10
              WHERE id = $11
              RETURNING id, name, type, caseid, label, description, "order", options, required, "primary", "sampleValue"
            `;
            const updateExistingValues = [
              name,
              type,
              caseid,
              nextLabel,
              nextDescription,
              nextOrder,
              normalizedOptions,
              nextRequired,
              nextPrimary,
              normalizedSampleValue,
              existingFieldId,
            ];
            console.log(
              "saveFields UPDATE (by name) query values:",
              updateExistingValues,
            );
            const updated = await pool.query(
              updateExistingQuery,
              updateExistingValues,
            );
            const fieldData = updated.rows[0] || {};

            {
              const returnedSample = fieldData.sampleValue ?? null;
              const resultItem: any = {
                id: fieldData.id ?? existingFieldId,
                name: fieldData.name ?? name,
                type: fieldData.type ?? type,
                caseid: fieldData.caseid ?? caseid,
                label: fieldData.label ?? nextLabel,
                description: fieldData.description ?? nextDescription,
                order: fieldData.order ?? nextOrder,
                options: fieldData.options
                  ? Array.isArray(fieldData.options)
                    ? fieldData.options
                    : (() => {
                        try {
                          return JSON.parse(fieldData.options);
                        } catch {
                          return [];
                        }
                      })()
                  : (() => {
                      try {
                        return JSON.parse(normalizedOptions);
                      } catch {
                        return [];
                      }
                    })(),
                required: fieldData.required ?? nextRequired,
                primary: fieldData.primary ?? nextPrimary,
              };
              if (returnedSample !== null && returnedSample !== "") {
                resultItem.sampleValue = returnedSample;
              }
              results.push(resultItem);
            }
            continue;
          }

          if (id) {
            // Update existing field
            const query = `
              UPDATE "${DB_TABLES.FIELDS}"
              SET name = $1, type = $2, caseid = $3, label = $4, description = $5, "order" = $6, options = $7, required = $8, "primary" = $9, "sampleValue" = $10
              WHERE id = $11
              RETURNING id, name, type, caseid, label, description, "order", options, required, "primary", "sampleValue"
            `;
            console.log("saveFields UPDATE query:", query);
            // Normalize options & sampleValue for DB storage
            const normalizedOptions = Array.isArray(options)
              ? JSON.stringify(options)
              : options ?? "[]";
            const normalizedSampleValue =
              sampleValue === undefined ||
              sampleValue === null ||
              sampleValue === ""
                ? null
                : typeof sampleValue === "string"
                ? sampleValue
                : JSON.stringify(sampleValue);
            console.log("saveFields UPDATE query values:", [
              name,
              type,
              caseid,
              label,
              description ?? "",
              order ?? 0,
              normalizedOptions,
              required ?? false,
              primary ?? false,
              normalizedSampleValue,
              id,
            ]);

            const result = await pool.query(query, [
              name,
              type,
              caseid,
              label,
              description ?? "",
              order ?? 0,
              normalizedOptions,
              required ?? false,
              primary ?? false,
              normalizedSampleValue,
              id,
            ]);
            if (result.rowCount === 0) {
              console.error(`saveFields ERROR: No field found with id ${id}`);
              throw new Error(`No field found with id ${id}`);
            }

            const fieldData = result.rows[0] || {};
            console.log("saveFields UPDATE successful:", {
              id: fieldData?.id,
              name: fieldData?.name,
              type: fieldData?.type,
              caseid: fieldData?.caseid ?? fieldData?.caseid,
            });

            {
              const returnedSample = fieldData.sampleValue ?? null;
              const resultItem: any = {
                id: fieldData.id ?? id,
                name: fieldData.name ?? name,
                type: fieldData.type ?? type,
                caseid: fieldData.caseid ?? fieldData.caseid ?? caseid,
                label: fieldData.label ?? label,
                description: fieldData.description ?? description ?? "",
                order: fieldData.order ?? order ?? 0,
                options: fieldData.options
                  ? Array.isArray(fieldData.options)
                    ? fieldData.options
                    : (() => {
                        try {
                          return JSON.parse(fieldData.options);
                        } catch {
                          return [];
                        }
                      })()
                  : Array.isArray(options)
                  ? options
                  : [],
                required: fieldData.required ?? required ?? false,
                primary: fieldData.primary ?? primary ?? false,
              };
              if (returnedSample !== null && returnedSample !== "") {
                resultItem.sampleValue = returnedSample;
              }
              results.push(resultItem);
            }
          } else {
            // Create new field
            const query = `
              INSERT INTO "${DB_TABLES.FIELDS}" (name, type, caseid, label, description, "order", options, required, "primary", "sampleValue")
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
              RETURNING id, name, type, caseid, label, description, "order", options, required, "primary", "sampleValue"
            `;
            console.log("saveFields INSERT query:", query);
            const normalizedOptions = Array.isArray(options)
              ? JSON.stringify(options)
              : options ?? "[]";
            const normalizedSampleValue =
              sampleValue === undefined ||
              sampleValue === null ||
              sampleValue === ""
                ? null
                : typeof sampleValue === "string"
                ? sampleValue
                : JSON.stringify(sampleValue);
            console.log("saveFields INSERT query values:", [
              name,
              type,
              caseid,
              label,
              description ?? "",
              order ?? 0,
              normalizedOptions,
              required ?? false,
              primary ?? false,
              normalizedSampleValue,
            ]);

            const result = await pool.query(query, [
              name,
              type,
              caseid,
              label,
              description ?? "",
              order ?? 0,
              normalizedOptions,
              required ?? false,
              primary ?? false,
              normalizedSampleValue,
            ]);
            const fieldData = result.rows[0] || {};

            console.log("saveFields INSERT successful:", {
              id: fieldData?.id,
              name: fieldData?.name,
              type: fieldData?.type,
              caseid: fieldData?.caseid ?? fieldData?.caseid,
            });

            {
              const returnedSample = fieldData.sampleValue ?? null;
              const resultItem: any = {
                id: fieldData.id ?? id,
                name: fieldData.name ?? name,
                type: fieldData.type ?? type,
                caseid: fieldData.caseid ?? fieldData.caseid ?? caseid,
                label: fieldData.label ?? label,
                description: fieldData.description ?? description ?? "",
                order: fieldData.order ?? order ?? 0,
                options: fieldData.options
                  ? Array.isArray(fieldData.options)
                    ? fieldData.options
                    : (() => {
                        try {
                          return JSON.parse(fieldData.options);
                        } catch {
                          return [];
                        }
                      })()
                  : Array.isArray(options)
                  ? options
                  : [],
                required: fieldData.required ?? required ?? false,
                primary: fieldData.primary ?? primary ?? false,
              };
              if (returnedSample !== null && returnedSample !== "") {
                resultItem.sampleValue = returnedSample;
              }
              results.push(resultItem);
            }
          }
        }

        console.log("saveFields completed successfully:", {
          totalFields: results.length,
          fieldIds: results.map((f) => f.id),
        });

        return {
          ids: results.map((f) => f.id),
          fields: results,
        };
      },
    },
    {
      name: "saveView",
      description:
        "Creates or updates a view (layout and which existing fields appear). Use ONLY when you are creating or modifying the composition/layout of a view. Do NOT use for setting field defaults/primary/required—use saveFields for those. Save the returned view ID to reference in the workflow model.",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "integer",
            description: "View ID (required for update, omit for create)",
          },
          name: { type: "string", description: "View name" },
          caseid: {
            type: "integer",
            description: "Case ID this view belongs to",
          },
          model: {
            type: "object",
            description: "View model with fields and layout",
            properties: {
              fields: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    fieldId: {
                      type: "integer",
                      description: "Field ID reference",
                    },
                    required: {
                      type: "boolean",
                      description: "Whether the field is required in this view",
                    },
                    order: {
                      type: "integer",
                      description: "Display order of the field in this view",
                    },
                  },
                  required: ["fieldId"],
                },
                description: "Array of field references for this view",
              },
              layout: {
                type: "object",
                description: "Layout configuration for the view",
                properties: {
                  type: {
                    type: "string",
                    description:
                      "Layout type (e.g., 'single-column', 'two-column', 'grid')",
                  },
                  columns: {
                    type: "integer",
                    description: "Number of columns for grid layout",
                  },
                },
                required: ["type"],
              },
            },
            required: ["fields", "layout"],
          },
        },
        required: ["name", "caseid", "model"],
      },
      execute: async (params: SaveViewParams) => {
        console.log("=== saveView EXECUTION STARTED ===");
        console.log("saveView parameters:", JSON.stringify(params, null, 2));
        console.log("saveView called at:", new Date().toISOString());

        const { id, name, caseid, model } = params;

        // Validation
        if (!name) throw new Error("View name is required for saveView");
        if (!caseid) throw new Error("Case ID is required for saveView");
        if (!model) throw new Error("View model is required for saveView");

        // Validate and auto-clean referenced fieldIds for this case BEFORE writing
        if (model && Array.isArray(model.fields) && model.fields.length > 0) {
          const fieldIds = model.fields.map((f) => f.fieldId);
          const fieldQuery = `SELECT id, type FROM "${DB_TABLES.FIELDS}" WHERE id = ANY($1) AND caseid = $2`;
          const fieldResult = await pool.query(fieldQuery, [fieldIds, caseid]);
          const existingFieldIds = new Set(
            fieldResult.rows.map((row) => row.id),
          );
          const missingFieldIds = fieldIds.filter(
            (fid) => !existingFieldIds.has(fid),
          );
          if (missingFieldIds.length > 0) {
            console.warn(
              `saveView: Removing missing field references from view model for case ${caseid}: ${missingFieldIds.join(
                ", ",
              )}`,
            );
            model.fields = model.fields.filter((f) =>
              existingFieldIds.has(f.fieldId),
            );
          }
          // Validate field types are recognized
          for (const row of fieldResult.rows) {
            if (!fieldTypes.includes(row.type)) {
              throw new Error(
                `Field ID ${row.id} has invalid type: ${row.type}`,
              );
            }
          }
        }

        // Soft check: warn if model.fields is empty; only "Collect information" steps should require fields
        if (
          !model ||
          !Array.isArray(model.fields) ||
          model.fields.length === 0
        ) {
          console.warn(
            "saveView: model.fields is empty; acceptable for non-collect steps. For 'Collect information' steps, ensure fields are added and linked via viewId.",
          );
        }

        if (id) {
          // Update existing view
          const query = `
            UPDATE "${DB_TABLES.VIEWS}"
            SET name = $1, caseid = $2, model = $3
            WHERE id = $4
            RETURNING id, name, caseid, model
          `;
          console.log("saveView UPDATE query:", query);
          const modelJson = JSON.stringify(model);
          console.log("saveView UPDATE query values:", [
            name,
            caseid,
            modelJson,
            id,
          ]);

          const result = await pool.query(query, [name, caseid, modelJson, id]);
          if (result.rowCount === 0) {
            console.error(`saveView ERROR: No view found with id ${id}`);
            throw new Error(`No view found with id ${id}`);
          }

          const viewData = result.rows[0];
          console.log("saveView UPDATE successful:");
          console.log({
            id: viewData?.id,
            name: viewData?.name,
            caseid: viewData?.caseid ?? viewData?.caseid,
            modelFields: (() => {
              try {
                const m =
                  typeof viewData?.model === "string"
                    ? JSON.parse(viewData.model)
                    : viewData?.model;
                return m?.fields?.length || 0;
              } catch {
                return 0;
              }
            })(),
          });

          return {
            id: viewData?.id,
            name: viewData?.name,
            caseid: viewData?.caseid ?? viewData?.caseid,
            model:
              typeof viewData?.model === "string"
                ? JSON.parse(viewData.model)
                : viewData?.model ?? null,
          };
        } else {
          // Create new view
          const query = `
            INSERT INTO "${DB_TABLES.VIEWS}" (name, caseid, model)
            VALUES ($1, $2, $3)
            RETURNING id, name, caseid, model
          `;
          console.log("saveView INSERT query:", query);
          const modelJson = JSON.stringify(model);
          console.log("saveView INSERT query values:", [
            name,
            caseid,
            modelJson,
          ]);

          const result = await pool.query(query, [name, caseid, modelJson]);
          const viewData = result.rows[0];

          console.log("saveView INSERT successful:");
          console.log({
            id: viewData?.id,
            name: viewData?.name,
            caseid: viewData?.caseid ?? viewData?.caseid,
            modelFields: (() => {
              try {
                const m =
                  typeof viewData?.model === "string"
                    ? JSON.parse(viewData.model)
                    : viewData?.model;
                return m?.fields?.length || 0;
              } catch {
                return 0;
              }
            })(),
          });

          return {
            id: viewData?.id,
            name: viewData?.name,
            caseid: viewData?.caseid ?? viewData?.caseid,
            model:
              typeof viewData?.model === "string"
                ? JSON.parse(viewData.model)
                : viewData?.model ?? null,
          };
        }
      },
    },
    {
      name: "deleteCase",
      description:
        "Permanently deletes a case and all its associated fields and views. This action is NOT recoverable. Use ONLY when the user explicitly requests deletion. If there is any ambiguity, ask the user to confirm before proceeding.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "integer", description: "Case ID to delete" },
        },
        required: ["id"],
      },
      execute: async (params: DeleteParams) => {
        console.log("=== deleteCase EXECUTION STARTED ===");
        console.log("deleteCase parameters:", JSON.stringify(params, null, 2));
        console.log("deleteCase called at:", new Date().toISOString());

        const { id } = params;

        // Delete associated fields first
        const deleteFieldsQuery = `DELETE FROM "${DB_TABLES.FIELDS}" WHERE caseid = $1`;
        console.log("deleteCase deleteFields query:", deleteFieldsQuery);
        console.log("deleteCase deleteFields query values:", [id]);
        await pool.query(deleteFieldsQuery, [id]);

        // Delete associated views
        const deleteViewsQuery = `DELETE FROM "${DB_TABLES.VIEWS}" WHERE caseid = $1`;
        console.log("deleteCase deleteViews query:", deleteViewsQuery);
        console.log("deleteCase deleteViews query values:", [id]);
        await pool.query(deleteViewsQuery, [id]);

        // Delete the case
        const deleteCaseQuery = `DELETE FROM "${DB_TABLES.CASES}" WHERE id = $1`;
        console.log("deleteCase deleteCase query:", deleteCaseQuery);
        console.log("deleteCase deleteCase query values:", [id]);
        const result = await pool.query(deleteCaseQuery, [id]);

        if (result.rowCount === 0) {
          console.error(`deleteCase ERROR: No case found with id ${id}`);
          throw new Error(`No case found with id ${id}`);
        }

        console.log("deleteCase successful:", { id });
        return { success: true, deletedId: id };
      },
    },
    {
      name: "deleteField",
      description:
        "Permanently deletes a field and removes it from all views where it's used. This action is NOT recoverable. Use ONLY when the user explicitly requests deletion. If not sure, ask the user to confirm before proceeding.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "integer", description: "Field ID to delete" },
        },
        required: ["id"],
      },
      execute: async (params: DeleteParams) => {
        console.log("=== deleteField EXECUTION STARTED ===");
        console.log("deleteField parameters:", JSON.stringify(params, null, 2));
        console.log("deleteField called at:", new Date().toISOString());

        const { id } = params;

        // First, get the field name and caseid before deleting
        const getFieldQuery = `SELECT name, caseid FROM "${DB_TABLES.FIELDS}" WHERE id = $1`;
        const getFieldResult = await pool.query(getFieldQuery, [id]);
        if (getFieldResult.rowCount === 0) {
          console.error(`deleteField ERROR: No field found with id ${id}`);
          throw new Error(`No field found with id ${id}`);
        }
        const fieldName = getFieldResult.rows[0].name;
        const caseid = getFieldResult.rows[0].caseid;

        // Find all views that use this field and remove the field from them
        const getViewsQuery = `SELECT id, name, model FROM "${DB_TABLES.VIEWS}" WHERE caseid = $1`;
        const viewsResult = await pool.query(getViewsQuery, [caseid]);

        let updatedViewsCount = 0;
        for (const view of viewsResult.rows) {
          try {
            const viewModel =
              typeof view.model === "string"
                ? JSON.parse(view.model)
                : view.model;
            if (viewModel.fields && Array.isArray(viewModel.fields)) {
              // Remove the field from the view's fields array
              const originalFieldCount = viewModel.fields.length;
              viewModel.fields = viewModel.fields.filter(
                (fieldRef: { fieldId: number }) => fieldRef.fieldId !== id,
              );

              // Only update if the field was actually removed
              if (viewModel.fields.length < originalFieldCount) {
                const updateViewQuery = `UPDATE "${DB_TABLES.VIEWS}" SET model = $1 WHERE id = $2`;
                await pool.query(updateViewQuery, [
                  JSON.stringify(viewModel),
                  view.id,
                ]);
                updatedViewsCount++;
                console.log(
                  `Removed field ${id} from view ${view.name} (ID: ${view.id})`,
                );
              }
            }
          } catch (error) {
            console.error(`Error processing view ${view.name}:`, error);
          }
        }

        // Now delete the field from the fields table
        const deleteFieldQuery = `DELETE FROM "${DB_TABLES.FIELDS}" WHERE id = $1`;
        console.log("deleteField query:", deleteFieldQuery);
        console.log("deleteField query values:", [id]);

        const result = await pool.query(deleteFieldQuery, [id]);
        if (result.rowCount === 0) {
          console.error(`deleteField ERROR: No field found with id ${id}`);
          throw new Error(`No field found with id ${id}`);
        }

        console.log("deleteField successful:", {
          id,
          name: fieldName,
          updatedViewsCount,
          caseid,
        });
        return {
          success: true,
          deletedId: id,
          deletedName: fieldName,
          type: "field",
          updatedViewsCount,
        };
      },
    },
    {
      name: "deleteView",
      description:
        "Permanently deletes a view and removes any references to it (viewId) from the parent case's workflow model. This action is NOT recoverable. Use ONLY when the user explicitly requests deletion. If there is any ambiguity, ask the user to confirm before proceeding.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "integer", description: "View ID to delete" },
        },
        required: ["id"],
      },
      execute: async (params: DeleteParams) => {
        console.log("=== deleteView EXECUTION STARTED ===");
        console.log("deleteView parameters:", JSON.stringify(params, null, 2));
        console.log("deleteView called at:", new Date().toISOString());

        const { id } = params;

        // First, get the view name and parent case before deleting
        const getViewQuery = `SELECT name, caseid FROM "${DB_TABLES.VIEWS}" WHERE id = $1`;
        const getViewResult = await pool.query(getViewQuery, [id]);
        if (getViewResult.rowCount === 0) {
          console.error(`deleteView ERROR: No view found with id ${id}`);
          throw new Error(`No view found with id ${id}`);
        }
        const viewName = getViewResult.rows[0].name;
        const parentCaseId = getViewResult.rows[0].caseid as number;

        // Attempt to clear references to this view from the parent case model
        let updatedStepsCount = 0;
        if (parentCaseId) {
          try {
            const getCaseQuery = `SELECT id, model FROM "${DB_TABLES.CASES}" WHERE id = $1`;
            const caseResult = await pool.query(getCaseQuery, [parentCaseId]);
            if ((caseResult.rowCount ?? 0) > 0) {
              const caseRow = caseResult.rows[0];
              let model: any = {};
              try {
                model =
                  typeof caseRow.model === "string"
                    ? JSON.parse(caseRow.model)
                    : caseRow.model || {};
              } catch (e) {
                console.warn(
                  `deleteView: Failed to parse case model for case ${parentCaseId}; proceeding without model cleanup`,
                  e,
                );
                model = {};
              }

              if (model && Array.isArray(model.stages)) {
                const cleanup = removeViewReferencesFromCaseModel(model, id);
                updatedStepsCount = cleanup.updatedStepsCount;
                if (updatedStepsCount > 0) {
                  const updateCaseQuery = `UPDATE "${DB_TABLES.CASES}" SET model = $1 WHERE id = $2`;
                  await pool.query(updateCaseQuery, [
                    JSON.stringify(cleanup.model),
                    parentCaseId,
                  ]);
                }
              }
            }
          } catch (e) {
            console.warn(
              `deleteView: Non-fatal error while updating case model for case ${parentCaseId}:`,
              e,
            );
          }
        }

        const query = `DELETE FROM "${DB_TABLES.VIEWS}" WHERE id = $1`;
        console.log("deleteView query:", query);
        console.log("deleteView query values:", [id]);

        const result = await pool.query(query, [id]);
        if (result.rowCount === 0) {
          console.error(`deleteView ERROR: No view found with id ${id}`);
          throw new Error(`No view found with id ${id}`);
        }

        console.log("deleteView successful:", { id, name: viewName });
        return {
          success: true,
          deletedId: id,
          deletedName: viewName,
          type: "view",
          updatedCaseId: parentCaseId ?? null,
          updatedStepsCount,
        };
      },
    },
    {
      name: "listFields",
      description: "Lists all fields for a case.",
      parameters: {
        type: "object",
        properties: {
          caseid: {
            type: "integer",
            description: "Case ID to list fields for",
          },
        },
        required: ["caseid"],
      },
      execute: async (params: { caseid: number }) => {
        console.log("=== listFields EXECUTION STARTED ===");
        console.log("listFields parameters:", JSON.stringify(params, null, 2));
        console.log("listFields called at:", new Date().toISOString());

        const query = `
          SELECT id, name, type, caseid, label, description, "order", options, required, "primary", "sampleValue"
          FROM "${DB_TABLES.FIELDS}"
          WHERE caseid = $1
          ORDER BY "order", name
        `;
        console.log("listFields query:", query);
        console.log("listFields query values:", [params.caseid]);

        const result = await pool.query(query, [params.caseid]);
        const fields = result.rows.map((row) => ({
          id: row.id,
          name: row.name,
          type: row.type,
          caseid: row.caseid,
          label: row.label,
          description: row.description,
          order: row.order,
          options: row.options,
          required: row.required,
          primary: row.primary,
          sampleValue: row.sampleValue ?? null,
        }));

        console.log("listFields successful:", {
          caseid: params.caseid,
          fieldCount: fields.length,
        });

        return { fields };
      },
    },
    {
      name: "listViews",
      description: "Lists all views for a specific case.",
      parameters: {
        type: "object",
        properties: {
          caseid: { type: "integer", description: "Case ID to list views for" },
        },
        required: ["caseid"],
      },
      execute: async (params: { caseid: number }) => {
        console.log("=== listViews EXECUTION STARTED ===");
        console.log("listViews parameters:", JSON.stringify(params, null, 2));
        console.log("listViews called at:", new Date().toISOString());

        const query = `
          SELECT id, name, caseid, model
          FROM "${DB_TABLES.VIEWS}"
          WHERE caseid = $1
          ORDER BY name
        `;
        console.log("listViews query:", query);
        console.log("listViews query values:", [params.caseid]);

        const result = await pool.query(query, [params.caseid]);
        const views = result.rows.map((row) => ({
          id: row.id,
          name: row.name,
          caseid: row.caseid,
          model:
            typeof row.model === "string" ? JSON.parse(row.model) : row.model,
        }));

        console.log("listViews successful:", {
          caseid: params.caseid,
          viewCount: views.length,
        });

        return { views };
      },
    },
    {
      name: "getCase",
      description:
        "Gets case details including workflow model. Use first to see current structure.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "integer", description: "Case ID" },
        },
        required: ["id"],
      },
      execute: async (params: { id: number }) => {
        console.log("=== getCase EXECUTION STARTED ===");
        console.log("getCase parameters:", JSON.stringify(params, null, 2));
        console.log("getCase called at:", new Date().toISOString());

        const query = `
          SELECT id, name, description, model
          FROM "${DB_TABLES.CASES}"
          WHERE id = $1
        `;
        console.log("getCase query:", query);
        console.log("getCase query values:", [params.id]);

        const result = await pool.query(query, [params.id]);
        if (result.rowCount === 0) {
          console.error(`getCase ERROR: No case found with id ${params.id}`);
          throw new Error(`No case found with id ${params.id}`);
        }
        const caseData = result.rows[0];
        const model =
          typeof caseData.model === "string"
            ? JSON.parse(caseData.model)
            : caseData.model;

        console.log("getCase successful:", {
          id: caseData.id,
          name: caseData.name,
          modelStages: model.stages?.length || 0,
        });

        // Extract step names for easier reference
        const steps: Array<{
          id: number;
          name: string;
          type: string;
          stage: string;
          process: string;
        }> = [];
        for (const stage of model.stages || []) {
          for (const process of stage.processes || []) {
            for (const step of process.steps || []) {
              steps.push({
                id: step.id,
                name: step.name,
                type: step.type,
                stage: stage.name,
                process: process.name,
              });
            }
          }
        }

        return {
          id: caseData.id,
          name: caseData.name,
          description: caseData.description,
          model,
          steps,
        };
      },
    },
    {
      name: "getCases",
      description: "Lists all cases with names and descriptions.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
      execute: async () => {
        console.log("=== getCases EXECUTION STARTED ===");
        console.log("getCases called at:", new Date().toISOString());

        const query = `
          SELECT id, name, description
          FROM "${DB_TABLES.CASES}"
          ORDER BY name
        `;
        console.log("getCases query:", query);

        const result = await pool.query(query);
        const cases = result.rows.map((row) => ({
          id: row.id,
          name: row.name,
          description: row.description,
        }));

        console.log("getCases successful:", {
          caseCount: cases.length,
        });

        return { cases };
      },
    },
  ];

  return tools;
}

// Convert shared tools back to LLM tools for backward compatibility
export function convertToLLMTools(
  sharedTools: ReturnType<typeof createSharedTools>,
): LLMTool[] {
  return sharedTools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
    execute: tool.execute as unknown as (
      params: ToolParams,
    ) => Promise<ToolResult>,
  }));
}
