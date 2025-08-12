// TypeScript interface template system
export interface InterfaceProperty {
  name: string;
  type: string;
  optional?: boolean;
  description?: string;
  defaultValue?: any;
}

export interface InterfaceTemplate {
  name: string;
  properties: InterfaceProperty[];
  extends?: string[];
  description?: string;
}

// Base interface for all rule type definitions
export interface RuleTypeDefinition {
  /** Unique identifier for the rule type */
  id: string;

  /** Human-readable name */
  name: string;

  /** Detailed description of what this rule type represents */
  description: string;

  /** Category for grouping related rule types */
  category: string;

  /** Version of this rule type definition */
  version: string;

  /** TypeScript interface template for code generation */
  interfaceTemplate: InterfaceTemplate;

  /** Database schema definition */
  databaseSchema: DatabaseSchemaDefinition;

  /** Business logic hooks */
  hooks?: RuleTypeHooks;
}

// Database schema definition
export interface DatabaseSchemaDefinition {
  /** Table name in the database */
  tableName: string;

  /** Column definitions */
  columns: ColumnDefinition[];

  /** Indexes to create */
  indexes?: IndexDefinition[];

  /** Foreign key relationships */
  foreignKeys?: ForeignKeyDefinition[];

  /** Constraints */
  constraints?: ConstraintDefinition[];
}

export interface ColumnDefinition {
  name: string;
  type:
    | "TEXT"
    | "INTEGER"
    | "BOOLEAN"
    | "JSONB"
    | "TIMESTAMP"
    | "UUID"
    | "DECIMAL";
  nullable?: boolean;
  defaultValue?: any;
  primaryKey?: boolean;
  unique?: boolean;
  description?: string;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    enum?: string[];
  };
}

export interface IndexDefinition {
  name: string;
  columns: string[];
  unique?: boolean;
  partial?: string; // WHERE clause for partial indexes
}

export interface ForeignKeyDefinition {
  name: string;
  columns: string[];
  referenceTable: string;
  referenceColumns: string[];
  onDelete?: "CASCADE" | "SET NULL" | "RESTRICT";
  onUpdate?: "CASCADE" | "SET NULL" | "RESTRICT";
}

export interface ConstraintDefinition {
  name: string;
  type: "CHECK" | "UNIQUE" | "NOT NULL";
  expression: string;
}

// Business logic hooks
export interface RuleTypeHooks {
  /** Called before creating a new instance */
  beforeCreate?: (data: any) => Promise<any> | any;

  /** Called after creating a new instance */
  afterCreate?: (data: any, id: number) => Promise<void> | void;

  /** Called before updating an instance */
  beforeUpdate?: (data: any, id: number) => Promise<any> | any;

  /** Called after updating an instance */
  afterUpdate?: (data: any, id: number) => Promise<void> | void;

  /** Called before deleting an instance */
  beforeDelete?: (id: number) => Promise<boolean> | boolean;

  /** Called after deleting an instance */
  afterDelete?: (id: number) => Promise<void> | void;

  /** Custom validation logic */
  customValidation?: (data: any) => Promise<string[] | null> | string[] | null;

  /** Business rule execution */
  executeRules?: (data: any) => Promise<any> | any;
}

// Registry for managing rule types
export class RuleTypeRegistry {
  private static instance: RuleTypeRegistry;
  private ruleTypes: Map<string, RuleTypeDefinition> = new Map();

  private constructor() {}

  static getInstance(): RuleTypeRegistry {
    if (!RuleTypeRegistry.instance) {
      RuleTypeRegistry.instance = new RuleTypeRegistry();
    }
    return RuleTypeRegistry.instance;
  }

  /**
   * Register a new rule type
   */
  register(definition: RuleTypeDefinition): void {
    // Validate the definition
    this.validateDefinition(definition);

    // Check for conflicts - allow re-registration of the same rule type
    if (this.ruleTypes.has(definition.id)) {
      console.log(
        `Rule type '${definition.id}' is already registered, skipping...`,
      );
      return;
    }

    this.ruleTypes.set(definition.id, definition);
  }

  /**
   * Get a rule type by ID
   */
  get(id: string): RuleTypeDefinition | undefined {
    return this.ruleTypes.get(id);
  }

  /**
   * Get all registered rule types
   */
  getAll(): RuleTypeDefinition[] {
    return Array.from(this.ruleTypes.values());
  }

