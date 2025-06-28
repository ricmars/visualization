// OpenAI tool schemas for function calling API
// These schemas should match the parameter types in llmTools.ts
import type { ChatCompletionTool } from "openai/resources/chat/completions";

export const openaiToolSchemas: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "createCase",
      description: "Creates a new case in the database.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Name of the case" },
          description: {
            type: "string",
            description: "Description of the case",
          },
          model: {
            type: "object",
            description: "Workflow model structure (stages, etc.)",
          },
        },
        required: ["name", "description", "model"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "updateCase",
      description: "Updates an existing case in the database.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "integer", description: "ID of the case to update" },
          name: { type: "string", description: "Name of the case" },
          description: {
            type: "string",
            description: "Description of the case",
          },
          model: {
            type: "object",
            description: "Workflow model structure (stages, etc.)",
          },
        },
        required: ["id", "name", "description", "model"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "createField",
      description: "Creates a new field for the current case.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Field name" },
          type: { type: "string", description: "Field type" },
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
      name: "createView",
      description: "Creates a new view for the current case.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "View name" },
          caseID: { type: "integer", description: "Case ID" },
          model: { type: "object", description: "View model (fields, layout)" },
          stepName: {
            type: "string",
            description: "Step name for which this view is created",
          },
        },
        required: ["name", "caseID", "model", "stepName"],
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
];
