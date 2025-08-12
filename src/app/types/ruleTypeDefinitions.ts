/**
 * Rule Type Definitions using the new Interface Template System
 *
 * This system eliminates duplication by:
 * 1. Using TypeScript interface templates instead of string-based interfaces
 * 2. Generating validation logic from the interface template
 * 3. Providing compile-time type safety
 * 4. Single source of truth for type definitions
 *
 * Benefits:
 * - No more string-based interfaces that could have syntax errors
 * - No duplication between validation schemas and type definitions
 * - Compile-time validation of interface structure
 * - Automatic code generation from structured data
 */

import { ruleTypeRegistry, RuleTypeDefinition } from "./ruleTypeRegistry";

// Case Rule Type Definition
export const caseRuleType: RuleTypeDefinition = {
  id: "case",
  name: "Case",
  description: "A workflow case that represents a business process or workflow",
  category: "workflow",
  version: "1.0.0",

  interfaceTemplate: {
    name: "Case",
    description:
      "A workflow case that represents a business process or workflow",
    properties: [
      {
        name: "id",
        type: "number",
        optional: true,
        description: "Primary key identifier",
      },
      {
        name: "name",
        type: "string",
        description: "Case name",
      },
      {
        name: "description",
        type: "string",
        description: "Case description",
      },
      {
        name: "model",
        type: "ViewModel",
        description: "JSON model containing the workflow structure",
      },
    ],
  },

  databaseSchema: {
    tableName: "Cases",
    columns: [
      {
        name: "id",
        type: "INTEGER",
        primaryKey: true,
        nullable: false,
        description: "Primary key identifier",
      },
      {
        name: "name",
        type: "TEXT",
        nullable: false,
        description: "Case name",
      },
      {
        name: "description",
        type: "TEXT",
        nullable: false,
        description: "Case description",
      },
      {
        name: "model",
        type: "JSONB",
        nullable: true,
        description: "JSON workflow model",
      },
    ],
    indexes: [
      {
        name: "cases_name_idx",
        columns: ["name"],
      },
    ],
  },

  hooks: {
    beforeCreate: async (data) => {
      // Normalize model to an object for JSONB storage
      if (data.model === undefined || data.model === null) {
        data.model = { stages: [] };
        return data;
      }

      if (typeof data.model === "string") {
        try {
          data.model = JSON.parse(data.model);
        } catch {
          throw new Error("Invalid JSON in model field");
        }
      }

      return data;
    },

    beforeUpdate: async (data) => {
      // Normalize model for updates as well
      if (data.model === undefined || data.model === null) {
        return data;
      }
      if (typeof data.model === "string") {
        try {
          data.model = JSON.parse(data.model);
        } catch {
          throw new Error("Invalid JSON in model field");
        }
      }
      return data;
    },

    afterCreate: async (data, id) => {
      console.log(`Created case ${id}: ${data.name}`);
    },
  },
};

