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

// Database table names
export const DB_TABLES = {
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

// Field types mapping
export const FIELD_TYPES = {
  TEXT: "Text",
  ADDRESS: "Address",
  EMAIL: "Email",
  DATE: "Date",
  DATETIME: "DateTime",
  STATUS: "Status",
  CURRENCY: "Currency",
  CHECKBOX: "Checkbox",
  DROPDOWN: "Dropdown",
  RADIO_BUTTONS: "RadioButtons",
  RICH_TEXT: "RichText",
  TEXT_AREA: "TextArea",
  TIME: "Time",
  URL: "URL",
  AUTO_COMPLETE: "AutoComplete",
  DECIMAL: "Decimal",
  INTEGER: "Integer",
  LOCATION: "Location",
  REFERENCE_VALUES: "ReferenceValues",
  DATA_REFERENCE_SINGLE: "DataReferenceSingle",
  DATA_REFERENCE_MULTI: "DataReferenceMulti",
  CASE_REFERENCE_SINGLE: "CaseReferenceSingle",
  CASE_REFERENCE_MULTI: "CaseReferenceMulti",
  PERCENTAGE: "Percentage",
  PHONE: "Phone",
  USER_REFERENCE: "UserReference",
} as const;

// Database interfaces
export interface DatabaseRecord {
  id: number;
}

export interface CaseRecord extends DatabaseRecord {
  name: string;
  description: string;
  model: string; // JSON string
}

export interface FieldRecord extends DatabaseRecord {
  name: string;
  type: string;
  primary: boolean;
  caseID: number;
  label: string;
  description: string;
  order: number;
  options: string;
  required: boolean;
}

export interface ViewRecord extends DatabaseRecord {
  name: string;
  model: string; // JSON string
  caseID: number;
}

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
  return Object.values(FIELD_TYPES).includes(
    type as (typeof FIELD_TYPES)[keyof typeof FIELD_TYPES],
  );
}

export function validateCaseId(caseID: string | number): number {
  const id = ensureIntegerId(caseID);
  if (isNaN(id) || id <= 0) {
    throw new Error("Invalid case ID");
  }
  return id;
}
