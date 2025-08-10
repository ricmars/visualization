import { Pool } from "pg";
import {
  ruleTypeRegistry,
  RuleTypeDefinition,
} from "../types/ruleTypeRegistry";
import { checkpointManager, pool } from "./db";

export interface DatabaseOperation {
  operation: "create" | "read" | "update" | "delete" | "list";
  ruleTypeId: string;
  data?: any;
  id?: number;
  filters?: Record<string, any>;
  options?: {
    limit?: number;
    offset?: number;
    orderBy?: string;
    orderDirection?: "ASC" | "DESC";
  };
}

export interface DatabaseResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  affectedRows?: number;
}

export class DynamicDatabaseService {
  constructor(private pool: Pool) {}

  /**
   * Execute a database operation for any rule type
   */
  async execute<T = any>(
    operation: DatabaseOperation,
  ): Promise<DatabaseResult<T>> {
    try {
      const ruleType = ruleTypeRegistry.get(operation.ruleTypeId);
      if (!ruleType) {
        return {
          success: false,
          error: `Rule type '${operation.ruleTypeId}' not found`,
        };
      }

      // Execute hooks before operation
      if (
        operation.data &&
        ruleType.hooks?.beforeCreate &&
        operation.operation === "create"
      ) {
        operation.data = await this.executeHook(
          ruleType.hooks.beforeCreate,
          operation.data,
        );
      }
      if (
        operation.data &&
        ruleType.hooks?.beforeUpdate &&
        operation.operation === "update"
      ) {
        operation.data = await this.executeHook(
          ruleType.hooks.beforeUpdate,
          operation.data,
          operation.id,
        );
      }
      if (ruleType.hooks?.beforeDelete && operation.operation === "delete") {
        const shouldProceed = await this.executeHook(
          ruleType.hooks.beforeDelete,
          operation.id,
        );
        if (!shouldProceed) {
          return {
            success: false,
            error: "Delete operation cancelled by hook",
          };
        }
      }

      // Validate data if provided
      if (operation.data) {
        const validationResult = await this.validateData(
          ruleType,
          operation.data,
        );
        if (!validationResult.valid) {
          return {
            success: false,
            error: `Validation failed: ${validationResult.errors.join(", ")}`,
          };
        }
      }

      // Execute the database operation
      let result: DatabaseResult<T>;
      switch (operation.operation) {
        case "create":
          result = await this.create(ruleType, operation.data);
          break;
        case "read":
          result = await this.read(ruleType, operation.id!);
          break;
        case "update":
          result = await this.update(ruleType, operation.id!, operation.data);
          break;
        case "delete":
          result = await this.delete(ruleType, operation.id!);
          break;
        case "list":
          result = (await this.list(
            ruleType,
            operation.filters,
            operation.options,
          )) as DatabaseResult<T>;
          break;
        default:
          return {
            success: false,
            error: `Unsupported operation: ${operation.operation}`,
          };
      }

      // Execute hooks after operation
      if (result.success && result.data) {
        if (ruleType.hooks?.afterCreate && operation.operation === "create") {
          await this.executeHook(
            ruleType.hooks.afterCreate,
            operation.data,
            (result.data as any).id,
          );
        }
        if (ruleType.hooks?.afterUpdate && operation.operation === "update") {
          await this.executeHook(
            ruleType.hooks.afterUpdate,
            operation.data,
            operation.id,
          );
        }
        if (ruleType.hooks?.afterDelete && operation.operation === "delete") {
          await this.executeHook(ruleType.hooks.afterDelete, operation.id);
        }
      }

      return result;
    } catch (error) {
      console.error("Dynamic database operation failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Create a new record
   */
  private async create<T>(
    ruleType: RuleTypeDefinition,
    data: any,
  ): Promise<DatabaseResult<T>> {
    const tableName = ruleType.databaseSchema.tableName;
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = values.map((_, index) => `$${index + 1}`).join(", ");

    const query = `
      INSERT INTO "${tableName}" (${columns
      .map((col) => `"${col}"`)
      .join(", ")})
      VALUES (${placeholders})
      RETURNING *
    `;

    try {
      // Create checkpoint for tracking
      const checkpointId = await this.createCheckpoint(
        ruleType.id,
        "create",
        data,
      );

      const result = await this.pool.query(query, values);

      if (result.rows.length > 0) {
        // Log the operation
        if (checkpointId) {
          await this.logOperation(
            checkpointId,
            "insert",
            tableName,
            { id: result.rows[0].id },
            undefined,
            data.caseid,
          );
        }

        return {
          success: true,
          data: result.rows[0] as T,
          affectedRows: 1,
        };
      }

      return {
        success: false,
        error: "No data returned from insert",
      };
    } catch (error) {
      console.error(`Failed to create ${ruleType.name}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Read a record by ID
   */
  private async read<T>(
    ruleType: RuleTypeDefinition,
    id: number,
  ): Promise<DatabaseResult<T>> {
    const tableName = ruleType.databaseSchema.tableName;
    const query = `SELECT * FROM "${tableName}" WHERE id = $1`;

    try {
      const result = await this.pool.query(query, [id]);

      if (result.rows.length > 0) {
        return {
          success: true,
          data: result.rows[0] as T,
        };
      }

      return {
        success: false,
        error: `${ruleType.name} with ID ${id} not found`,
      };
    } catch (error) {
      console.error(`Failed to read ${ruleType.name}:`, error);
      throw error;
    }
  }

  /**
   * Update a record
   */
  private async update<T>(
    ruleType: RuleTypeDefinition,
    id: number,
    data: any,
  ): Promise<DatabaseResult<T>> {
    const tableName = ruleType.databaseSchema.tableName;

    // Remove the id field from the data since it's the primary key and shouldn't be updated
    const { id: _, ...updateData } = data;
    const columns = Object.keys(updateData);
    const values = Object.values(updateData);

    if (columns.length === 0) {
      return {
        success: false,
        error: "No fields to update",
      };
    }

    const setClause = columns
      .map((col, index) => `"${col}" = $${index + 2}`)
      .join(", ");
    const query = `
      UPDATE "${tableName}"
      SET ${setClause}
      WHERE id = $1
      RETURNING *
    `;

    try {
      // Get current data for logging
      const currentResult = await this.pool.query(
        `SELECT * FROM "${tableName}" WHERE id = $1`,
        [id],
      );
      const currentData = currentResult.rows[0];

      if (!currentData) {
        return {
          success: false,
          error: `${ruleType.name} with ID ${id} not found`,
        };
      }

      // Resolve the effective case id for checkpointing/logging
      const effectiveCaseId: number | undefined =
        ruleType.id === "case"
          ? id
          : (currentData?.caseid as number | undefined);

      // Create checkpoint for tracking with the correct case id
      const checkpointId = await this.createCheckpoint(ruleType.id, "update", {
        ...data,
        caseid: effectiveCaseId,
      });

      const result = await this.pool.query(query, [id, ...values]);

      if (result.rows.length > 0) {
        // Log the operation
        if (checkpointId) {
          await this.logOperation(
            checkpointId,
            "update",
            tableName,
            { id },
            currentData,
            effectiveCaseId,
          );
        }

        return {
          success: true,
          data: result.rows[0] as T,
          affectedRows: 1,
        };
      }

      return {
        success: false,
        error: "No data returned from update",
      };
    } catch (error) {
      console.error(`Failed to update ${ruleType.name}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Delete a record
   */
  private async delete<T>(
    ruleType: RuleTypeDefinition,
    id: number,
  ): Promise<DatabaseResult<T>> {
    const tableName = ruleType.databaseSchema.tableName;
    const query = `DELETE FROM "${tableName}" WHERE id = $1 RETURNING *`;

    try {
      // Get current data for logging
      const currentResult = await this.pool.query(
        `SELECT * FROM "${tableName}" WHERE id = $1`,
        [id],
      );
      const currentData = currentResult.rows[0];

      if (!currentData) {
        return {
          success: false,
          error: `${ruleType.name} with ID ${id} not found`,
        };
      }

      // Resolve the effective case id for checkpointing/logging
      const effectiveCaseId: number | undefined =
        ruleType.id === "case"
          ? id
          : (currentData?.caseid as number | undefined);

      // Create checkpoint for tracking with the correct case id
      const checkpointId = await this.createCheckpoint(ruleType.id, "delete", {
        id,
        caseid: effectiveCaseId,
      });

      // If deleting a Field, proactively remove references from any Views in the same case
      if (ruleType.id === "field" && currentData?.caseid) {
        try {
          const viewsResult = await this.pool.query(
            `SELECT id, name, model FROM "Views" WHERE caseid = $1`,
            [currentData.caseid],
          );
          for (const view of viewsResult.rows) {
            try {
              const model =
                typeof view.model === "string"
                  ? JSON.parse(view.model)
                  : view.model;
              if (model && Array.isArray(model.fields)) {
                const originalCount = model.fields.length;
                model.fields = model.fields.filter(
                  (f: { fieldId: number }) => f.fieldId !== id,
                );
                if (model.fields.length !== originalCount) {
                  await this.pool.query(
                    `UPDATE "Views" SET model = $1 WHERE id = $2`,
                    [JSON.stringify(model), view.id],
                  );
                  // Log as part of checkpoint for traceability
                  if (checkpointId) {
                    await this.logOperation(
                      checkpointId,
                      "update",
                      "Views",
                      { id: view.id },
                      { model: view.model },
                      currentData.caseid,
                    );
                  }
                }
              }
            } catch (err) {
              console.warn(
                `Failed to process view ${view.id} while removing deleted field ${id}:`,
                err,
              );
            }
          }
        } catch (cleanupError) {
          console.warn(
            `Failed cleaning view references for deleted field ${id} in case ${currentData.caseid}:`,
            cleanupError,
          );
        }
      }

      const result = await this.pool.query(query, [id]);

      if (result.rows.length > 0) {
        // Log the operation
        if (checkpointId) {
          await this.logOperation(
            checkpointId,
            "delete",
            tableName,
            { id },
            currentData,
            effectiveCaseId,
          );
        }

        return {
          success: true,
          data: result.rows[0] as T,
          affectedRows: 1,
        };
      }

      return {
        success: false,
        error: "No data returned from delete",
      };
    } catch (error) {
      console.error(`Failed to delete ${ruleType.name}:`, error);
      throw error;
    }
  }

  /**
   * List records with optional filtering
   */
  private async list<T>(
    ruleType: RuleTypeDefinition,
    filters?: Record<string, any>,
    options?: any,
  ): Promise<DatabaseResult<T[]>> {
    const tableName = ruleType.databaseSchema.tableName;
    let query = `SELECT * FROM "${tableName}"`;
    const values: any[] = [];
    let valueIndex = 1;

    // Add WHERE clause for filters
    if (filters && Object.keys(filters).length > 0) {
      const whereConditions: string[] = [];

      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null) {
          whereConditions.push(`"${key}" = $${valueIndex}`);
          values.push(value);
          valueIndex++;
        }
      }

      if (whereConditions.length > 0) {
        query += ` WHERE ${whereConditions.join(" AND ")}`;
      }
    }

    // Add ORDER BY
    if (options?.orderBy) {
      const direction = options.orderDirection === "DESC" ? "DESC" : "ASC";
      query += ` ORDER BY "${options.orderBy}" ${direction}`;
    }

    // Add LIMIT and OFFSET
    if (options?.limit) {
      query += ` LIMIT $${valueIndex}`;
      values.push(options.limit);
      valueIndex++;
    }

    if (options?.offset) {
      query += ` OFFSET $${valueIndex}`;
      values.push(options.offset);
    }

    try {
      const result = await this.pool.query(query, values);

      return {
        success: true,
        data: result.rows as T[],
        affectedRows: result.rows.length,
      };
    } catch (error) {
      console.error(`Failed to list ${ruleType.name}:`, error);
      throw error;
    }
  }

  /**
   * Validate data against rule type schema
   */
  private async validateData(
    ruleType: RuleTypeDefinition,
    data: any,
  ): Promise<{ valid: boolean; errors: string[] }> {
    try {
      // Use interface template validation
      const errors: string[] = [];

      ruleType.interfaceTemplate.properties.forEach((prop) => {
        // Check required fields
        if (
          !prop.optional &&
          (data[prop.name] === undefined || data[prop.name] === null)
        ) {
          errors.push(`${prop.name} is required`);
          return;
        }

        // Skip validation for optional fields that are not provided
        if (
          prop.optional &&
          (data[prop.name] === undefined || data[prop.name] === null)
        ) {
          return;
        }

        // Type validation
        if (data[prop.name] !== undefined && data[prop.name] !== null) {
          if (prop.type === "string" && typeof data[prop.name] !== "string") {
            errors.push(`${prop.name} must be a string`);
          } else if (
            prop.type === "number" &&
            typeof data[prop.name] !== "number"
          ) {
            errors.push(`${prop.name} must be a number`);
          } else if (
            prop.type === "boolean" &&
            typeof data[prop.name] !== "boolean"
          ) {
            errors.push(`${prop.name} must be a boolean`);
          } else if (prop.type === "string[]") {
            // Handle both array and JSON string formats for string[] fields
            let optionsArray = data[prop.name];

            // If it's already an array, validate it contains strings
            if (Array.isArray(optionsArray)) {
              if (!optionsArray.every((item) => typeof item === "string")) {
                errors.push(`${prop.name} must be an array of strings`);
              }
            }
            // If it's a string, try to parse it as JSON
            else if (typeof optionsArray === "string") {
              try {
                const parsed = JSON.parse(optionsArray);
                if (
                  !Array.isArray(parsed) ||
                  !parsed.every((item) => typeof item === "string")
                ) {
                  errors.push(`${prop.name} must be an array of strings`);
                }
              } catch {
                errors.push(`${prop.name} must be an array of strings`);
              }
            }
            // If it's neither array nor string, it's invalid
            else if (optionsArray !== undefined && optionsArray !== null) {
              errors.push(`${prop.name} must be an array of strings`);
            }
          } else if (
            prop.type === "number[]" &&
            !Array.isArray(data[prop.name])
          ) {
            errors.push(`${prop.name} must be an array of numbers`);
          } else if (
            prop.type === "boolean[]" &&
            !Array.isArray(data[prop.name])
          ) {
            errors.push(`${prop.name} must be an array of booleans`);
          } else if (
            prop.type === "FieldType" &&
            typeof data[prop.name] !== "string"
          ) {
            errors.push(`${prop.name} must be a string`);
          } else if (prop.type === "ViewModel") {
            const value = data[prop.name];
            const valueType = typeof value;
            if (valueType === "object") {
              // ok
            } else if (valueType === "string") {
              // Accept JSON string that parses to an object
              try {
                const parsed = JSON.parse(value as string);
                if (typeof parsed !== "object" || parsed === null) {
                  errors.push(`${prop.name} must be an object`);
                }
              } catch {
                errors.push(`${prop.name} must be an object`);
              }
            } else {
              errors.push(`${prop.name} must be an object`);
            }
          }
        }
      });

      if (errors.length > 0) {
        return { valid: false, errors };
      }

      // Execute custom validation if provided
      if (ruleType.hooks?.customValidation) {
        const customErrors = await this.executeHook(
          ruleType.hooks.customValidation,
          data,
        );
        if (customErrors && customErrors.length > 0) {
          return {
            valid: false,
            errors: customErrors,
          };
        }
      }

      return { valid: true, errors: [] };
    } catch (error: any) {
      return {
        valid: false,
        errors: [error.message || "Validation failed"],
      };
    }
  }

  /**
   * Execute a hook function
   */
  private async executeHook(hook: Function, ...args: any[]): Promise<any> {
    try {
      const result = hook(...args);
      return result instanceof Promise ? await result : result;
    } catch (error) {
      console.error("Hook execution failed:", error);
      throw error;
    }
  }

  /**
   * Create a checkpoint for tracking changes
   */
  private async createCheckpoint(
    ruleTypeId: string,
    operation: string,
    data: any,
  ): Promise<string | null> {
    try {
      const description = `${ruleTypeId} ${operation}`;
      const userCommand = `Dynamic DB: ${operation} ${ruleTypeId}`;

      // Try to extract case ID from data
      const caseId = data?.caseid || 1; // Default to 1 if not found

      return await checkpointManager.beginCheckpoint(
        caseId,
        description,
        userCommand,
        "API",
      );
    } catch (error) {
      console.warn("Failed to create checkpoint:", error);
      return null;
    }
  }

  /**
   * Log a database operation
   */
  private async logOperation(
    checkpointId: string,
    operation: "insert" | "update" | "delete",
    tableName: string,
    primaryKey: any,
    previousData?: any,
    caseId?: number,
  ): Promise<void> {
    try {
      await checkpointManager.logOperation(
        checkpointId,
        caseId || 1,
        operation,
        tableName,
        primaryKey,
        previousData,
      );
    } catch (error) {
      console.warn("Failed to log operation:", error);
    }
  }

  /**
   * Generate database migration for all registered rule types
   */
  async generateMigrations(): Promise<string> {
    const ruleTypes = ruleTypeRegistry.getAll();
    let migrations = "-- Auto-generated migrations from rule type registry\n\n";

    for (const ruleType of ruleTypes) {
      migrations += `-- Migration for ${ruleType.name}\n`;
      migrations += ruleTypeRegistry.generateDatabaseMigration(ruleType.id);
      migrations += "\n";
    }

    return migrations;
  }

  /**
   * Initialize database tables for all registered rule types
   */
  async initializeTables(): Promise<void> {
    const ruleTypes = ruleTypeRegistry.getAll();

    for (const ruleType of ruleTypes) {
      const migration = ruleTypeRegistry.generateDatabaseMigration(ruleType.id);
      await this.pool.query(migration);
      console.log(`✅ Initialized table for ${ruleType.name}`);
    }
  }
}

// Export singleton instance with lazy initialization
let _dynamicDatabaseService: DynamicDatabaseService | null = null;

export function getDynamicDatabaseService(): DynamicDatabaseService {
  if (!_dynamicDatabaseService) {
    if (!pool) {
      throw new Error("Database pool is not initialized");
    }
    _dynamicDatabaseService = new DynamicDatabaseService(pool);
  }
  return _dynamicDatabaseService;
}

// Export a getter that creates the service on first access
export const dynamicDatabaseService = new Proxy({} as DynamicDatabaseService, {
  get(target, prop) {
    const service = getDynamicDatabaseService();
    return (service as any)[prop];
  },
});
