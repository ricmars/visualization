import { Stage, Field } from "../types";

export type ChatRole = "system" | "user" | "assistant";
export type LLMProvider = "ollama" | "gemini" | "openai";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface Response {
  content: string;
}

interface StageBreakdown {
  name: string;
  stepCount: number;
  steps: Array<{
    name: string;
    type: string;
  }>;
}

interface ChangeDetails {
  oldName?: string;
  newName?: string;
  [key: string]: string | undefined;
}

interface Change {
  type: "add" | "delete" | "move" | "update" | "rename";
  target: {
    type: "workflow" | "stage" | "process" | "step" | "field";
    name: string;
    details?: ChangeDetails;
  };
}

interface ValidatedResponse {
  message: string;
  model: {
    name: string;
    stages: Stage[];
    fields: Field[];
  };
  action: {
    changes: Change[];
  };
  visualization: {
    totalStages: number;
    stageBreakdown: StageBreakdown[];
  };
}

export class Service {
  private static readonly OLLAMA_BASE_URL = "http://localhost:11434/api";
  private static readonly OLLAMA_MODEL = "gemma3:27b";
  private static currentProvider: LLMProvider = "gemini";
  private static readonly SYSTEM_MESSAGE = `You are a workflow assistant that helps users modify and understand their workflow model.
The workflow model follows a strict structure with two main components:

1. Fields (Global Data Fields):
- Stored in a central fields array as complete field definitions
- Each field has:
  - name: Unique identifier across the entire application
  - label: Display label for the field
  - type: Data type (Text, TextArea, Dropdown, etc.)
  - primary: Optional boolean indicating if it's a primary field
  - value: REQUIRED sample value appropriate for the field type
  - options: Array of choices for Dropdown fields
- Fields are referenced by steps using FieldReferences that contain:
  - name: References the field definition's name
  - required: Boolean indicating if the field is required in that step

2. Stages, Processes and Steps:
- Stages: Sequential workflow phases, each containing processes
- Processes: Named groups of steps that can run in parallel or sequentially
- Steps: Individual tasks with properties:
  - name: Display name for the step
  - type: Action type (e.g., "Collect information", "Decision", "Automation", "Approve/Reject", "Create Case", "Generative AI")
  - fields: Array of FieldReferences (ONLY allowed for "Collect information" type steps)
  - status: Optional status indicator (e.g., "pending")

Key Rules and Constraints:
1. Field names must be unique across the entire application
2. Only steps of type "Collect information" can have fields
3. When a step's type changes from "Collect information", all its fields are removed
4. Field references should never be created without corresponding field definitions
5. Sample values must be contextually appropriate and match the field type
6. Primary fields should be used sparingly to highlight key information
7. The workflow name can be modified and should be descriptive of the workflow's purpose

When users request changes:
1. Validate the changes against these rules and constraints
2. Apply the requested modifications while preserving existing properties
3. Return a response containing:
- The complete updated model (fields and stages)
- A list of changes made (deltas)
- A visualization summary

Format your response as JSON with the following structure:
{
  "message": "Description of changes made",
  "model": {
    "name": "descriptive workflow name",
    "fields": [
      {
        "name": "uniqueIdentifier",
        "label": "Display Label",
        "type": "Text|TextArea|Dropdown",
        "primary": boolean,
        "options": ["option1", "option2"], // if applicable
        "value": "contextually appropriate sample value"
      }
    ],
    "stages": [
      {
        "name": "Stage Name",
        "processes": [{
          "name": "Process Name",
          "steps": [
            {
              "name": "Step Name",
              "type": "Collect information|Decision|Automation|Approve/Reject|Create Case|Generative AI",
              "status": "status if applicable",
              "fields": [
                {
                  "name": "reference to field name",
                  "required": boolean
                }
              ]
            }
          ]
        }]
      }
    ]
  },
  "action": {
    "changes": [
      {
        "type": "add|delete|move|update|rename",
        "target": {
          "type": "workflow|stage|process|step|field",
          "name": "item name",
          "details": {
            "oldName": "previous name (for rename actions)",
            "newName": "new name (for rename actions)",
            "other properties": "any other changed properties"
          }
        }
      }
    ]
  },
  "visualization": {
    "totalStages": number,
    "stageBreakdown": [
      {
        "name": "stage name",
        "stepCount": number,
        "steps": [{"name": "step name", "type": "step type"}]
      }
    ]
  }
}`;

