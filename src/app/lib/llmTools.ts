import { DB_TABLES } from "../types/database";
import { Pool } from "pg";

// Define proper types for tool parameters and results
export interface ToolParams {
  [key: string]: unknown;
}

export interface ToolResult {
  [key: string]: unknown;
}

export interface LLMTool<TParams = ToolParams, TResult = ToolResult> {
  name: string;
  description: string;
  execute: (params: TParams) => Promise<TResult>;
}

// Define specific parameter types for each tool
export interface SaveCaseParams extends ToolParams {
  id?: number;
  name: string;
  description: string;
  model: WorkflowModel;
}

export interface SaveFieldParams extends ToolParams {
  id?: number;
  name: string;
  type: string;
  caseID: number;
  primary?: boolean;
  required?: boolean;
  label: string;
  description?: string;
  order?: number;
  options?: unknown[];
  defaultValue?: unknown;
}

export interface SaveViewParams extends ToolParams {
  id?: number;
  name: string;
  caseID: number;
  model: {
    fields: ViewField[];
    layout: ViewLayout;
  };
}

export interface DeleteParams extends ToolParams {
  id: number;
}

// Define workflow model types
export interface WorkflowModel {
  stages: Stage[];
}

export interface Stage {
  id: number;
  name: string;
  order: number;
  processes: Process[];
}

export interface Process {
  id: number;
  name: string;
  order: number;
  steps: Step[];
}

export interface Step {
  id: number;
  type: string;
  name: string;
  order: number;
  viewId?: number;
}

// Define view model types
export interface ViewModel {
  fields: ViewField[];
  layout: ViewLayout;
}

export interface ViewField {
  fieldId: number;
  required?: boolean;
  order?: number;
}

export interface ViewLayout {
  type: string;
  columns?: number;
}

// Helper function to validate case name uniqueness
async function validateCaseName(
  name: string,
  _excludeId?: number,
): Promise<void> {
  // Validate that name is provided and not null/undefined
  if (!name || typeof name !== "string" || name.trim() === "") {
    throw new Error(
      "Case name is required and cannot be null, undefined, or empty",
    );
  }

  // Case names don't need to be unique - we use IDs for operations
  return;
}

// Helper function to validate field type
function validateFieldTypeInLLM(type: string): void {
  const validTypes = [
    "Text",
    "Email",
    "Date",
    "Phone",
    "Address",
    "Dropdown",
    "Currency",
    "TextArea",
    "URL",
    "Checkbox",
    "Status",
    "DateTime",
    "Decimal",
    "Integer",
    "Location",
    "ReferenceValues",
    "DataReferenceSingle",
    "DataReferenceMulti",
    "CaseReferenceSingle",
    "CaseReferenceMulti",
    "Percentage",
    "RadioButtons",
    "RichText",
    "Time",
    "AutoComplete",
    "UserReference",
  ];
  if (!validTypes.includes(type)) {
    throw new Error(
      `Invalid field type "${type}". Valid types are: ${validTypes.join(", ")}`,
    );
  }
}

function validateFieldNameInLLM(name: string): void {
  // Prevent creation of generic stage/step fields
  const genericPatterns = [
    /^stage\d+$/i,
    /^step\d+$/i,
    /^process\d+$/i,
    /^stage\s*\d+$/i,
    /^step\s*\d+$/i,
    /^process\s*\d+$/i,
    // Additional patterns to catch stage1Name, stage1Description, etc.
    /^stage\d+[A-Za-z]+$/i,
    /^step\d+[A-Za-z]+$/i,
    /^process\d+[A-Za-z]+$/i,
    /^stage\s*\d+[A-Za-z]+$/i,
    /^step\s*\d+[A-Za-z]+$/i,
    /^process\s*\d+[A-Za-z]+$/i,
  ];

  for (const pattern of genericPatterns) {
    if (pattern.test(name)) {
      throw new Error(
        `Invalid field name "${name}". Do not create generic workflow structure fields like "Stage1", "Step1", "Stage1Name", etc. Create fields for actual business data instead.

VALID FIELD NAME EXAMPLES:
- General: "applicantName", "email", "phoneNumber", "budget", "startDate", "description"
- Kitchen Remodeling: "cabinetStyle", "countertopMaterial", "applianceList", "contractorContact"
- Home Loan: "loanAmount", "downPayment", "income", "propertyAddress"
- Employee Onboarding: "employeeName", "department", "salary", "startDate"
- Customer Support: "ticketNumber", "issueType", "customerId", "problemDescription"

Think: "What specific business data am I collecting from the user?" Not "What workflow structure am I describing?"`,
      );
    }
  }
}

