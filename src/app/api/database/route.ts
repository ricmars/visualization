import { NextRequest, NextResponse } from "next/server";
import { pool, initializeDatabase } from "../../lib/db";
import { checkpointManager } from "../../lib/db";
import {
  DB_COLUMNS,
  DB_TABLES,
  validateFieldType,
  validateCaseId,
  ensureIntegerId,
  stringifyModel,
} from "@/app/types/database";

// Initialize database tables
let isInitialized = false;

async function ensureInitialized() {
  if (!isInitialized) {
    try {
      await initializeDatabase();
      isInitialized = true;
    } catch (error) {
      console.error("Failed to initialize database:", error);
      throw error;
    }
  }
}

interface CaseInput {
  name: string;
  description: string;
  model: {
    stages: {
      id: number;
      name: string;
      order: number;
      processes: {
        id: number;
        name: string;
        order: number;
        steps: {
          id: number;
          type: string;
          name: string;
          order: number;
          viewId?: number;
        }[];
      }[];
    }[];
  };
}

interface FieldInput {
  name: string;
  type: string;
  primary: boolean;
  caseID: number;
  label: string;
  description: string;
  order: number;
  options: string[];
  required: boolean;
}

interface ViewInput {
  name: string;
  caseID: number;
  model: {
    fields: {
      fieldId: number;
      required?: boolean;
      order?: number;
    }[];
    layout: {
      type: string;
      columns: number;
    };
  };
}

function validateCase(data: CaseInput) {
  console.log("=== Validating Case Input ===");
  console.log("Input data:", {
    name: data.name,
    description: data.description,
    model: typeof data.model === "string" ? "string" : typeof data.model,
  });

  if (!data.name) throw new Error("Missing required field: name");
  if (!data.description) throw new Error("Missing required field: description");
  if (!data.model) throw new Error("Missing required field: model");

  // Parse model if it's a string
  let parsedModel;
  try {
    parsedModel =
      typeof data.model === "string" ? JSON.parse(data.model) : data.model;
    console.log("Parsed model:", {
      type: typeof parsedModel,
      hasStages: !!parsedModel?.stages,
      stagesType: Array.isArray(parsedModel?.stages)
        ? "array"
        : typeof parsedModel?.stages,
    });
  } catch (error) {
    console.error("Failed to parse model:", error);
    throw new Error("Invalid model JSON format");
  }

  if (!Array.isArray(parsedModel.stages)) {
    console.error("Model validation failed:", {
      model: parsedModel,
      stagesType: typeof parsedModel.stages,
    });
    throw new Error("Model must include stages array");
  }
}

// Enhanced checkpoint creation for database operations
async function createDatabaseCheckpoint(
  operation: string,
  tableName: string,
  caseId?: number,
  description?: string,
): Promise<string | null> {
  try {
    // Only create checkpoints for modification operations on tracked tables
    const modificationOps = ["POST", "PUT", "DELETE"];
    const trackedTables = [DB_TABLES.CASES, DB_TABLES.FIELDS, DB_TABLES.VIEWS];

    if (
      !modificationOps.includes(operation) ||
      !trackedTables.includes(tableName as any)
    ) {
      return null;
    }

    // For operations without a caseId, try to determine it from context
    let checkpointCaseId = caseId;
    if (!checkpointCaseId && tableName === DB_TABLES.CASES) {
      // For case operations, we'll set the caseId after the operation
      checkpointCaseId = 1; // Temporary, will be updated
    }

    if (!checkpointCaseId) {
      console.log("No case ID available for checkpoint creation, skipping");
      return null;
    }

    const checkpointDescription =
      description || `Database ${operation} on ${tableName}`;
    const userCommand = `Database API: ${operation} ${tableName}`;

    return await checkpointManager.beginCheckpoint(
      checkpointCaseId,
      checkpointDescription,
      userCommand,
      "API",
    );
  } catch (error) {
    console.warn("Failed to create database checkpoint:", error);
    return null;
  }
}

// Enhanced operation logging for database changes
async function logDatabaseOperation(
  checkpointId: string,
  operation: "insert" | "update" | "delete",
  tableName: string,
  primaryKey: any,
  previousData?: any,
  caseId?: number,
): Promise<void> {
  try {
    if (!caseId) {
      console.warn("No case ID for operation logging, skipping");
      return;
    }

    await checkpointManager.logOperation(
      checkpointId,
      caseId,
      operation,
      tableName,
      primaryKey,
      previousData,
    );
  } catch (error) {
    console.warn("Failed to log database operation:", error);
  }
}

