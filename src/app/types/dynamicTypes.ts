import { ruleTypeRegistry } from "./ruleTypeRegistry";
import { FieldType } from "../utils/fieldTypes";

// Dynamic type generation from rule type registry
// This ensures all types are defined in a single place and are consistent

// Define custom types that are referenced in interface templates
export interface ViewModel {
  fields: {
    fieldId: number;
    required?: boolean;
    order?: number;
  }[];
  layout?: {
    type: "form" | "table" | "card";
    columns?: number;
  };
}

// Generate interface from rule type template
type GenerateInterfaceFromTemplate<T extends string> = T extends "case"
  ? {
      id?: number;
      name: string;
      description: string;
      model: string;
    }
  : T extends "field"
  ? {
      id?: number;
      name: string;
      caseid: number;
      type: FieldType;
      primary?: boolean;
      label: string;
      description: string;
      order: number;
      options: string[];
      required: boolean;
      sampleValue?: unknown;
    }
  : T extends "view"
  ? {
      id?: number;
      name: string;
      caseid: number;
      model: ViewModel;
    }
  : never;

// Generate types from rule type registry
export type CaseRecord = GenerateInterfaceFromTemplate<"case">;
export type FieldRecord = GenerateInterfaceFromTemplate<"field">;
export type ViewRecord = GenerateInterfaceFromTemplate<"view">;

// Helper function to get interface template for runtime use
export function getInterfaceTemplate(ruleTypeId: string) {
  const ruleType = ruleTypeRegistry.get(ruleTypeId);
  if (!ruleType) {
    throw new Error(`Rule type '${ruleTypeId}' not found`);
  }
  return ruleType.interfaceTemplate;
}

// Helper function to validate data against rule type
export function validateRecord(
  ruleTypeId: string,
  data: any,
): { valid: boolean; errors: string[] } {
  const ruleType = ruleTypeRegistry.get(ruleTypeId);
  if (!ruleType) {
    return { valid: false, errors: [`Rule type '${ruleTypeId}' not found`] };
  }

  const errors: string[] = [];

  // Validate required properties
  ruleType.interfaceTemplate.properties.forEach((prop) => {
    if (!prop.optional && data[prop.name] === undefined) {
      errors.push(`${prop.name} is required`);
    }
  });

  return { valid: errors.length === 0, errors };
}
