// Source of truth for field types (aligned with stepTypes.ts pattern)
export const fieldTypes = [
  "Address",
  "AutoComplete",
  "Checkbox",
  "Currency",
  "Date",
  "DateTime",
  "Decimal",
  "Dropdown",
  "Email",
  "Integer",
  "Location",
  "ReferenceValues",
  "DataReferenceSingle",
  "DataReferenceMulti",
  "CaseReferenceSingle",
  "CaseReferenceMulti",
  "Percentage",
  "Phone",
  "RadioButtons",
  "RichText",
  "Status",
  "Text",
  "TextArea",
  "Time",
  "URL",
  "UserReference",
] as const;

// Type derived from the tuple
export type FieldType = (typeof fieldTypes)[number];

// Mapping of technical field types to user-friendly display names
export const fieldTypeToDisplayName: Record<FieldType, string> = {
  Address: "Address",
  AutoComplete: "Auto Complete",
  Checkbox: "Checkbox",
  Currency: "Currency",
  Date: "Date",
  DateTime: "Date & Time",
  Decimal: "Decimal",
  Dropdown: "Dropdown",
  Email: "Email",
  Integer: "Integer",
  Location: "Location",
  ReferenceValues: "Reference Values",
  DataReferenceSingle: "Single Data Reference",
  DataReferenceMulti: "Multiple Data References",
  CaseReferenceSingle: "Single Case Reference",
  CaseReferenceMulti: "Multiple Case References",
  Percentage: "Percentage",
  Phone: "Phone Number",
  RadioButtons: "Radio Buttons",
  RichText: "Rich Text Editor",
  Status: "Status",
  Text: "Single Line Text",
  TextArea: "Multi Line Text",
  Time: "Time",
  URL: "URL",
  UserReference: "User Reference",
};

// Get all possible values from the fieldTypes array
export const getAllFieldTypes = (): readonly FieldType[] => {
  return fieldTypes;
};

// Function to get the display name for a field type
export const getFieldTypeDisplayName = (type: FieldType): string => {
  return fieldTypeToDisplayName[type] || type;
};
