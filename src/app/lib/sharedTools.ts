import { Pool } from "pg";
import { DB_TABLES } from "../types/database";
import {
  LLMTool,
  SaveCaseParams,
  SaveFieldParams,
  SaveViewParams,
  DeleteParams,
  ToolParams,
  ToolResult,
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
      SaveCaseParams,
      { id: number; name: string; description: string; model: unknown }
    >
  | SharedTool<
      SaveFieldParams,
      {
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
      }
    >
  | SharedTool<
      SaveViewParams,
      { id: number; name: string; caseID: number; model: unknown }
    >
  | SharedTool<DeleteParams, { success: boolean; deletedId: number }>
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
)[] {
  const tools: (
    | SharedTool<
        SaveCaseParams,
        { id: number; name: string; description: string; model: unknown }
      >
    | SharedTool<
        SaveFieldParams,
        {
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
        }
      >
    | SharedTool<
        SaveViewParams,
        { id: number; name: string; caseID: number; model: unknown }
      >
    | SharedTool<DeleteParams, { success: boolean; deletedId: number }>
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
  )[] = [
    {
      name: "saveCase",
      description:
        "Creates a new case or updates an existing case. If id is provided, updates the case; otherwise, creates a new case.",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "integer",
            description: "Case ID (required for update, omit for create)",
          },
          name: { type: "string", description: "Case name" },
          description: { type: "string", description: "Case description" },
          model: {
            type: "object",
            description: "Workflow model with stages array",
            properties: {
              stages: { type: "array", items: {}, description: "Stages array" },
            },
            required: ["stages"],
          },
        },
        required: ["name", "description", "model"],
      },
      execute: async (params: SaveCaseParams) => {
        console.log("=== saveCase EXECUTION STARTED ===");
        console.log("saveCase parameters:", JSON.stringify(params, null, 2));
        console.log("saveCase called at:", new Date().toISOString());

        const { id, name, description, model } = params;

        // Validation
        if (!name) throw new Error("Case name is required for saveCase");
        if (!description)
          throw new Error("Case description is required for saveCase");
        if (!model) throw new Error("Case model is required for saveCase");

        // Handle empty model - provide default structure
        if (Object.keys(model).length === 0) {
          model.stages = [];
        }

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
          const viewQuery = `SELECT id FROM "${DB_TABLES.VIEWS}" WHERE id = ANY($1)`;
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
        }

        if (id) {
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
        } else {
          // Create new case
          const query = `
            INSERT INTO "${DB_TABLES.CASES}" (name, description, model)
            VALUES ($1, $2, $3)
            RETURNING id, name, description, model
          `;
          console.log("saveCase INSERT query:", query);
          console.log("saveCase INSERT query values:", [
            name,
            description,
            JSON.stringify(model),
          ]);

          const result = await pool.query(query, [
            name,
            description,
            JSON.stringify(model),
          ]);
          const caseData = result.rows[0] || {};

          console.log("saveCase INSERT successful:", {
            id: caseData?.id,
            name: caseData?.name,
            modelStages: caseData?.model
              ? JSON.parse(caseData.model).stages?.length || 0
              : 0,
          });

          return {
            id: caseData.id,
            name: caseData.name,
            description: caseData.description,
            model:
              typeof caseData.model === "string"
                ? JSON.parse(caseData.model)
                : model ?? null,
          };
        }
      },
    },
    {
      name: "saveField",
      description:
        "Creates a new field or updates an existing field. If id is provided, updates the field; otherwise, creates a new field.",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "integer",
            description: "Field ID (required for update, omit for create)",
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
          label: { type: "string", description: "Display label for the field" },
          description: { type: "string", description: "Field description" },
          order: { type: "integer", description: "Display order" },
          options: {
            type: "string",
            description: "JSON string of options for dropdown/radio fields",
          },
          required: {
            type: "boolean",
            description: "Whether the field is required",
          },
          primary: {
            type: "boolean",
            description: "Whether this is a primary field",
          },
        },
        required: ["name", "type", "caseID", "label"],
      },
      execute: async (params: SaveFieldParams) => {
        console.log("=== saveField EXECUTION STARTED ===");
        console.log("saveField parameters:", JSON.stringify(params, null, 2));
        console.log("saveField called at:", new Date().toISOString());

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
        } = params;

        // Validation
        if (!name) throw new Error("Field name is required for saveField");
        if (!type) throw new Error("Field type is required for saveField");
        if (!caseID) throw new Error("Case ID is required for saveField");
        if (!label) throw new Error("Field label is required for saveField");

        // Validate field type
        const validFieldTypes = [
          "Text",
          "Email",
          "Date",
          "Number",
          "Boolean",
          "Select",
          "MultiSelect",
          "TextArea",
        ];
        if (!validFieldTypes.includes(type)) {
          throw new Error(`Invalid field type "${type}"`);
        }

        // Validate field name format - allow camelCase
        if (!/^[a-z][a-zA-Z0-9_]*$/.test(name)) {
          throw new Error(`Invalid field name "${name}"`);
        }

        // Check for existing field with same name in the same case
        const existingFieldQuery = `SELECT id FROM "${DB_TABLES.FIELDS}" WHERE name = $1 AND caseID = $2`;
        const existingFieldResult = await pool.query(existingFieldQuery, [
          name,
          caseID,
        ]);

        if (existingFieldResult.rowCount && existingFieldResult.rowCount > 0) {
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
          return {
            id: fieldData.id ?? existingFieldId,
            name: fieldData.name ?? name,
            type: fieldData.type ?? type,
            caseID: fieldData.caseID ?? fieldData.caseid ?? caseID,
            label: fieldData.label ?? label,
            description: fieldData.description ?? description ?? "",
            order: fieldData.order ?? order ?? 0,
            options: fieldData.options ?? options ?? "[]",
            required: fieldData.required ?? required ?? false,
            primary: fieldData.primary ?? primary ?? false,
          };
        }

        if (id) {
          // Update existing field
          const query = `
            UPDATE "${DB_TABLES.FIELDS}"
            SET name = $1, type = $2, caseID = $3, label = $4, description = $5, "order" = $6, options = $7, required = $8, "primary" = $9
            WHERE id = $10
            RETURNING id, name, type, caseID, label, description, "order", options, required, "primary"
          `;
          console.log("saveField UPDATE query:", query);
          console.log("saveField UPDATE query values:", [
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
            console.error(`saveField ERROR: No field found with id ${id}`);
            throw new Error(`No field found with id ${id}`);
          }

          const fieldData = result.rows[0] || {};
          console.log("saveField UPDATE successful:", {
            id: fieldData?.id,
            name: fieldData?.name,
            type: fieldData?.type,
            caseID: fieldData?.caseID ?? fieldData?.caseid,
          });

          return {
            id: fieldData.id ?? id,
            name: fieldData.name ?? name,
            type: fieldData.type ?? type,
            caseID: fieldData.caseID ?? fieldData.caseid ?? caseID,
            label: fieldData.label ?? label,
            description: fieldData.description ?? description ?? "",
            order: fieldData.order ?? order ?? 0,
            options: fieldData.options ?? options ?? "[]",
            required: fieldData.required ?? required ?? false,
            primary: fieldData.primary ?? primary ?? false,
          };
        } else {
          // Create new field
          const query = `
            INSERT INTO "${DB_TABLES.FIELDS}" (name, type, caseID, label, description, "order", options, required, "primary")
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id, name, type, caseID, label, description, "order", options, required, "primary"
          `;
          console.log("saveField INSERT query:", query);
          console.log("saveField INSERT query values:", [
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

          console.log("saveField INSERT successful:", {
            id: fieldData?.id,
            name: fieldData?.name,
            type: fieldData?.type,
            caseID: fieldData?.caseID ?? fieldData?.caseid,
          });

          return {
            id: fieldData.id ?? id,
            name: fieldData.name ?? name,
            type: fieldData.type ?? type,
            caseID: fieldData.caseID ?? fieldData.caseid ?? caseID,
            label: fieldData.label ?? label,
            description: fieldData.description ?? description ?? "",
            order: fieldData.order ?? order ?? 0,
            options: fieldData.options ?? options ?? "[]",
            required: fieldData.required ?? required ?? false,
            primary: fieldData.primary ?? primary ?? false,
          };
        }
      },
    },
    {
      name: "saveView",
      description:
        "Creates a new view or updates an existing view. If id is provided, updates the view; otherwise, creates a new view.",
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
              fields: { type: "array", items: {}, description: "Fields array" },
              layout: { type: "object", description: "Layout configuration" },
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
      description: "Deletes a field.",
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

        const query = `DELETE FROM "${DB_TABLES.FIELDS}" WHERE id = $1`;
        console.log("deleteField query:", query);
        console.log("deleteField query values:", [id]);

        const result = await pool.query(query, [id]);
        if (result.rowCount === 0) {
          console.error(`deleteField ERROR: No field found with id ${id}`);
          throw new Error(`No field found with id ${id}`);
        }

        console.log("deleteField successful:", { id });
        return { success: true, deletedId: id };
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

        const query = `DELETE FROM "${DB_TABLES.VIEWS}" WHERE id = $1`;
        console.log("deleteView query:", query);
        console.log("deleteView query values:", [id]);

        const result = await pool.query(query, [id]);
        if (result.rowCount === 0) {
          console.error(`deleteView ERROR: No view found with id ${id}`);
          throw new Error(`No view found with id ${id}`);
        }

        console.log("deleteView successful:", { id });
        return { success: true, deletedId: id };
      },
    },
    {
      name: "listFields",
      description: "Lists all fields for a specific case.",
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
        "Gets the details of a specific case including its workflow model. CRITICAL: Use this FIRST before any other operations to see the current workflow structure.",
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
          id: string;
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
