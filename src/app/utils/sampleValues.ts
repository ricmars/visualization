import { fieldType } from "../types";

export const generateSampleValue = (
  type: fieldType,
  options?: string[],
): string | number | boolean | string[] => {
  switch (type) {
    case "Text":
      return "Sample Text";
    case "TextArea":
      return "This is a sample multi-line text.\nIt can contain multiple lines of content.";
    case "Integer":
      return 42;
    case "Decimal":
      return 3.14;
    case "Checkbox":
      return false;
    case "Date":
      return new Date().toISOString().split("T")[0];
    case "DateTime":
      return new Date().toISOString();
    case "Time":
      return "14:30";
    case "Email":
      return "example@email.com";
    case "Phone":
      return "+1 (555) 123-4567";
    case "URL":
      return "https://example.com";
    case "Currency":
      return 99.99;
    case "Percentage":
      return 75;
    case "Address":
      return "123 Sample Street, City, Country";
    case "Location":
      return "37.7749° N, 122.4194° W";
    case "Status":
      return "Active";
    case "RichText":
      return "<p>This is a <strong>sample</strong> rich text content.</p>";
    case "Dropdown":
    case "RadioButtons":
    case "AutoComplete":
      return options && options.length > 0 ? options[0] : "Option 1";
    case "UserReference":
      return "John Doe";
    case "ReferenceValues":
    case "DataReferenceSingle":
    case "CaseReferenceSingle":
      return "REF-001";
    case "DataReferenceMulti":
    case "CaseReferenceMulti":
      return ["REF-001", "REF-002"];
    default:
      return "Sample Value";
  }
};