// Field Rule Type Definition
export const fieldRuleType: RuleTypeDefinition = {
  id: "field",
  name: "Field",
  description: "A data field within a case that can be collected and displayed",
  category: "data",
  version: "1.0.0",

  interfaceTemplate: {
    name: "Field",
    description:
      "A data field within a case that can be collected and displayed",
    properties: [
      {
        name: "id",
        type: "number",
        optional: true,
        description: "Primary key identifier",
      },
      {
        name: "name",
        type: "string",
        description: "Field name",
      },
      {
        name: "caseid",
        type: "number",
        description: "Reference to parent case",
      },
      {
        name: "type",
        type: "FieldType",
        description: "Field type",
      },
      {
        name: "primary",
        type: "boolean",
        optional: true,
        description: "Whether this is a primary field",
      },
      {
        name: "label",
        type: "string",
        description: "Display label",
      },
      {
        name: "description",
        type: "string",
        description: "Field description",
      },
      {
        name: "order",
        type: "number",
        description: "Display order",
      },
      {
        name: "options",
        type: "string[]",
        description: "Available options for selection fields",
      },
      {
        name: "required",
        type: "boolean",
        description: "Whether field is required",
      },
      {
        name: "sampleValue",
        type: "unknown",
        optional: true,
        description: "Sample value for previews",
      },
    ],
  },

  databaseSchema: {
    tableName: "Fields",
    columns: [
      {
        name: "id",
        type: "INTEGER",
        primaryKey: true,
        nullable: false,
        description: "Primary key identifier",
      },
      {
        name: "type",
        type: "TEXT",
        nullable: false,
        description: "Field type",
      },
      {
        name: "name",
        type: "TEXT",
        nullable: false,
        description: "Field name",
      },
      {
        name: "primary",
        type: "BOOLEAN",
        nullable: false,
        defaultValue: false,
        description: "Whether this is a primary field",
      },
      {
        name: "caseid",
        type: "INTEGER",
        nullable: false,
        description: "Reference to parent case",
      },
      {
        name: "label",
        type: "TEXT",
        nullable: false,
        description: "Display label",
      },
      {
        name: "description",
        type: "TEXT",
        nullable: false,
        defaultValue: "",
        description: "Field description",
      },
      {
        name: "order",
        type: "INTEGER",
        nullable: false,
        defaultValue: 0,
        description: "Display order",
      },
      {
        name: "options",
        type: "TEXT",
        nullable: false,
        defaultValue: "[]",
        description: "JSON array of options",
      },
      {
        name: "required",
        type: "BOOLEAN",
        nullable: false,
        defaultValue: false,
        description: "Whether field is required",
      },
      {
        name: "sampleValue",
        type: "TEXT",
        nullable: true,
        description: "Sample value",
      },
    ],
    foreignKeys: [
      {
        name: "fields_caseid_fkey",
        columns: ["caseid"],
        referenceTable: "Cases",
        referenceColumns: ["id"],
        onDelete: "CASCADE",
      },
    ],
    indexes: [
      {
        name: "fields_caseid_idx",
        columns: ["caseid"],
      },
      {
        name: "fields_name_caseid_unique",
        columns: ["name", "caseid"],
        unique: true,
      },
    ],
    constraints: [
      {
        name: "fields_name_caseid_unique",
        type: "UNIQUE",
        expression: "(name, caseid)",
      },
    ],
  },

  hooks: {
    beforeCreate: async (data) => {
      // Ensure options is a JSON string for database storage
      if (Array.isArray(data.options)) {
        data.options = JSON.stringify(data.options);
      }
      // Normalize sampleValue to a string for TEXT column storage
      if (data.sampleValue !== undefined && data.sampleValue !== null) {
        if (typeof data.sampleValue !== "string") {
          try {
            data.sampleValue = JSON.stringify(data.sampleValue);
          } catch {
            data.sampleValue = String(data.sampleValue);
          }
        }
      }
      return data;
    },

    beforeUpdate: async (data) => {
      // Ensure options is a JSON string for database storage
      if (Array.isArray(data.options)) {
        data.options = JSON.stringify(data.options);
      }
      // Normalize sampleValue to a string for TEXT column storage
      if (data.sampleValue !== undefined && data.sampleValue !== null) {
        if (typeof data.sampleValue !== "string") {
          try {
            data.sampleValue = JSON.stringify(data.sampleValue);
          } catch {
            data.sampleValue = String(data.sampleValue);
          }
        }
      }
      return data;
    },

    afterCreate: async (data, id) => {
      console.log(`Created field ${id}: ${data.name} (${data.type})`);
    },
  },
};

// View Rule Type Definition
export const viewRuleType: RuleTypeDefinition = {
  id: "view",
  name: "View",
  description: "A view that defines how fields are displayed and organized",
  category: "ui",
  version: "1.0.0",

  interfaceTemplate: {
    name: "View",
    description: "A view that defines how fields are displayed and organized",
    properties: [
      {
        name: "id",
        type: "number",
        optional: true,
        description: "Primary key identifier",
      },
      {
        name: "name",
        type: "string",
        description: "View name",
      },
      {
        name: "caseid",
        type: "number",
        description: "Reference to parent case",
      },
      {
        name: "model",
        type: "ViewModel",
        description: "View configuration model",
      },
    ],
  },

  databaseSchema: {
    tableName: "Views",
    columns: [
      {
        name: "id",
        type: "INTEGER",
        primaryKey: true,
        nullable: false,
        description: "Primary key identifier",
      },
      {
        name: "name",
        type: "TEXT",
        nullable: false,
        description: "View name",
      },
      {
        name: "model",
        type: "JSONB",
        nullable: false,
        description: "View configuration model",
      },
      {
        name: "caseid",
        type: "INTEGER",
        nullable: false,
        description: "Reference to parent case",
      },
    ],
    foreignKeys: [
      {
        name: "views_caseid_fkey",
        columns: ["caseid"],
        referenceTable: "Cases",
        referenceColumns: ["id"],
        onDelete: "CASCADE",
      },
    ],
    indexes: [
      {
        name: "views_caseid_idx",
        columns: ["caseid"],
      },
    ],
  },

  hooks: {
    beforeCreate: async (data) => {
      // Ensure model is stored as JSON
      if (typeof data.model === "object") {
        data.model = JSON.stringify(data.model);
      }
      return data;
    },

    afterCreate: async (data, id) => {
      console.log(`Created view ${id}: ${data.name}`);
    },
  },
};

// Register all rule types
export function registerRuleTypes(): void {
  try {
    ruleTypeRegistry.register(caseRuleType);
    ruleTypeRegistry.register(fieldRuleType);
    ruleTypeRegistry.register(viewRuleType);
    console.log("✅ All rule types registered successfully");
  } catch (error) {
    console.error("❌ Failed to register rule types:", error);
    throw error;
  }
}
