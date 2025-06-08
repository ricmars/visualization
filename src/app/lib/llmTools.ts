import { Pool } from "pg";
import { DB_TABLES } from "../types/database";
import { validateFieldType, FIELD_TYPES } from "../types/database";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export interface LLMTool {
  name: string;
  description: string;
  execute: (params: any) => Promise<any>;
}

// Helper function to validate case name uniqueness
async function validateCaseName(
  _name: string,
  _excludeId?: number,
): Promise<void> {
  // Case names don't need to be unique - we use IDs for operations
  return;
}

// Helper function to validate field type
function validateFieldTypeInLLM(type: string): void {
  if (!validateFieldType(type)) {
    throw new Error(
      `Invalid field type. Must be one of: ${Object.values(FIELD_TYPES).join(
        ", ",
      )}`,
    );
  }
}

// Helper function to validate view name pattern
function validateViewName(name: string, stepName?: string): void {
  if (!stepName) {
    // If no stepName is provided, just ensure the name ends with "Form"
    if (!name.endsWith("Form")) {
      throw new Error('View name must end with "Form"');
    }
    return;
  }

  const expectedPattern = `${stepName}Form`;
  if (name !== expectedPattern) {
    throw new Error(`View name must follow the pattern: ${expectedPattern}`);
  }
}

export const databaseTools: LLMTool[] = [
  {
    name: "createCase",
    description:
      "Creates a new case in the database (ONLY for initial workflow creation). Required parameters: name (string), description (string), model (object with stages array). Example: createCase with name='Home Loan', description='Process for home loan applications', model={stages: [{id: 'stage1', name: 'Application', order: 1, processes: [{id: 'process1', name: 'Basic Information', order: 1, steps: [{id: 'step1', type: 'Collect information', name: 'Applicant Details', order: 1}]}]}]}",
    execute: async (params: {
      name: string;
      description: string;
      model: any;
    }) => {
      // Validate model structure
      if (!params.model?.stages) {
        throw new Error("Model must include stages array");
      }

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
      const result = await pool.query(query, values);

      // Return the created case with its ID
      return {
        ...result.rows[0],
        id: result.rows[0].id,
        message: `Successfully created case "${params.name}" with ID ${result.rows[0].id}`,
      };
    },
  },
  {
    name: "updateCase",
    description:
      "Updates an existing case in the database. Required parameters: id (number), name (string), description (string), model (object with stages array). Example: updateCase with id=1, name='Home Loan', description='Process for home loan applications', model={stages: [{id: 'stage1', name: 'Application', order: 1, processes: [{id: 'process1', name: 'Basic Information', order: 1, steps: [{id: 'step1', type: 'Collect information', name: 'Applicant Details', order: 1}]}]}]}",
    execute: async (params: {
      id: number;
      name: string;
      description: string;
      model: any;
    }) => {
      // Validate case name uniqueness (excluding current case)
      await validateCaseName(params.name, params.id);

      // Validate model structure
      if (!params.model?.stages) {
        throw new Error("Model must include stages array");
      }

      // Validate view IDs for collect_information steps
      const viewIds = new Set<string>();
      for (const stage of params.model.stages) {
        for (const process of stage.processes) {
          for (const step of process.steps) {
            if (step.type === "Collect information") {
              if (!step.viewId) {
                throw new Error(
                  `Step "${step.name}" of type "Collect information" must have a viewId`,
                );
              }
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
      const result = await pool.query(query, values);
      if (result.rowCount === 0) {
        throw new Error(`No case found with id ${params.id}`);
      }
      return result.rows[0];
    },
  },
  {
    name: "createField",
    description:
      "Creates a new field for the current case. Required parameters: name (string), type (string), caseID (number), primary (boolean, optional). Example: createField with name='applicantName', type='Text', caseID=123, primary=true",
    execute: async (params: {
      name: string;
      type: string;
      caseID: number;
      primary?: boolean;
      required?: boolean;
      label: string;
      description?: string;
      order?: number;
      options?: any[];
      defaultValue?: any;
    }) => {
      // Validate field type
      validateFieldTypeInLLM(params.type);

      // Check if case exists
      const caseCheck = await pool.query(
        `SELECT id FROM "${DB_TABLES.CASES}" WHERE id = $1`,
        [params.caseID],
      );
      if (caseCheck.rowCount === 0) {
        throw new Error(`No case found with id ${params.caseID}`);
      }

      const query = `
        INSERT INTO "${DB_TABLES.FIELDS}" (
          name, type, "primary", caseid, required, label,
          description, "order", options, "defaultValue"
        )
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
    },
  },
  {
    name: "createView",
    description:
      "Creates a new view for the current case. Required parameters: name (string), caseID (number), model (object with fields array). Example: createView with name='Applicant Details Form', caseID=123, model={fields: [{fieldId: 123, required: true, order: 1}], layout: {type: 'form', columns: 1}}",
    execute: async (params: {
      name: string;
      caseID: number;
      model: any;
      stepName: string; // Added to validate view name pattern
    }) => {
      // Validate view name pattern
      validateViewName(params.name, params.stepName);

      // Check if case exists
      const caseCheck = await pool.query(
        `SELECT id FROM "${DB_TABLES.CASES}" WHERE id = $1`,
        [params.caseID],
      );
      if (caseCheck.rowCount === 0) {
        throw new Error(`No case found with id ${params.caseID}`);
      }

      // Validate field references
      if (params.model?.fields) {
        for (const field of params.model.fields) {
          const fieldCheck = await pool.query(
            `SELECT id FROM "${DB_TABLES.FIELDS}" WHERE id = $1 AND "caseID" = $2`,
            [field.fieldId, params.caseID],
          );
          if (fieldCheck.rowCount === 0) {
            throw new Error(
              `Field with id ${field.fieldId} not found in case ${params.caseID}`,
            );
          }
        }
      }

      const query = `
        INSERT INTO "${DB_TABLES.VIEWS}" (name, caseid, model)
        VALUES ($1, $2, $3)
        RETURNING id, name, caseid, model
      `;
      const values = [params.name, params.caseID, JSON.stringify(params.model)];
      const result = await pool.query(query, values);
      return result.rows[0];
    },
  },
  {
    name: "deleteCase",
    description:
      "Deletes a case and all its associated fields and views from the database. Required parameters: id (number). Example: deleteCase with id=123",
    execute: async (params: { id: number }) => {
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
    execute: async (params: { id: number }) => {
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
];