  /**
   * Get rule types by category
   */
  getByCategory(category: string): RuleTypeDefinition[] {
    return this.getAll().filter((rt) => rt.category === category);
  }

  /**
   * Generate JSON schema from a rule type definition
   */
  generateJsonSchema(ruleTypeId: string): any {
    const definition = this.get(ruleTypeId);
    if (!definition) {
      throw new Error(`Rule type '${ruleTypeId}' not found`);
    }

    // Convert interface template to JSON schema
    return this.interfaceTemplateToJsonSchema(definition.interfaceTemplate);
  }

  /**
   * Convert interface template to JSON schema
   */
  private interfaceTemplateToJsonSchema(template: InterfaceTemplate): any {
    const properties: Record<string, any> = {};
    const required: string[] = [];

    template.properties.forEach((prop) => {
      properties[prop.name] = {
        type: this.mapTypeScriptTypeToJsonSchema(prop.type),
        description: prop.description,
      };

      if (!prop.optional) {
        required.push(prop.name);
      }
    });

    return {
      type: "object",
      properties,
      required: required.length > 0 ? required : undefined,
    };
  }

  /**
   * Map TypeScript types to JSON schema types
   */
  private mapTypeScriptTypeToJsonSchema(tsType: string): string {
    const typeMap: Record<string, string> = {
      string: "string",
      number: "number",
      boolean: "boolean",
      "string[]": "array",
      "number[]": "array",
      "boolean[]": "array",
    };

    return typeMap[tsType] || "string";
  }

  /**
   * Generate database migration SQL
   */
  generateDatabaseMigration(ruleTypeId: string): string {
    const definition = this.get(ruleTypeId);
    if (!definition) {
      throw new Error(`Rule type '${ruleTypeId}' not found`);
    }

    const schema = definition.databaseSchema;
    let sql = `CREATE TABLE IF NOT EXISTS "${schema.tableName}" (\n`;

    const columns = schema.columns.map((col) => {
      let columnDef = `  "${col.name}" ${col.type}`;

      // Auto-increment for integer primary keys unless an explicit default is provided
      if (
        col.primaryKey &&
        col.type === "INTEGER" &&
        col.defaultValue === undefined
      ) {
        columnDef += " GENERATED BY DEFAULT AS IDENTITY";
      }

      if (!col.nullable) columnDef += " NOT NULL";
      if (col.primaryKey) columnDef += " PRIMARY KEY";
      if (col.unique) columnDef += " UNIQUE";
      if (col.defaultValue !== undefined) {
        const defaultValue =
          typeof col.defaultValue === "string"
            ? `'${col.defaultValue}'`
            : col.defaultValue;
        columnDef += ` DEFAULT ${defaultValue}`;
      }
      return columnDef;
    });

    sql += columns.join(",\n");

    // Add foreign keys
    if (schema.foreignKeys) {
      sql += ",\n";
      const fks = schema.foreignKeys.map((fk) => {
        let fkDef = `  CONSTRAINT "${fk.name}" FOREIGN KEY (${fk.columns
          .map((c) => `"${c}"`)
          .join(", ")})`;
        fkDef += ` REFERENCES "${fk.referenceTable}" (${fk.referenceColumns
          .map((c) => `"${c}"`)
          .join(", ")})`;
        if (fk.onDelete) fkDef += ` ON DELETE ${fk.onDelete}`;
        if (fk.onUpdate) fkDef += ` ON UPDATE ${fk.onUpdate}`;
        return fkDef;
      });
      sql += fks.join(",\n");
    }

    // Add constraints
    if (schema.constraints) {
      sql += ",\n";
      const constraints = schema.constraints.map((c) => {
        return `  CONSTRAINT "${c.name}" ${c.type} ${c.expression}`;
      });
      sql += constraints.join(",\n");
    }

    sql += "\n);\n";

    // Add indexes
    if (schema.indexes) {
      sql += "\n";
      schema.indexes.forEach((index) => {
        let indexDef = `CREATE INDEX IF NOT EXISTS "${index.name}" ON "${
          schema.tableName
        }" (${index.columns.map((c) => `"${c}"`).join(", ")})`;
        if (index.unique) indexDef = indexDef.replace("INDEX", "UNIQUE INDEX");
        if (index.partial) indexDef += ` WHERE ${index.partial}`;
        sql += indexDef + ";\n";
      });
    }

    return sql;
  }