function validateField(data: FieldInput) {
  if (!data.name) throw new Error("Missing required field: name");
  if (!data.type) throw new Error("Missing required field: type");
  if (!validateFieldType(data.type)) {
    throw new Error(`Invalid field type: ${data.type}`);
  }
  if (typeof data.primary !== "boolean") {
    throw new Error("Missing required field: primary");
  }
  if (!data.caseID) throw new Error("Missing required field: caseID");
  if (!data.label) throw new Error("Missing required field: label");
  if (!data.description) throw new Error("Missing required field: description");
  if (typeof data.order !== "number") {
    throw new Error("Missing required field: order");
  }

  // Handle options that might be a string (from database) or array (from frontend)
  if (typeof data.options === "string") {
    try {
      JSON.parse(data.options);
    } catch {
      throw new Error("Invalid options format");
    }
  } else if (!Array.isArray(data.options)) {
    throw new Error("Missing required field: options");
  }

  if (typeof data.required !== "boolean") {
    throw new Error("Missing required field: required");
  }
}

function validateView(data: ViewInput) {
  if (!data.name) throw new Error("Missing required field: name");
  if (!data.caseID) throw new Error("Missing required field: caseID");
  if (!data.model) throw new Error("Missing required field: model");
  if (!Array.isArray(data.model.fields)) {
    throw new Error("Model must include fields array");
  }
  if (!data.model.layout) {
    throw new Error("Model must include layout");
  }
  if (!data.model.layout.type) {
    throw new Error("Layout must include type");
  }
  if (typeof data.model.layout.columns !== "number") {
    throw new Error("Layout must include columns");
  }
}

