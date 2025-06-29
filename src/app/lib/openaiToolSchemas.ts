// OpenAI tool schemas for function calling API
// These schemas should match the parameter types in llmTools.ts
import type { ChatCompletionTool } from "openai/resources/chat/completions";

export const openaiToolSchemas: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "saveCase",
      description:
        "Creates a new case or updates an existing case. If id is provided, updates the case; otherwise, creates a new case.",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "integer",
            description: "Case ID (required for update, omit for create)",
          },
          name: { type: "string", description: "Case name" },
          description: { type: "string", description: "Case description" },
          model: {
            type: "object",
            description: "Workflow model with stages array",
            properties: {
              stages: { type: "array", items: {}, description: "Stages array" },
            },
            required: ["stages"],
          },
        },
        required: ["name", "description", "model"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "saveField",
      description:
        "Creates a new field or updates an existing field for the current case. If id is provided, updates the field; otherwise, creates a new field.",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "integer",
            description: "Field ID (required for update, omit for create)",
          },
          name: { type: "string", description: "Field name" },
          type: {
            type: "string",
            description: "Field type",
            enum: [
              "Text",
              "Address",
              "Email",
              "Date",
              "DateTime",
              "Status",
              "Currency",
              "Checkbox",
              "Dropdown",
              "RadioButtons",
              "RichText",
              "TextArea",
              "Time",
              "URL",
              "AutoComplete",
              "Decimal",
              "Integer",
              "Location",
              "ReferenceValues",
              "DataReferenceSingle",
              "DataReferenceMulti",
              "CaseReferenceSingle",
              "CaseReferenceMulti",
              "Percentage",
              "Phone",
              "UserReference",
            ],
          },
          caseID: { type: "integer", description: "Case ID" },
          primary: {
            type: "boolean",
            description: "Is primary field?",
            default: false,
          },
          required: {
            type: "boolean",
            description: "Is required?",
            default: false,
          },
          label: { type: "string", description: "Field label" },
          description: {
            type: "string",
            description: "Field description",
            default: "",
          },
          order: { type: "integer", description: "Display order", default: 0 },
          options: {
            type: "array",
            items: { type: "string" },
            description: "Field options",
            default: [],
          },
          defaultValue: { description: "Default value" },
        },
        required: ["name", "type", "caseID", "label"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "saveView",
      description:
        "Creates a new view or updates an existing view for the current case. If id is provided, updates the view; otherwise, creates a new view. The view name you create will be used as the step name in the workflow model.",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "integer",
            description: "View ID (required for update, omit for create)",
          },
          name: {
            type: "string",
            description:
              "View name (must be unique within the case, NO 'Form' suffix - use clean names like 'Request Details', 'Design Selection'). This name will be used as the step name in the workflow model.",
          },
          caseID: { type: "integer", description: "Case ID" },
          model: {
            type: "object",
            description:
              "View model with REQUIRED fields array (can be empty if no fields needed) AND REQUIRED layout object. CRITICAL: Distribute fields logically across views - don't put all fields in one view. Example: {fields: [{fieldId: 123, required: true, order: 1}], layout: {type: 'form', columns: 1}} or {fields: [], layout: {type: 'form', columns: 1}}",
            properties: {
              fields: {
                type: "array",
                description:
                  "Array of field references (can be empty if no fields needed, but distribute fields logically across views)",
                items: {
                  type: "object",
                  properties: {
                    fieldId: {
                      type: "integer",
                      description: "Field ID from the case",
                    },
                    required: {
                      type: "boolean",
                      description: "Is field required in this view",
                      default: false,
                    },
                    order: {
                      type: "integer",
                      description: "Display order of field in view",
                      default: 0,
                    },
                  },
                  required: ["fieldId"],
                },
              },
              layout: {
                type: "object",
                description: "Layout configuration for the view",
                properties: {
                  type: {
                    type: "string",
                    description: "Layout type: 'form', 'table', or 'card'",
                    enum: ["form", "table", "card"],
                  },
                  columns: {
                    type: "integer",
                    description: "Number of columns in the layout",
                    default: 1,
                  },
                },
                required: ["type"],
              },
            },
            required: ["fields", "layout"],
          },
        },
        required: ["name", "caseID", "model"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "deleteCase",
      description: "Deletes a case and all its associated fields and views.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "integer", description: "ID of the case to delete" },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "deleteField",
      description: "Deletes a field from a case.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "integer", description: "ID of the field to delete" },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getCase",
      description:
        "Gets the details of a specific case including its workflow model. CRITICAL: Use this FIRST before any other operations to see the current workflow structure. Required parameters: id (number). Example: getCase with id=123",
      parameters: {
        type: "object",
        properties: {
          id: { type: "integer", description: "ID of the case to retrieve" },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listFields",
      description:
        "Lists all fields for a specific case. CRITICAL: Use this FIRST before creating new fields to avoid duplicate names and to reuse existing fields. This helps you see what fields already exist so you can reuse them in views instead of creating duplicates.",
      parameters: {
        type: "object",
        properties: {
          caseID: {
            type: "integer",
            description: "ID of the case to list fields for",
          },
        },
        required: ["caseID"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listViews",
      description:
        "Lists all views for a specific case. CRITICAL: Use this FIRST before creating new views to avoid duplicate names and to reuse existing views. This helps you see what views already exist so you can reuse them or create variations instead of duplicates.",
      parameters: {
        type: "object",
        properties: {
          caseID: {
            type: "integer",
            description: "ID of the case to list views for",
          },
        },
        required: ["caseID"],
      },
    },
  },
];