  /**
   * Generate TypeScript types
   */
  generateTypeScriptTypes(): string {
    let types = "// Auto-generated types from rule type registry\n\n";

    this.getAll().forEach((definition) => {
      types += `// ${definition.name}\n`;
      types += `// ${definition.description}\n`;
      types +=
        this.interfaceTemplateToTypeScript(definition.interfaceTemplate) +
        "\n\n";
    });

    return types;
  }

  /**
   * Convert interface template to TypeScript interface string
   */
  private interfaceTemplateToTypeScript(template: InterfaceTemplate): string {
    let interfaceStr = `export interface ${template.name}`;

    if (template.extends && template.extends.length > 0) {
      interfaceStr += ` extends ${template.extends.join(", ")}`;
    }

    interfaceStr += " {\n";

    template.properties.forEach((prop) => {
      const optional = prop.optional ? "?" : "";
      const description = prop.description
        ? `  /** ${prop.description} */\n`
        : "";
      interfaceStr += `${description}  ${prop.name}${optional}: ${prop.type};\n`;
    });

    interfaceStr += "}";
    return interfaceStr;
  }

  /**
   * Generate validation functions
   */
  generateValidationFunctions(): string {
    let functions = "// Auto-generated validation functions\n\n";

    this.getAll().forEach((definition) => {
      const functionName = `validate${
        definition.id.charAt(0).toUpperCase() + definition.id.slice(1)
      }`;
      functions += `export function ${functionName}(data: any): { valid: boolean; errors: string[] } {\n`;
      functions += `  try {\n`;
      functions += `    // Validation for ${definition.id}\n`;
      functions += `    const errors: string[] = [];\n`;
      functions += `    \n`;

      // Generate validation logic from interface template
      definition.interfaceTemplate.properties.forEach((prop) => {
        if (!prop.optional) {
          functions += `    if (!data.${prop.name}) {\n`;
          functions += `      errors.push('${prop.name} is required');\n`;
          functions += `    }\n`;
        }

        if (prop.type === "string") {
          functions += `    if (data.${prop.name} && typeof data.${prop.name} !== 'string') {\n`;
          functions += `      errors.push('${prop.name} must be a string');\n`;
          functions += `    }\n`;
        } else if (prop.type === "number") {
          functions += `    if (data.${prop.name} && typeof data.${prop.name} !== 'number') {\n`;
          functions += `      errors.push('${prop.name} must be a number');\n`;
          functions += `    }\n`;
        } else if (prop.type === "boolean") {
          functions += `    if (data.${prop.name} && typeof data.${prop.name} !== 'boolean') {\n`;
          functions += `      errors.push('${prop.name} must be a boolean');\n`;
          functions += `    }\n`;
        }
      });

      functions += `    \n`;
      functions += `    return { valid: errors.length === 0, errors };\n`;
      functions += `  } catch (error) {\n`;
      functions += `    return { valid: false, errors: ['Unknown validation error'] };\n`;
      functions += `  }\n`;
      functions += `}\n\n`;
    });

    return functions;
  }

  /**
   * Validate a rule type definition
   */
  private validateDefinition(definition: RuleTypeDefinition): void {
    const errors: string[] = [];

    if (!definition.id) errors.push("Rule type ID is required");
    if (!definition.name) errors.push("Rule type name is required");
    if (!definition.description)
      errors.push("Rule type description is required");
    if (!definition.category) errors.push("Rule type category is required");
    if (!definition.version) errors.push("Rule type version is required");
    if (!definition.interfaceTemplate)
      errors.push("Interface template is required");
    if (!definition.databaseSchema) errors.push("Database schema is required");

    // Validate database schema
    if (definition.databaseSchema) {
      if (!definition.databaseSchema.tableName) {
        errors.push("Database table name is required");
      }
      if (
        !definition.databaseSchema.columns ||
        definition.databaseSchema.columns.length === 0
      ) {
        errors.push("At least one database column is required");
      }
    }

    if (errors.length > 0) {
      throw new Error(`Invalid rule type definition: ${errors.join(", ")}`);
    }
  }
}

// Export singleton instance
export const ruleTypeRegistry = RuleTypeRegistry.getInstance();
