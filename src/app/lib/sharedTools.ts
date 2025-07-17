import { Pool } from "pg";
import { DB_TABLES } from "../types/database";
import { fieldTypes, FieldType } from "../types/fields";
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
export function createSharedTools(pool: Pool): (
  | SharedTool<
      CreateCaseParams,
      { id: number; name: string; description: string; model: unknown }
    >
  | SharedTool<
      SaveCaseParams,
      { id: number; name: string; description: string; model: unknown }
    >
  | SharedTool<
      SaveFieldsParams,
      {
        ids: number[];
        fields: Array<{
          id: number;
          name: string;
          type: string;
          caseID: number;
          label: string;
          description: string;
          order: number;
          options: unknown;
          required: boolean;
          primary: boolean;
        }>;
      }
    >
  | SharedTool<
      SaveViewParams,
      { id: number; name: string; caseID: number; model: unknown }
    >
  | SharedTool<
      DeleteParams,
      {
        success: boolean;
        deletedId: number;
        deletedName?: string;
        type?: string;
      }
    >
  | SharedTool<{ caseID: number }, { fields: unknown[] }>
  | SharedTool<{ caseID: number }, { views: unknown[] }>
  | SharedTool<
      { id: number },
      {
        id: number;
        name: string;
        description: string;
        model: unknown;
        steps: unknown[];
      }
    >
  | SharedTool<
      {},
      {
        cases: Array<{
          id: number;
          name: string;
          description: string;
        }>;
      }
    >
)[] {
  const tools: (
    | SharedTool<
        CreateCaseParams,
        { id: number; name: string; description: string; model: unknown }
      >
    | SharedTool<
        SaveCaseParams,
        { id: number; name: string; description: string; model: unknown }
      >
    | SharedTool<
        SaveFieldsParams,
        {
          ids: number[];
          fields: Array<{
            id: number;
            name: string;
            type: string;
            caseID: number;
            label: string;
            description: string;
            order: number;
            options: unknown;
            required: boolean;
            primary: boolean;
          }>;
        }
      >
    | SharedTool<
        SaveViewParams,
        { id: number; name: string; caseID: number; model: unknown }
      >
    | SharedTool<
        DeleteParams,
        {
          success: boolean;
          deletedId: number;
          deletedName?: string;
          type?: string;
        }
      >
    | SharedTool<{ caseID: number }, { fields: unknown[] }>
    | SharedTool<{ caseID: number }, { views: unknown[] }>
    | SharedTool<
        { id: number },
        {
          id: number;
          name: string;
          description: string;
          model: unknown;
          steps: unknown[];
        }
      >
    | SharedTool<
        {},
        {
          cases: Array<{
            id: number;
            name: string;
            description: string;
          }>;
        }
      >
  )[] = [
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
              ? JSON.parse(caseData.model)
              : { stages: [] },
        };
      },
    },
    {
      name: "saveCase",
      description:
        "FINAL STEP: Updates an existing case with the complete workflow model including stages, processes, steps, and viewId references. Use this ONLY when creating a new workflow or when making structural changes that require updating the entire workflow model. DO NOT use this for simple operations like renaming steps, adding fields, or updating views - use the specific tools (saveView, saveFields) for those operations. The model must include viewId values that reference actual view IDs returned from saveView calls. IMPORTANT: Ensure viewId values correspond to the appropriate step names and contain the relevant fields for each step.",
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
                                  description:
                                    "Step type (e.g., 'Collect information', 'Approve/Reject', 'Decision', 'Automation', 'Review', 'Process')",
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

        // Validate that steps don't contain fields arrays
        for (const stage of model.stages) {
          for (const process of stage.processes || []) {
            for (const step of process.steps || []) {
              if (step.fields && Array.isArray(step.fields)) {
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

        // Validate viewId uniqueness
        const viewIds = new Set<number>();
        for (const stage of model.stages) {
          for (const process of stage.processes || []) {
            for (const step of process.steps || []) {
              if (step.viewId) {
                if (viewIds.has(step.viewId)) {
                  throw new Error(
                    `Duplicate viewId "${step.viewId}" found in steps`,
                  );
                }
                viewIds.add(step.viewId);
              }
            }
          }
        }

        // Validate that viewIds exist in database
        if (viewIds.size > 0) {
          const viewIdsArray = Array.from(viewIds);
          const viewQuery = `SELECT id, name FROM "${DB_TABLES.VIEWS}" WHERE id = ANY($1)`;
          const viewResult = await pool.query(viewQuery, [viewIdsArray]);
          const existingViewIds = new Set(viewResult.rows.map((row) => row.id));
          const missingViewIds = viewIdsArray.filter(
            (id) => !existingViewIds.has(id),
          );

          if (missingViewIds.length > 0) {
            throw new Error(
              `The following viewId values do not exist in the database: ${missingViewIds.join(
                ", ",
              )}. Make sure to use the actual IDs returned from saveView calls.`,
            );
          }

          // Provide guidance on view usage
          const viewMap = new Map(
            viewResult.rows.map((row) => [row.id, row.name]),
          );
          console.log(
            "Available views for this case:",
            Array.from(viewMap.entries()).map(
              ([id, name]) => `ID ${id}: "${name}"`,
            ),
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
        console.log("saveCase UPDATE query values:", [
          name,
          description,
          JSON.stringify(model),
          id,
        ]);

        const result = await pool.query(query, [
          name,
          description,
          JSON.stringify(model),
          id,
        ]);
        if (result.rowCount === 0) {
          console.error(`saveCase ERROR: No case found with id ${id}`);
          throw new Error(`No case found with id ${id}`);
        }

        const caseData = result.rows[0] || {};
        console.log("saveCase UPDATE successful:", {
          id: caseData?.id,
          name: caseData?.name,
          modelStages: caseData?.model
            ? JSON.parse(caseData.model).stages?.length || 0
            : 0,
        });

        return {
          id: caseData.id ?? id,
          name: caseData.name ?? name,
          description: caseData.description ?? description,
          model:
            typeof caseData.model === "string"
              ? JSON.parse(caseData.model)
              : model ?? null,
        };
      },
    },
    {
      name: "saveFields",
      description:
        "STEP 2: Creates multiple fields or updates existing fields in a single operation for better performance. Use the caseID returned from createCase. Fields store the business data that will be collected in views. Only create fields - do not include them in the workflow model.",
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
                  description: "Field type (Text, Email, Date, etc.)",
                },
                caseID: {
                  type: "integer",
                  description: "Case ID this field belongs to",
                },
                label: {
                  type: "string",
                  description: "Display label for the field",
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
                defaultValue: {
                  type: "string",
                  description: "Default value for the field",
                },
              },
              required: ["name", "type", "caseID", "label"],
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
          caseID: number;
          label: string;
          description: string;
          order: number;
          options: unknown;
          required: boolean;
          primary: boolean;
        }> = [];

        // Process each field
        for (const field of fields) {
          const {
            id,
            name,
            type,
            caseID,
            label,
            description,
            order,
            options,
            required,
            primary,
          } = field;

          // Validation
          if (!name) throw new Error("Field name is required for saveFields");
          if (!type) throw new Error("Field type is required for saveFields");
          if (!caseID) throw new Error("Case ID is required for saveFields");
          if (!label) throw new Error("Field label is required for saveFields");

          // Validate field type
          if (!fieldTypes.includes(type as FieldType)) {
            throw new Error(`Invalid field type "${type}"`);
          }

          // Check for existing field with same name in the same case
          const existingFieldQuery = `SELECT id FROM "${DB_TABLES.FIELDS}" WHERE name = $1 AND caseID = $2`;
          const existingFieldResult = await pool.query(existingFieldQuery, [
            name,
            caseID,
          ]);

          if (
            existingFieldResult.rowCount &&
            existingFieldResult.rowCount > 0
          ) {
            // Return existing field
            const existingFieldId = existingFieldResult.rows[0].id;
            const fullFieldQuery = `SELECT * FROM "${DB_TABLES.FIELDS}" WHERE id = $1`;
            const fullFieldResult = await pool.query(fullFieldQuery, [
              existingFieldId,
            ]);
            const fieldData =
              fullFieldResult && fullFieldResult.rows && fullFieldResult.rows[0]
                ? fullFieldResult.rows[0]
                : {};

            results.push({
              id: fieldData.id ?? existingFieldId,
              name: fieldData.name ?? name,
              type: fieldData.type ?? type,
              caseID: fieldData.caseID ?? fieldData.caseid ?? caseID,
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
            });
            continue;
          }

          if (id) {
            // Update existing field
            const query = `
              UPDATE "${DB_TABLES.FIELDS}"
              SET name = $1, type = $2, caseID = $3, label = $4, description = $5, "order" = $6, options = $7, required = $8, "primary" = $9
              WHERE id = $10
              RETURNING id, name, type, caseID, label, description, "order", options, required, "primary"
            `;
            console.log("saveFields UPDATE query:", query);
            console.log("saveFields UPDATE query values:", [
              name,
              type,
              caseID,
              label,
              description ?? "",
              order ?? 0,
              options ?? "[]",
              required ?? false,
              primary ?? false,
              id,
            ]);

            const result = await pool.query(query, [
              name,
              type,
              caseID,
              label,
              description ?? "",
              order ?? 0,
              options ?? "[]",
              required ?? false,
              primary ?? false,
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
              caseID: fieldData?.caseID ?? fieldData?.caseid,
            });

            results.push({
              id: fieldData.id ?? id,
              name: fieldData.name ?? name,
              type: fieldData.type ?? type,
              caseID: fieldData.caseID ?? fieldData.caseid ?? caseID,
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
            });
          } else {
            // Create new field
            const query = `
              INSERT INTO "${DB_TABLES.FIELDS}" (name, type, caseID, label, description, "order", options, required, "primary")
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
              RETURNING id, name, type, caseID, label, description, "order", options, required, "primary"
            `;
            console.log("saveFields INSERT query:", query);
            console.log("saveFields INSERT query values:", [
              name,
              type,
              caseID,
              label,
              description ?? "",
              order ?? 0,
              options ?? "[]",
              required ?? false,
              primary ?? false,
            ]);

            const result = await pool.query(query, [
              name,
              type,
              caseID,
              label,
              description ?? "",
              order ?? 0,
              options ?? "[]",
              required ?? false,
              primary ?? false,
            ]);
            const fieldData = result.rows[0] || {};

            console.log("saveFields INSERT successful:", {
              id: fieldData?.id,
              name: fieldData?.name,
              type: fieldData?.type,
              caseID: fieldData?.caseID ?? fieldData?.caseid,
            });

            results.push({
              id: fieldData.id ?? id,
              name: fieldData.name ?? name,
              type: fieldData.type ?? type,
              caseID: fieldData.caseID ?? fieldData.caseid ?? caseID,
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
            });
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
        "Creates or updates a view for a case. Save the returned view ID for workflow model.",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "integer",
            description: "View ID (required for update, omit for create)",
          },
          name: { type: "string", description: "View name" },
          caseID: {
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
        required: ["name", "caseID", "model"],
      },
      execute: async (params: SaveViewParams) => {
        console.log("=== saveView EXECUTION STARTED ===");
        console.log("saveView parameters:", JSON.stringify(params, null, 2));
        console.log("saveView called at:", new Date().toISOString());

        const { id, name, caseID, model } = params;

        // Validation
        if (!name) throw new Error("View name is required for saveView");
        if (!caseID) throw new Error("Case ID is required for saveView");
        if (!model) throw new Error("View model is required for saveView");

        if (id) {
          // Update existing view
          const query = `
            UPDATE "${DB_TABLES.VIEWS}"
            SET name = $1, caseID = $2, model = $3
            WHERE id = $4
            RETURNING id, name, caseID, model
          `;
          console.log("saveView UPDATE query:", query);
          console.log("saveView UPDATE query values:", [
            name,
            caseID,
            JSON.stringify(model),
            id,
          ]);

          const result = await pool.query(query, [
            name,
            caseID,
            JSON.stringify(model),
            id,
          ]);
          if (result.rowCount === 0) {
            console.error(`saveView ERROR: No view found with id ${id}`);
            throw new Error(`No view found with id ${id}`);
          }

          const viewData = result.rows[0];
          console.log("saveView UPDATE successful:", {
            id: viewData?.id,
            name: viewData?.name,
            caseID: viewData?.caseID ?? viewData?.caseid,
            modelFields: viewData?.model
              ? JSON.parse(viewData.model).fields?.length || 0
              : 0,
          });

          // Validate that all fieldIds in model.fields exist in the database for this caseID
          if (model && Array.isArray(model.fields) && model.fields.length > 0) {
            const fieldIds = model.fields.map((f) => f.fieldId);
            const fieldQuery = `SELECT id, type FROM "${DB_TABLES.FIELDS}" WHERE id = ANY($1) AND caseID = $2`;
            const fieldResult = await pool.query(fieldQuery, [
              fieldIds,
              caseID,
            ]);
            const existingFieldIds = new Set(
              fieldResult.rows.map((row) => row.id),
            );
            const missingFieldIds = fieldIds.filter(
              (id) => !existingFieldIds.has(id),
            );
            if (missingFieldIds.length > 0) {
              throw new Error(
                `The following fieldId values do not exist for this case: ${missingFieldIds.join(
                  ", ",
                )}`,
              );
            }
            // Validate field types
            for (const row of fieldResult.rows) {
              if (!fieldTypes.includes(row.type)) {
                throw new Error(
                  `Field ID ${row.id} has invalid type: ${row.type}`,
                );
              }
            }
          }

          return {
            id: viewData?.id,
            name: viewData?.name,
            caseID: viewData?.caseID ?? viewData?.caseid,
            model:
              typeof viewData?.model === "string"
                ? JSON.parse(viewData.model)
                : null,
          };
        } else {
          // Create new view
          const query = `
            INSERT INTO "${DB_TABLES.VIEWS}" (name, caseID, model)
            VALUES ($1, $2, $3)
            RETURNING id, name, caseID, model
          `;
          console.log("saveView INSERT query:", query);
          console.log("saveView INSERT query values:", [
            name,
            caseID,
            JSON.stringify(model),
          ]);

          const result = await pool.query(query, [
            name,
            caseID,
            JSON.stringify(model),
          ]);
          const viewData = result.rows[0];

          console.log("saveView INSERT successful:", {
            id: viewData?.id,
            name: viewData?.name,
            caseID: viewData?.caseID ?? viewData?.caseid,
            modelFields: viewData?.model
              ? JSON.parse(viewData.model).fields?.length || 0
              : 0,
          });

          // Validate that all fieldIds in model.fields exist in the database for this caseID
          if (model && Array.isArray(model.fields) && model.fields.length > 0) {
            const fieldIds = model.fields.map((f) => f.fieldId);
            const fieldQuery = `SELECT id, type FROM "${DB_TABLES.FIELDS}" WHERE id = ANY($1) AND caseID = $2`;
            const fieldResult = await pool.query(fieldQuery, [
              fieldIds,
              caseID,
            ]);
            const existingFieldIds = new Set(
              fieldResult.rows.map((row) => row.id),
            );
            const missingFieldIds = fieldIds.filter(
              (id) => !existingFieldIds.has(id),
            );
            if (missingFieldIds.length > 0) {
              throw new Error(
                `The following fieldId values do not exist for this case: ${missingFieldIds.join(
                  ", ",
                )}`,
              );
            }
            // Validate field types
            for (const row of fieldResult.rows) {
              if (!fieldTypes.includes(row.type)) {
                throw new Error(
                  `Field ID ${row.id} has invalid type: ${row.type}`,
                );
              }
            }
          }

          return {
            id: viewData?.id,
            name: viewData?.name,
            caseID: viewData?.caseID ?? viewData?.caseid,
            model:
              typeof viewData?.model === "string"
                ? JSON.parse(viewData.model)
                : null,
          };
        }
      },
    },
    {
      name: "deleteCase",
      description: "Deletes a case and all its associated fields and views.",
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
        const deleteFieldsQuery = `DELETE FROM "${DB_TABLES.FIELDS}" WHERE caseID = $1`;
        console.log("deleteCase deleteFields query:", deleteFieldsQuery);
        console.log("deleteCase deleteFields query values:", [id]);
        await pool.query(deleteFieldsQuery, [id]);

        // Delete associated views
        const deleteViewsQuery = `DELETE FROM "${DB_TABLES.VIEWS}" WHERE caseID = $1`;
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
        "Deletes a field and removes it from all views where it's used.",
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

        // First, get the field name and caseID before deleting
        const getFieldQuery = `SELECT name, caseID FROM "${DB_TABLES.FIELDS}" WHERE id = $1`;
        const getFieldResult = await pool.query(getFieldQuery, [id]);
        if (getFieldResult.rowCount === 0) {
          console.error(`deleteField ERROR: No field found with id ${id}`);
          throw new Error(`No field found with id ${id}`);
        }
        const fieldName = getFieldResult.rows[0].name;
        const caseID = getFieldResult.rows[0].caseID;

        // Find all views that use this field and remove the field from them
        const getViewsQuery = `SELECT id, name, model FROM "${DB_TABLES.VIEWS}" WHERE caseID = $1`;
        const viewsResult = await pool.query(getViewsQuery, [caseID]);

        let updatedViewsCount = 0;
        for (const view of viewsResult.rows) {
          try {
            const viewModel = JSON.parse(view.model);
            if (viewModel.fields && Array.isArray(viewModel.fields)) {
              // Remove the field from the view's fields array
              const originalFieldCount = viewModel.fields.length;
              viewModel.fields = viewModel.fields.filter(
                (fieldRef: any) => fieldRef.fieldId !== id,
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
          caseID,
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
      description: "Deletes a view.",
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

        // First, get the view name before deleting
        const getViewQuery = `SELECT name FROM "${DB_TABLES.VIEWS}" WHERE id = $1`;
        const getViewResult = await pool.query(getViewQuery, [id]);
        if (getViewResult.rowCount === 0) {
          console.error(`deleteView ERROR: No view found with id ${id}`);
          throw new Error(`No view found with id ${id}`);
        }
        const viewName = getViewResult.rows[0].name;

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
        };
      },
    },
    {
      name: "listFields",
      description: "Lists all fields for a case.",
      parameters: {
        type: "object",
        properties: {
          caseID: {
            type: "integer",
            description: "Case ID to list fields for",
          },
        },
        required: ["caseID"],
      },
      execute: async (params: { caseID: number }) => {
        console.log("=== listFields EXECUTION STARTED ===");
        console.log("listFields parameters:", JSON.stringify(params, null, 2));
        console.log("listFields called at:", new Date().toISOString());

        const query = `
          SELECT id, name, type, caseID, label, description, "order", options, required, "primary"
          FROM "${DB_TABLES.FIELDS}"
          WHERE caseID = $1
          ORDER BY "order", name
        `;
        console.log("listFields query:", query);
        console.log("listFields query values:", [params.caseID]);

        const result = await pool.query(query, [params.caseID]);
        const fields = result.rows.map((row) => ({
          id: row.id,
          name: row.name,
          type: row.type,
          caseID: row.caseID,
          label: row.label,
          description: row.description,
          order: row.order,
          options: row.options,
          required: row.required,
          primary: row.primary,
        }));

        console.log("listFields successful:", {
          caseID: params.caseID,
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
          caseID: { type: "integer", description: "Case ID to list views for" },
        },
        required: ["caseID"],
      },
      execute: async (params: { caseID: number }) => {
        console.log("=== listViews EXECUTION STARTED ===");
        console.log("listViews parameters:", JSON.stringify(params, null, 2));
        console.log("listViews called at:", new Date().toISOString());

        const query = `
          SELECT id, name, caseID, model
          FROM "${DB_TABLES.VIEWS}"
          WHERE caseID = $1
          ORDER BY name
        `;
        console.log("listViews query:", query);
        console.log("listViews query values:", [params.caseID]);

        const result = await pool.query(query, [params.caseID]);
        const views = result.rows.map((row) => ({
          id: row.id,
          name: row.name,
          caseID: row.caseID,
          model: JSON.parse(row.model),
        }));

        console.log("listViews successful:", {
          caseID: params.caseID,
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
        const model = JSON.parse(caseData.model);

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
