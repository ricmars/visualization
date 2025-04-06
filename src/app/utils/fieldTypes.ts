import { fieldType } from "../types";

// Mapping of technical field types to user-friendly display names
export const fieldTypeToDisplayName: Record<fieldType, string> = {
  Address: "Address",
  AutoComplete: "Auto Complete",
  Checkbox: "Checkbox",
  Currency: "Currency",
  Date: "Date",
  DateTime: "Date & Time",
  Decimal: "Decimal Number",
  Dropdown: "Dropdown",
  Email: "Email",
  Integer: "Whole Number",
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
  URL: "Website URL",
  UserReference: "User Reference",
};

// Get all possible values from the fieldType type
export const getAllFieldTypes = (): fieldType[] => {
  return Object.keys(fieldTypeToDisplayName) as fieldType[];
};

// Function to get the display name for a field type
export const getFieldTypeDisplayName = (type: fieldType): string => {
  return fieldTypeToDisplayName[type] || type;
};