export function getDatabaseTools(pool: Pool) {
  return [
    {
      name: "saveCase",
      description:
        "Creates a new case or updates an existing case in the database. If id is provided, updates the existing case. If no id is provided, creates a new case. CRITICAL: This should ONLY be called at the END of the workflow creation process, after all fields and views have been created. DO NOT call this early in the process. CRITICAL: The model must follow this exact structure: { stages: [{ id: number, name: string, order: number, processes: [{ id: number, name: string, order: number, steps: [{ id: number, type: string, name: string, order: number, viewId?: number }] }] }] }. Each stage must have a processes array, each process must have a steps array. Only 'Collect information' steps should have viewId. CRITICAL: Only call this after creating all fields and views - this is the FINAL step to create/update the case with the complete workflow model. CRITICAL: The viewId values must be the actual database IDs returned from saveView calls - do not use hardcoded IDs!",
      execute: async (params: SaveCaseParams) => {
        console.log("=== saveCase EXECUTION STARTED ===");
        console.log("saveCase parameters:", JSON.stringify(params, null, 2));
        console.log("saveCase called at:", new Date().toISOString());

        // CRITICAL: Check if this is being called too early
        if (!params.id) {
          // This is a new case creation - check if there are any existing fields or views
          console.log(
            "saveCase: Checking if this is being called too early (new case creation)",
          );

          // Check if there are any fields in the database
          const fieldsCheck = await pool.query(
            `SELECT COUNT(*) as count FROM "${DB_TABLES.FIELDS}"`,
          );
          const fieldsCount = parseInt(fieldsCheck.rows[0].count);

          // Check if there are any views in the database
          const viewsCheck = await pool.query(
            `SELECT COUNT(*) as count FROM "${DB_TABLES.VIEWS}"`,
          );
          const viewsCount = parseInt(viewsCheck.rows[0].count);

          console.log(
            `saveCase: Database state - Fields: ${fieldsCount}, Views: ${viewsCount}`,
          );

          // If this is a new case creation and there are no fields/views yet, this might be too early
          if (fieldsCount === 0 && viewsCount === 0) {
            console.warn(
              "saveCase WARNING: This appears to be the first saveCase call with no fields/views created yet",
            );
            console.warn(
              "saveCase WARNING: Consider creating fields and views first before calling saveCase",
            );
          }
        }

        // Validate required parameters
        if (!params.name) {
          console.error("saveCase ERROR: Case name is required");
          throw new Error("Case name is required for saveCase");
        }
        if (!params.description) {
          console.error("saveCase ERROR: Case description is required");
          throw new Error("Case description is required for saveCase");
        }
        if (!params.model) {
          console.error("saveCase ERROR: Case model is required");
          throw new Error("Case model is required for saveCase");
        }

        console.log("saveCase validation passed");

        // Validate model structure
        if (!params.model?.stages) {
          // If no stages property exists, create a default empty model
          console.log(
            "saveCase: No stages property found, creating default empty model",
          );
          params.model = { stages: [] };
        }

        // Validate that stages is an array and has the expected structure
        if (!Array.isArray(params.model.stages)) {
          console.error("saveCase ERROR: Model stages must be an array");
          throw new Error("Model stages must be an array");
        }

        console.log("saveCase model validation passed");
        console.log(
          "saveCase model structure:",
          JSON.stringify(params.model, null, 2),
        );

        // Validate that steps don't contain fields arrays
        for (const stage of params.model.stages) {
          // Defensive check: ensure stage has processes property
          if (!stage.processes) {
            throw new Error(
              `Stage "${
                stage.name || "unnamed"
              }" is missing processes array. Expected structure: { id, name, order, processes: [...] }`,
            );
          }

          // Defensive check: ensure processes is an array
          if (!Array.isArray(stage.processes)) {
            throw new Error(
              `Stage "${
                stage.name || "unnamed"
              }" has processes that is not an array. Expected: processes: [...]`,
            );
          }

          // Allow empty processes arrays during initial case creation
          // Only validate process structure if processes array is not empty
          if (stage.processes.length > 0) {
            for (const process of stage.processes) {
              // Defensive check: ensure process has steps property
              if (!process.steps) {
                throw new Error(
                  `Process "${process.name || "unnamed"}" in stage "${
                    stage.name || "unnamed"
                  }" is missing steps array. Expected structure: { id, name, order, steps: [...] }`,
                );
              }

              // Defensive check: ensure steps is an array
              if (!Array.isArray(process.steps)) {
                throw new Error(
                  `Process "${process.name || "unnamed"}" in stage "${
                    stage.name || "unnamed"
                  }" has steps that is not an array. Expected: steps: [...]`,
                );
              }

              for (const step of process.steps) {
                if ("fields" in step) {
                  throw new Error(
                    `Step "${step.name}" contains a fields array. Fields should be stored in views, not in steps. Remove the fields array from the step.`,
                  );
                }
              }
            }
          }
        }

        // Validate case name uniqueness (excluding current case)
        await validateCaseName(params.name, params.id);

        // Validate view IDs for collect_information steps
        const viewIds = new Set<number>();
        let hasCollectInfoSteps = false;
        let missingViewIds = 0;
        let invalidViewIds = 0;
        let nonExistentViewIds: number[] = [];

        for (const stage of params.model.stages) {
          // Only validate view IDs if processes array is not empty
          if (stage.processes.length > 0) {
            for (const process of stage.processes) {
              for (const step of process.steps) {
                if (step.type === "Collect information") {
                  hasCollectInfoSteps = true;
                  if (!step.viewId) {
                    missingViewIds++;
                    console.warn(
                      `Warning: Step "${step.name}" of type "Collect information" is missing viewId. This step won't appear in the Views tab.`,
                    );
                  } else {
                    if (viewIds.has(step.viewId)) {
                      throw new Error(
                        `Duplicate viewId "${step.viewId}" found in steps`,
                      );
                    }
                    viewIds.add(step.viewId);
                  }
                } else {
                  // Non-collect information steps should NOT have viewId
                  if (step.viewId) {
                    invalidViewIds++;
                    console.warn(
                      `Warning: Step "${step.name}" of type "${step.type}" has viewId "${step.viewId}" but should not. Only "Collect information" steps need viewId.`,
                    );
                  }
                }
              }
            }
          }
        }

        // Validate that all viewId values actually exist in the database
        if (viewIds.size > 0) {
          const viewIdArray = Array.from(viewIds);
          const placeholders = viewIdArray
            .map((_, index) => `$${index + 1}`)
            .join(",");
          const viewCheckQuery = `
            SELECT id FROM "${DB_TABLES.VIEWS}"
            WHERE id IN (${placeholders}) AND caseid = $${
            viewIdArray.length + 1
          }
          `;
          const viewCheckValues = [...viewIdArray, params.id || 0];

          const viewCheckResult = await pool.query(
            viewCheckQuery,
            viewCheckValues,
          );
          const existingViewIds = new Set(
            viewCheckResult.rows.map((row) => row.id),
          );

          for (const viewId of viewIdArray) {
            if (!existingViewIds.has(viewId)) {
              nonExistentViewIds.push(viewId);
            }
          }

          if (nonExistentViewIds.length > 0) {
            throw new Error(
              `The following viewId values do not exist in the database: ${nonExistentViewIds.join(
                ", ",
              )}. Make sure to use the actual IDs returned from saveView calls.`,
            );
          }
        }

        // Warn if there are collect information steps without viewIds
        if (hasCollectInfoSteps && missingViewIds > 0) {
          console.warn(
            `Warning: ${missingViewIds} "Collect information" steps are missing viewId references. These steps won't appear in the Views tab. Make sure to link all views to their corresponding steps.`,
          );
        }

        // Warn if there are non-collect information steps with viewIds
        if (invalidViewIds > 0) {
          console.warn(
            `Warning: ${invalidViewIds} non-"Collect information" steps have viewId references. These should be removed as only "Collect information" steps need views.`,
          );
        }

        if (params.id) {
          // Update existing case
          console.log(`saveCase: UPDATING existing case with ID ${params.id}`);
          const query = `
            UPDATE "${DB_TABLES.CASES}"
            SET name = $1, description = $2, model = $3
            WHERE id = $4
            RETURNING id, name, description, model
          `;
          const values = [
            params.name,
            params.description,
            JSON.stringify(params.model),
            params.id,
          ];
          console.log("saveCase UPDATE query:", query);
          console.log("saveCase UPDATE values:", values);

          const result = await pool.query(query, values);
          if (result.rowCount === 0) {
            console.error(`saveCase ERROR: No case found with id ${params.id}`);
            throw new Error(`No case found with id ${params.id}`);
          }
          console.log("saveCase UPDATE successful:", result.rows[0]);
          return result.rows[0];
        } else {
          // Create new case
          console.log("saveCase: CREATING new case (no ID provided)");
          const query = `
            INSERT INTO "${DB_TABLES.CASES}" (name, description, model)
            VALUES ($1, $2, $3)
            RETURNING id, name, description, model
          `;
          const values = [
            params.name,
            params.description,
            JSON.stringify(params.model),
          ];
          console.log("saveCase INSERT query:", query);
          console.log("saveCase INSERT values:", values);

          const result = await pool.query(query, values);
          console.log("saveCase INSERT successful:", result.rows[0]);
          return result.rows[0];
        }
      },
    },
    {
      name: "saveField",
      description:
        "Creates a new field or updates an existing field for the current case. If id is provided, updates the existing field. If no id is provided, creates a new field. CRITICAL: ALWAYS use listFields FIRST to check existing fields and avoid duplicate names. CRITICAL: Create fields for ACTUAL BUSINESS DATA, not workflow structure. DO NOT create generic fields like 'Stage1', 'Stage2', 'Step1', 'Step2', 'Stage1Name', 'Step1Description'. Create fields that represent real data to be collected from users. VALID FIELD NAME EXAMPLES: 'applicantName', 'email', 'phoneNumber', 'budget', 'startDate', 'cabinetStyle', 'countertopMaterial', 'loanAmount', 'employeeName', 'ticketNumber'. If you get a duplicate name error, either use a different name or provide the existing field's ID to update it.",
      execute: async (params: SaveFieldParams) => {
        console.log("=== saveField EXECUTION STARTED ===");
        console.log("saveField parameters:", JSON.stringify(params, null, 2));
        console.log("saveField called at:", new Date().toISOString());

        // Validate required parameters
        if (!params.name) {
          console.error("saveField ERROR: Field name is required");
          throw new Error("Field name is required for saveField");
        }
        if (!params.type) {
          console.error("saveField ERROR: Field type is required");
          throw new Error("Field type is required for saveField");
        }
        if (!params.caseID) {
          console.error("saveField ERROR: Case ID is required");
          throw new Error("Case ID is required for saveField");
        }
        if (!params.label) {
          console.error("saveField ERROR: Field label is required");
          throw new Error("Field label is required for saveField");
        }

        console.log("saveField validation passed");

        // Validate field type
        validateFieldTypeInLLM(params.type);

        // Validate field name to prevent generic stage/step fields
        validateFieldNameInLLM(params.name);

        // Check if case exists
        console.log(`saveField: Checking if case ${params.caseID} exists`);
        const caseCheck = await pool.query(
          `SELECT id FROM "${DB_TABLES.CASES}" WHERE id = $1`,
          [params.caseID],
        );
        if (caseCheck.rowCount === 0) {
          console.error(
            `saveField ERROR: No case found with id ${params.caseID}`,
          );
          throw new Error(`No case found with id ${params.caseID}`);
        }
        console.log("saveField: Case exists, proceeding with field creation");

        if (params.id) {
          // Update existing field
          const query = `
            UPDATE "${DB_TABLES.FIELDS}" SET
              name = $1,
              type = $2,
              "primary" = $3,
              caseid = $4,
              required = $5,
              label = $6,
              description = $7,
              "order" = $8,
              options = $9,
              "defaultValue" = $10
            WHERE id = $11
            RETURNING id, name, type, caseid, "primary", required,
                     label, description, "order", options, "defaultValue"
          `;
          const values = [
            params.name,
            params.type,
            params.primary || false,
            params.caseID,
            params.required || false,
            params.label,
            params.description || "",
            params.order || 0,
            JSON.stringify(params.options || []),
            params.defaultValue,
            params.id,
          ];
          const result = await pool.query(query, values);
          if (result.rowCount === 0) {
            throw new Error(`No field found with id ${params.id}`);
          }
          return result.rows[0];
        } else {
          // Check if field with same name already exists in this case
          const existingFieldCheck = await pool.query(
            `SELECT id, name FROM "${DB_TABLES.FIELDS}" WHERE name = $1 AND caseid = $2`,
            [params.name, params.caseID],
          );
          if (existingFieldCheck.rowCount && existingFieldCheck.rowCount > 0) {
            const existingField = existingFieldCheck.rows[0];
            // Instead of throwing an error, return the existing field
            console.log(
              `Field with name "${params.name}" already exists in case ${params.caseID} (ID: ${existingField.id}). Reusing existing field.`,
            );

            // Get the full field data to return
            const fullFieldQuery = `
              SELECT id, name, type, caseid, "primary", required,
                     label, description, "order", options, "defaultValue"
              FROM "${DB_TABLES.FIELDS}" WHERE id = $1
            `;
            const fullFieldResult = await pool.query(fullFieldQuery, [
              existingField.id,
            ]);
            return fullFieldResult.rows[0];
          }

          // Create new field
          const query = `
            INSERT INTO "${DB_TABLES.FIELDS}" (name, type, "primary", caseid, required, label, description, "order", options, "defaultValue")
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id, name, type, caseid, "primary", required,
                     label, description, "order", options, "defaultValue"
          `;
          const values = [
            params.name,
            params.type,
            params.primary || false,
            params.caseID,
            params.required || false,
            params.label,
            params.description || "",
            params.order || 0,
            JSON.stringify(params.options || []),
            params.defaultValue,
          ];
          const result = await pool.query(query, values);
          return result.rows[0];
        }
      },
    },
    {
      name: "saveView",
      description:
        "Creates a new view or updates an existing view for the current case. If id is provided, updates the existing view. If no id is provided, creates a new view. Only create views for 'Collect information' steps. Use listFields and listViews first to check existing items. Model must include fields array and layout object. View names should not include 'Form' suffix. The view name you create will be used as the step name in the workflow model. CRITICAL: The returned 'id' field MUST be used as the viewId in your workflow model - do not use hardcoded IDs!",
      execute: async (params: SaveViewParams) => {
        console.log("=== saveView EXECUTION STARTED ===");
        console.log("saveView parameters:", JSON.stringify(params, null, 2));
        console.log("saveView called at:", new Date().toISOString());

        // Validate required parameters
        if (!params.name) {
          console.error("saveView ERROR: View name is required");
          throw new Error("View name is required for saveView");
        }
        if (!params.caseID) {
          console.error("saveView ERROR: Case ID is required");
          throw new Error("Case ID is required for saveView");
        }
        if (!params.model) {
          console.error("saveView ERROR: View model is required");
          throw new Error("View model is required for saveView");
        }

        console.log("saveView validation passed");

        // Check if case exists
        console.log(`saveView: Checking if case ${params.caseID} exists`);
        const caseCheck = await pool.query(
          `SELECT id FROM "${DB_TABLES.CASES}" WHERE id = $1`,
          [params.caseID],
        );
        if (caseCheck.rowCount === 0) {
          console.error(
            `saveView ERROR: No case found with id ${params.caseID}`,
          );
          throw new Error(`No case found with id ${params.caseID}`);
        }
        console.log("saveView: Case exists, proceeding with view creation");

        // Validate view name
        if (params.name.toLowerCase().includes("form")) {
          console.warn(
            `Warning: View name "${
              params.name
            }" contains "form". Consider using a cleaner name like "${params.name
              .replace(/form/i, "")
              .trim()}"`,
          );
        }

        // Check if there are available fields in the case
        const availableFieldsCheck = await pool.query(
          `SELECT id, name FROM "${DB_TABLES.FIELDS}" WHERE caseid = $1`,
          [params.caseID],
        );

        // Validate field references
        if (params.model?.fields) {
          // Allow empty fields array
          if (params.model.fields.length > 0) {
            for (const field of params.model.fields) {
              const fieldCheck = await pool.query(
                `SELECT id FROM "${DB_TABLES.FIELDS}" WHERE id = $1 AND caseid = $2`,
                [field.fieldId, params.caseID],
              );
              if (fieldCheck.rowCount === 0) {
                throw new Error(
                  `Field with id ${field.fieldId} not found in case ${params.caseID}`,
                );
              }
            }
          } else if (
            availableFieldsCheck.rowCount &&
            availableFieldsCheck.rowCount > 0
          ) {
            // Warn about empty fields array when fields are available
            console.warn(
              `Warning: View "${params.name}" has empty fields array, but there are ${availableFieldsCheck.rowCount} available fields in case ${params.caseID}. Consider adding relevant fields to this view.`,
            );
          }
        } else {
          throw new Error(
            `View model must include a fields array (can be empty). Example: {fields: [], layout: {type: 'form', columns: 1}}`,
          );
        }

        // Validate layout
        if (!params.model?.layout) {
          throw new Error(
            `View model must include a layout object. Example: {fields: [{fieldId: 123, required: true, order: 1}], layout: {type: 'form', columns: 1}}`,
          );
        }

        if (!params.model.layout.type) {
          throw new Error(
            `View layout must include a type. Example: {type: 'form', columns: 1}`,
          );
        }

        if (params.id) {
          // Update existing view
          const query = `
            UPDATE "${DB_TABLES.VIEWS}" SET name = $1, caseid = $2, model = $3
            WHERE id = $4
            RETURNING id, name, caseid, model
          `;
          const values = [
            params.name,
            params.caseID,
            JSON.stringify(params.model),
            params.id,
          ];
          const result = await pool.query(query, values);
          if (result.rowCount === 0) {
            throw new Error(`No view found with id ${params.id}`);
          }
          return result.rows[0];
        } else {
          // Create new view
          const query = `
            INSERT INTO "${DB_TABLES.VIEWS}" (name, caseid, model)
            VALUES ($1, $2, $3)
            RETURNING id, name, caseid, model
          `;
          const values = [
            params.name,
            params.caseID,
            JSON.stringify(params.model),
          ];
          const result = await pool.query(query, values);
          return result.rows[0];
        }
      },
    },
    {
      name: "deleteCase",
      description:
        "Deletes a case and all its associated fields and views from the database. Required parameters: id (number). Example: deleteCase with id=123",
      execute: async (params: DeleteParams) => {
        // Check if case exists
        const caseCheck = await pool.query(
          `SELECT id FROM "${DB_TABLES.CASES}" WHERE id = $1`,
          [params.id],
        );
        if (caseCheck.rowCount === 0) {
          throw new Error(`No case found with id ${params.id}`);
        }

        // Delete the case (cascade will handle fields and views)
        const query = `
          DELETE FROM "${DB_TABLES.CASES}"
          WHERE id = $1
          RETURNING id, name
        `;
        const result = await pool.query(query, [params.id]);
        return {
          ...result.rows[0],
          message: `Successfully deleted case "${result.rows[0].name}" with ID ${result.rows[0].id}`,
        };
      },
    },
    {
      name: "deleteField",
      description:
        "Deletes a field from a case. Required parameters: id (number). Example: deleteField with id=123",
      execute: async (params: DeleteParams) => {
        // Check if field exists
        const fieldCheck = await pool.query(
          `SELECT id, name FROM "${DB_TABLES.FIELDS}" WHERE id = $1`,
          [params.id],
        );
        if (fieldCheck.rowCount === 0) {
          throw new Error(`No field found with id ${params.id}`);
        }

        // Delete the field
        const query = `
          DELETE FROM "${DB_TABLES.FIELDS}"
          WHERE id = $1
          RETURNING id, name
        `;
        const result = await pool.query(query, [params.id]);
        return {
          ...result.rows[0],
          message: `Successfully deleted field "${result.rows[0].name}" with ID ${result.rows[0].id}`,
        };
      },
    },
    {
      name: "deleteView",
      description:
        "Deletes a view from a case. Required parameters: id (number). Example: deleteView with id=123",
      execute: async (params: DeleteParams) => {
        // Check if view exists
        const viewCheck = await pool.query(
          `SELECT id, name FROM "${DB_TABLES.VIEWS}" WHERE id = $1`,
          [params.id],
        );
        if (viewCheck.rowCount === 0) {
          throw new Error(`No view found with id ${params.id}`);
        }

        // Delete the view
        const query = `
          DELETE FROM "${DB_TABLES.VIEWS}"
          WHERE id = $1
          RETURNING id, name
        `;
        const result = await pool.query(query, [params.id]);
        return {
          ...result.rows[0],
          message: `Successfully deleted view "${result.rows[0].name}" with ID ${result.rows[0].id}`,
        };
      },
    },
    {
      name: "listFields",
      description:
        "Lists all fields for a specific case. CRITICAL: Use this FIRST before creating new fields to avoid duplicate names and to reuse existing fields. Required parameters: caseID (number). Example: listFields with caseID=123. This helps you see what fields already exist so you can reuse them in views instead of creating duplicates.",
      execute: async (params: { caseID: number }) => {
        const query = `
          SELECT id, name, type, label, "primary", required, "order"
          FROM "${DB_TABLES.FIELDS}"
          WHERE caseid = $1
          ORDER BY "order", name
        `;
        const result = await pool.query(query, [params.caseID]);
        return {
          fields: result.rows,
          count: result.rows.length,
          message: `Found ${result.rows.length} fields for case ${params.caseID}`,
        };
      },
    },
    {
      name: "listViews",
      description:
        "Lists all views for a specific case. CRITICAL: Use this FIRST before creating new views to avoid duplicate names and to reuse existing views. Required parameters: caseID (number). Example: listViews with caseID=123. This helps you see what views already exist so you can reuse them or create variations instead of duplicates.",
      execute: async (params: { caseID: number }) => {
        const query = `
          SELECT id, name, model
          FROM "${DB_TABLES.VIEWS}"
          WHERE caseid = $1
          ORDER BY name
        `;
        const result = await pool.query(query, [params.caseID]);
        return {
          views: result.rows,
          count: result.rows.length,
          message: `Found ${result.rows.length} views for case ${params.caseID}`,
        };
      },
    },
    {
      name: "getCase",
      description:
        "Gets the details of a specific case including its workflow model. CRITICAL: Use this FIRST before any other operations to see the current workflow structure. Required parameters: id (number). Example: getCase with id=123",
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

        const response = {
          ...caseData,
          model,
          steps,
          stepCount: steps.length,
          message: `Found case "${caseData.name}" with ${steps.length} steps`,
        };

        console.log("getCase response:", {
          stepCount: steps.length,
          message: response.message,
        });

        return response;
      },
    },
  ];
}