export async function GET(request: NextRequest) {
  try {
    await ensureInitialized();
    const { searchParams } = new URL(request.url);
    const table = searchParams.get("table");
    const id = searchParams.get("id");
    const caseID = searchParams.get(DB_COLUMNS.CASE_ID);

    if (
      !table ||
      !Object.values(DB_TABLES).includes(
        table as (typeof DB_TABLES)[keyof typeof DB_TABLES],
      )
    ) {
      return NextResponse.json(
        { error: "Invalid table parameter" },
        { status: 400 },
      );
    }

    // Validate the ID parameter
    if (id && isNaN(parseInt(id))) {
      console.error("Invalid ID provided:", id);
      return NextResponse.json(
        { error: "Invalid ID provided" },
        { status: 400 },
      );
    }

    // Log the ID for debugging
    console.log("Fetching data with ID:", id);

    let query;
    let values: unknown[] = [];

    if (id) {
      const validatedId = ensureIntegerId(id);
      query = `SELECT * FROM "${table}" WHERE ${DB_COLUMNS.ID} = $1`;
      values = [validatedId];
    } else if (
      caseID &&
      (table === DB_TABLES.FIELDS || table === DB_TABLES.VIEWS)
    ) {
      const validatedCaseId = validateCaseId(caseID);
      if (table === DB_TABLES.FIELDS) {
        query = `SELECT * FROM "${table}" WHERE ${DB_COLUMNS.CASE_ID} = $1 ORDER BY "order", name`;
      } else {
        query = `SELECT * FROM "${table}" WHERE ${DB_COLUMNS.CASE_ID} = $1 ORDER BY name`;
      }
      values = [validatedCaseId];
    } else {
      query = `SELECT * FROM "${table}"`;
    }

    const result = await pool.query(query, values);
    return NextResponse.json({ data: id ? result.rows[0] : result.rows });
  } catch (error) {
    console.error("Error fetching data:", error);
    return NextResponse.json(
      { error: "Failed to fetch data" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const table = searchParams.get("table");
    console.log("=== POST Request ===");
    console.log("Table:", table);
    console.log("Request URL:", request.url);

    if (!table) {
      console.error("Missing table parameter");
      return NextResponse.json(
        { error: "Table parameter is required" },
        { status: 400 },
      );
    }

    const data = await request.json();
    console.log("Request body:", {
      ...data,
      model: typeof data.model === "string" ? "string" : typeof data.model,
    });

    switch (table) {
      case DB_TABLES.CASES: {
        console.log("=== Processing Case Creation ===");
        const { name, description, model } = data;
        console.log("Case data:", {
          name,
          description,
          modelType: typeof model,
        });

        try {
          validateCase({ name, description, model });
        } catch (error) {
          console.error("Case validation error:", error);
          return NextResponse.json(
            {
              error:
                error instanceof Error ? error.message : "Validation failed",
            },
            { status: 400 },
          );
        }

        console.log("Executing database query...");
        const result = await pool.query(
          `INSERT INTO "${DB_TABLES.CASES}" (name, description, model) VALUES ($1, $2, $3) RETURNING *`,
          [
            name,
            description,
            typeof model === "string" ? model : JSON.stringify(model),
          ],
        );

        const newCaseId = result.rows[0].id;
        console.log("Case created successfully:", {
          id: newCaseId,
          name: result.rows[0].name,
        });

        // Create checkpoint for case creation
        const checkpointId = await createDatabaseCheckpoint(
          "POST",
          table,
          newCaseId,
          `Create new case: ${name}`,
        );

        // Log the insert operation
        if (checkpointId) {
          await logDatabaseOperation(
            checkpointId,
            "insert",
            table,
            { id: newCaseId },
            undefined,
            newCaseId,
          );
          // Commit the checkpoint immediately for UI operations
          await checkpointManager.commitCheckpoint(checkpointId);
        }

        return NextResponse.json(result.rows[0]);
      }

      case DB_TABLES.FIELDS: {
        console.log("=== Processing Field Creation ===");
        console.log("Raw data received:", data);

        const fieldData = data.data || data;
        const {
          type,
          name,
          primary,
          caseID: inputCaseId,
          label,
          description,
          order,
          options,
          required,
        } = fieldData;

        console.log("Destructured values:", {
          type,
          name,
          inputCaseId,
          label,
          description,
          order,
          options,
          required,
          primary,
        });

        if (!type || !name || !inputCaseId || !label) {
          console.log("Validation failed - missing fields:", {
            hasType: !!type,
            hasName: !!name,
            hasCaseId: !!inputCaseId,
            hasLabel: !!label,
          });
          return NextResponse.json(
            { error: "Type, name, caseID, and label are required" },
            { status: 400 },
          );
        }

        if (!validateFieldType(type)) {
          return NextResponse.json(
            { error: "Invalid field type" },
            { status: 400 },
          );
        }

        const validatedCaseId = validateCaseId(inputCaseId);
        const result = await pool.query(
          `INSERT INTO "${DB_TABLES.FIELDS}" (type, name, "primary", caseid, label, description, "order", options, required) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
          [
            type,
            name,
            primary || false,
            validatedCaseId,
            label,
            description || "",
            order || 0,
            options ? stringifyModel(options) : "[]",
            required || false,
          ],
        );

        const newFieldId = result.rows[0].id;

        // Create checkpoint for field creation
        const checkpointId = await createDatabaseCheckpoint(
          "POST",
          table,
          validatedCaseId,
          `Create field: ${name}`,
        );

        // Log the insert operation
        if (checkpointId) {
          await logDatabaseOperation(
            checkpointId,
            "insert",
            table,
            { id: newFieldId },
            undefined,
            validatedCaseId,
          );
          // Commit the checkpoint immediately for UI operations
          await checkpointManager.commitCheckpoint(checkpointId);
        }

        return NextResponse.json(result.rows[0]);
      }

      case DB_TABLES.VIEWS: {
        const { name, model, caseID: inputCaseId } = data;
        if (!name || !model || !inputCaseId) {
          return NextResponse.json(
            { error: "Name, model, and caseID are required" },
            { status: 400 },
          );
        }

        const validatedCaseId = validateCaseId(inputCaseId);
        const result = await pool.query(
          `INSERT INTO "${DB_TABLES.VIEWS}" (name, model, caseid) VALUES ($1, $2, $3) RETURNING *`,
          [name, stringifyModel(model), validatedCaseId],
        );

        const newViewId = result.rows[0].id;

        // Create checkpoint for view creation
        const checkpointId = await createDatabaseCheckpoint(
          "POST",
          table,
          validatedCaseId,
          `Create view: ${name}`,
        );

        // Log the insert operation
        if (checkpointId) {
          await logDatabaseOperation(
            checkpointId,
            "insert",
            table,
            { id: newViewId },
            undefined,
            validatedCaseId,
          );
          // Commit the checkpoint immediately for UI operations
          await checkpointManager.commitCheckpoint(checkpointId);
        }

        return NextResponse.json(result.rows[0]);
      }

      default:
        return NextResponse.json({ error: "Invalid table" }, { status: 400 });
    }
  } catch (error) {
    console.error("Error creating data:", error);
    return NextResponse.json(
      { error: "Failed to create data" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    await ensureInitialized();
    const { searchParams } = new URL(request.url);
    const table = searchParams.get("table");
    const id = searchParams.get("id");

    console.log("PUT request received:", {
      table,
      id,
      url: request.url,
    });

    if (
      !table ||
      !Object.values(DB_TABLES).includes(
        table as (typeof DB_TABLES)[keyof typeof DB_TABLES],
      )
    ) {
      console.error("Invalid table parameter:", table);
      return NextResponse.json(
        { error: "Invalid table parameter" },
        { status: 400 },
      );
    }

    if (!id) {
      console.error("Missing id parameter");
      return NextResponse.json(
        { error: "Missing id parameter" },
        { status: 400 },
      );
    }

    const data = await request.json();
    console.log("PUT request data:", {
      table,
      id,
      data,
    });

    switch (table) {
      case DB_TABLES.CASES: {
        const caseData = data.data || data;
        const { name, description, model } = caseData;
        const validatedId = ensureIntegerId(id);

        console.log("Processing case update:", {
          name,
          description,
          model: typeof model === "string" ? "string" : typeof model,
        });

        if (!name || !description) {
          console.error("Missing required fields:", { name, description });
          return NextResponse.json(
            { error: "Name and description are required" },
            { status: 400 },
          );
        }

        if (typeof model !== "string") {
          console.error("Model must be a string:", typeof model);
          return NextResponse.json(
            { error: "Model must be a string" },
            { status: 400 },
          );
        }

        try {
          // Parse and validate the model
          const parsedModel = JSON.parse(model);
          validateCase({
            name,
            description,
            model: parsedModel,
          });
        } catch (error) {
          console.error("Invalid model JSON or validation failed:", error);
          return NextResponse.json(
            {
              error:
                error instanceof Error ? error.message : "Invalid model JSON",
            },
            { status: 400 },
          );
        }

        // Create checkpoint for workflow model update
        const checkpointId = await createDatabaseCheckpoint(
          "PUT",
          table,
          validatedId,
          `Update workflow model for case ${validatedId}`,
        );

        try {
          // Capture previous data before update
          let previousData = null;
          if (checkpointId) {
            const previousResult = await pool.query(
              `SELECT * FROM "${table}" WHERE id = $1`,
              [validatedId],
            );
            previousData = previousResult.rows[0] || null;
          }

          const result = await pool.query(
            `UPDATE "${table}" SET name = $1, description = $2, model = $3 WHERE id = $4 RETURNING *`,
            [name, description, model, validatedId],
          );

          console.log("Case update result:", {
            rowCount: result.rowCount,
            rows: result.rows,
          });

          if (result.rowCount === 0) {
            if (checkpointId) {
              await checkpointManager.rollbackCheckpoint(checkpointId);
            }
            console.error("No case found with id:", validatedId);
            return NextResponse.json(
              { error: "Case not found" },
              { status: 404 },
            );
          }

          // Log the operation for checkpoint tracking
          if (checkpointId && previousData) {
            await logDatabaseOperation(
              checkpointId,
              "update",
              table,
              { id: validatedId },
              previousData,
              validatedId,
            );
            // Commit the checkpoint immediately for UI operations
            await checkpointManager.commitCheckpoint(checkpointId);
          }

          return NextResponse.json({ data: result.rows[0] });
        } catch (updateError) {
          // Rollback checkpoint on error
          if (checkpointId) {
            try {
              await checkpointManager.rollbackCheckpoint(checkpointId);
            } catch (rollbackError) {
              console.error("Failed to rollback checkpoint:", rollbackError);
            }
          }
          throw updateError;
        }
      }

      case DB_TABLES.FIELDS: {
        const fieldData = data.data || data;
        validateField(fieldData as FieldInput);
        const validatedId = ensureIntegerId(id);
        const result = await pool.query(
          `UPDATE "${DB_TABLES.FIELDS}" SET
            name = $1,
            type = $2,
            "primary" = $3,
            caseid = $4,
            label = $5,
            description = $6,
            "order" = $7,
            options = $8,
            required = $9
          WHERE id = $10 RETURNING *`,
          [
            fieldData.name,
            fieldData.type,
            fieldData.primary || false,
            fieldData.caseID,
            fieldData.label,
            fieldData.description || "",
            fieldData.order || 0,
            fieldData.options
              ? typeof fieldData.options === "string"
                ? fieldData.options
                : stringifyModel(fieldData.options)
              : "[]",
            fieldData.required || false,
            validatedId,
          ],
        );

        if (result.rowCount === 0) {
          return NextResponse.json(
            { error: "Field not found" },
            { status: 404 },
          );
        }

        return NextResponse.json({ data: result.rows[0] });
      }

      case DB_TABLES.VIEWS: {
        validateView(data as ViewInput);
        const validatedId = ensureIntegerId(id);
        const result = await pool.query(
          `UPDATE "${DB_TABLES.VIEWS}" SET name = $1, caseid = $2, model = $3 WHERE id = $4 RETURNING *`,
          [
            data.name,
            validateCaseId(data.caseID),
            stringifyModel(data.model),
            validatedId,
          ],
        );
        return NextResponse.json(result.rows[0]);
      }

      default:
        return NextResponse.json({ error: "Invalid table" }, { status: 400 });
    }
  } catch (error) {
    console.error("Error updating data:", error);
    return NextResponse.json(
      { error: "Failed to update data" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    await ensureInitialized();
    const { searchParams } = new URL(request.url);
    const table = searchParams.get("table");
    const id = searchParams.get("id");

    if (
      !table ||
      !Object.values(DB_TABLES).includes(
        table as (typeof DB_TABLES)[keyof typeof DB_TABLES],
      )
    ) {
      return NextResponse.json(
        { error: "Invalid table parameter" },
        { status: 400 },
      );
    }

    if (!id) {
      return NextResponse.json(
        { error: "Missing required id parameter" },
        { status: 400 },
      );
    }

    const validatedId = ensureIntegerId(id);

    // Determine case ID for checkpoint (for Fields and Views, we need to find the parent case)
    let caseId = validatedId;
    if (table === DB_TABLES.FIELDS || table === DB_TABLES.VIEWS) {
      const caseResult = await pool.query(
        `SELECT caseid FROM "${table}" WHERE id = $1`,
        [validatedId],
      );
      caseId = caseResult.rows[0]?.caseid || validatedId;
    }

    // Create checkpoint for deletion
    const checkpointId = await createDatabaseCheckpoint(
      "DELETE",
      table,
      caseId,
      `Delete ${table.toLowerCase().slice(0, -1)} ${validatedId}`,
    );

    // Capture previous data before deletion
    let previousData = null;
    if (checkpointId) {
      const previousResult = await pool.query(
        `SELECT * FROM "${table}" WHERE id = $1`,
        [validatedId],
      );
      previousData = previousResult.rows[0] || null;
    }

    let query;
    if (table === DB_TABLES.CASES) {
      query = `
        DELETE FROM "${DB_TABLES.CASES}"
        WHERE ${DB_COLUMNS.ID} = $1
        RETURNING ${DB_COLUMNS.ID}
      `;
    } else if (table === DB_TABLES.FIELDS) {
      query = `
        DELETE FROM "${DB_TABLES.FIELDS}"
        WHERE ${DB_COLUMNS.ID} = $1
        RETURNING ${DB_COLUMNS.ID}
      `;
    } else {
      query = `
        DELETE FROM "${DB_TABLES.VIEWS}"
        WHERE ${DB_COLUMNS.ID} = $1
        RETURNING ${DB_COLUMNS.ID}
      `;
    }

    console.log("Executing query:", query);
    const result = await pool.query(query, [validatedId]);
    console.log("Query result:", result.rows);

    if (result.rows.length === 0) {
      if (checkpointId) {
        await checkpointManager.rollbackCheckpoint(checkpointId);
      }
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    // Log the delete operation
    if (checkpointId && previousData) {
      await logDatabaseOperation(
        checkpointId,
        "delete",
        table,
        { id: validatedId },
        previousData,
        caseId,
      );
      // Commit the checkpoint immediately for UI operations
      await checkpointManager.commitCheckpoint(checkpointId);
    }

    return NextResponse.json({ data: result.rows[0] });
  } catch (error) {
    console.error("Database error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