  static setProvider(provider: LLMProvider) {
    this.currentProvider = provider;
  }

  static async generateResponse(
    prompt: string,
    currentModel?: { name: string; stages: Stage[]; fields: Field[] },
    onChunk?: (chunk: string) => void,
  ): Promise<string> {
    try {
      const systemContext = currentModel
        ? `${this.SYSTEM_MESSAGE}\n\nCurrent workflow model:\n${JSON.stringify(
            currentModel,
            null,
            2,
          )}`
        : this.SYSTEM_MESSAGE;

      if (this.currentProvider === "ollama") {
        return await this.generateOllamaResponse(prompt, systemContext);
      } else if (this.currentProvider === "gemini") {
        return await this.generateGeminiResponse(
          prompt,
          systemContext,
          onChunk,
        );
      } else {
        return await this.generateOpenAIResponse(
          prompt,
          systemContext,
          onChunk,
        );
      }
    } catch (error) {
      console.error(`Error calling ${this.currentProvider}:`, error);
      throw new Error(
        `Failed to generate response from ${this.currentProvider}`,
      );
    }
  }

  private static async generateOllamaResponse(
    prompt: string,
    systemContext: string,
  ): Promise<string> {
    const response = await fetch(`${this.OLLAMA_BASE_URL}/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.OLLAMA_MODEL,
        messages: [
          {
            role: "system",
            content: systemContext,
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return JSON.stringify(data.message.content);
  }

  private static async generateGeminiResponse(
    prompt: string,
    systemContext: string,
    onChunk?: (chunk: string) => void,
  ): Promise<string> {
    const response = await fetch("/api/gemini", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        systemContext,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(
        `API error (${response.status}): ${
          JSON.stringify(errorData) || response.statusText
        }`,
      );
    }

    // Handle streaming response
    if (response.headers.get("Content-Type")?.includes("text/event-stream")) {
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let finalResponse: ValidatedResponse | undefined;

      if (!reader) {
        throw new Error("No reader available from response");
      }

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.trim().startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.text && onChunk) {
                  onChunk(data.text);
                } else if (data.final) {
                  finalResponse = data.final;
                }
              } catch (e) {
                console.error("Error parsing SSE data:", e);
              }
            }
          }
        }

        if (!finalResponse) {
          throw new Error("No final response received from stream");
        }

        return JSON.stringify(finalResponse);
      } finally {
        reader.releaseLock();
      }
    }

    // Fallback to non-streaming response
    const data = await response.json();
    return JSON.stringify(data);
  }

  private static async generateOpenAIResponse(
    prompt: string,
    systemContext: string,
    onChunk?: (chunk: string) => void,
  ): Promise<string> {
    const response = await fetch("/api/openai", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        systemContext,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(
        `API error (${response.status}): ${
          JSON.stringify(errorData) || response.statusText
        }`,
      );
    }

    // Handle streaming response
    if (response.headers.get("Content-Type")?.includes("text/event-stream")) {
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let finalResponse: ValidatedResponse | undefined;

      if (!reader) {
        throw new Error("No reader available from response");
      }

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.trim().startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.text && onChunk) {
                  onChunk(data.text);
                } else if (data.final) {
                  finalResponse = data.final;
                }
              } catch (e) {
                console.error("Error parsing SSE data:", e);
              }
            }
          }
        }

        if (!finalResponse) {
          throw new Error("No final response received from stream");
        }

        return JSON.stringify(finalResponse);
      } finally {
        reader.releaseLock();
      }
    }

    // Fallback to non-streaming response
    const data = await response.json();
    return JSON.stringify(data);
  }

  static async chat(message: string): Promise<Response> {
    // Simulate API call
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          content: `Processed: ${message}`,
        });
      }, 1000);
    });
  }
}
