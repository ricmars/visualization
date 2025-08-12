import { fieldTypes, FieldType } from "../utils/fieldTypes";
import { ruleTypeRegistry } from "./ruleTypeRegistry";

// Database column names
export const DB_COLUMNS = {
  CASE_ID: "caseid",
  ID: "id",
  NAME: "name",
  DESCRIPTION: "description",
  MODEL: "model",
  TYPE: "type",
  PRIMARY: "primary",
  LABEL: "label",
  ORDER: "order",
  OPTIONS: "options",
  REQUIRED: "required",
} as const;

// Dynamic database table names - get from rule type registry
export const DB_TABLES = {
  get CASES() {
    const ruleType = ruleTypeRegistry.get("case");
    return ruleType?.databaseSchema.tableName || "Cases";
  },
  get FIELDS() {
    const ruleType = ruleTypeRegistry.get("field");
    return ruleType?.databaseSchema.tableName || "Fields";
  },
  get VIEWS() {
    const ruleType = ruleTypeRegistry.get("view");
    return ruleType?.databaseSchema.tableName || "Views";
  },
} as const;

// Helper function to get table name by rule type ID
export function getTableName(ruleTypeId: string): string {
  const ruleType = ruleTypeRegistry.get(ruleTypeId);
  if (!ruleType) {
    throw new Error(`Rule type '${ruleTypeId}' not found`);
  }
  return ruleType.databaseSchema.tableName;
}

// Field types mapping - using centralized fieldTypes from fields.ts
export const FIELD_TYPES = Object.fromEntries(
  fieldTypes.map((type) => [
    type.toUpperCase().replace(/[^A-Z0-9]/g, "_"),
    type,
  ]),
) as Record<string, FieldType>;

// Database interfaces
export interface DatabaseRecord {
  id: number;
}

// Generic database record type that can be used with any rule type
export type DynamicRecord<T = any> = T & DatabaseRecord;

// Utility functions
export function ensureIntegerId(id: string | number): number {
  return typeof id === "string" ? parseInt(id, 10) : id;
}

export function stringifyModel(model: unknown): string {
  return JSON.stringify(model);
}

export function parseModel<T>(modelString: string): T {
  return JSON.parse(modelString);
}
