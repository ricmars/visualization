import { fieldTypes, FieldType } from "./fields";
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

// Legacy DB_TABLES for backward compatibility (deprecated - use getTableName instead)
export const LEGACY_DB_TABLES = {
  CASES: "Cases",
  FIELDS: "Fields",
  VIEWS: "Views",
} as const;

// Step types mapping
export const STEP_TYPES = {
  COLLECT_INFORMATION: "collect_information",
  DECISION: "decision",
  NOTIFICATION: "notification",
} as const;

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

// Dynamic interfaces - use rule type registry to get proper types
export type CaseRecord = {
  id?: number;
  name: string;
  description: string;
  model: string; // JSON string containing the workflow structure
};

export type FieldRecord = {
  id?: number;
  name: string;
  caseID: number;
  type: string;
  primary?: boolean;
  label: string;
  description: string;
  order: number;
  options: string[];
  required: boolean;
  defaultValue?: unknown;
};

export type ViewRecord = {
  id?: number;
  name: string;
  caseID: number;
  model: {
    fields: {
      fieldId: number;
      required?: boolean;
      order?: number;
    }[];
    layout?: {
      type: "form" | "table" | "card";
      columns?: number;
    };
  };
};

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

// Validation functions
export function validateStepType(type: string): boolean {
  return Object.values(STEP_TYPES).includes(
    type as (typeof STEP_TYPES)[keyof typeof STEP_TYPES],
  );
}

export function validateFieldType(type: string): boolean {
  return fieldTypes.includes(type as FieldType);
}

export function validateCaseId(caseID: string | number): number {
  const id = ensureIntegerId(caseID);
  if (isNaN(id) || id <= 0) {
    throw new Error("Invalid case ID");
  }
  return id;
}
