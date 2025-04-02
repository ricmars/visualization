import { Stage, Field } from '../types';

export type ChatRole = 'system' | 'user' | 'assistant';
export type LLMProvider = 'ollama' | 'gemini';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface Response {
  content: string;
}

export class Service {
  private static readonly OLLAMA_BASE_URL = 'http://localhost:11434/api';
  private static readonly OLLAMA_MODEL = 'mistral';
  private static currentProvider: LLMProvider = 'gemini';
  private static readonly SYSTEM_MESSAGE = `You are a workflow assistant that helps users modify and understand their workflow model.
The workflow model consists of two main components:

1. Fields (Global Data Fields):
- Reusable data points that can be referenced across the workflow
- Each field has: id, label, type, and optional configuration (like options for select fields)
- Fields can be assigned to steps where data needs to be collected or processed

2. Stages and Steps:
- Stages: Sequential phases in the workflow, each containing steps
- Steps: Individual tasks within a stage, with properties:
  - name: The step's display name
  - type: The type of action (e.g., "Collect information", "Approve/Reject")
  - fields: References to global fields that are used in this step

When users request changes:
1. Analyze the current model state (both fields and stages)
2. Apply the requested changes
3. Return a response containing:
- The updated complete model (including both fields and stages)
- A list of changes (deltas) showing what was modified
- A visualization summary of the workflow state

Format your response as JSON with the following structure:
{
  "message": "Description of changes made",
  "model": {
    "fields": [
      {
        "id": "field_id",
        "label": "Field Label",
        "type": "text|select|number|etc",
        "options": ["option1", "option2"] // if applicable
      }
    ],
    "stages": [
      {
        "id": "stage_id",
        "name": "Stage Name",
        "steps": [
          {
            "id": "step_id",
            "name": "Step Name",
            "type": "Step Type",
            "fields": [
              {
                "id": "field_id"
                // other field properties when needed
              }
            ]
          }
        ]
      }
    ]
  },
  "action": {
    "changes": [
      {
        "type": "add|delete|move|update",
        "target": {
          "type": "stage|step|field",
          "name": "item name",
          // Additional target details
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
        "steps": [{"name": "step name"}]
      }
    ]
  }
}`;

  static setProvider(provider: LLMProvider) {
    this.currentProvider = provider;
  }

  static async generateResponse(prompt: string, currentModel?: { stages: Stage[]; fields: Field[] }): Promise<string> {
    try {
      const systemContext = currentModel ? 
        `${this.SYSTEM_MESSAGE}\n\nCurrent workflow model:\n${JSON.stringify(currentModel, null, 2)}` :
        this.SYSTEM_MESSAGE;

      if (this.currentProvider === 'ollama') {
        return await this.generateOllamaResponse(prompt, systemContext);
      } else {
        return await this.generateGeminiResponse(prompt, systemContext);
      }
    } catch (error) {
      console.error(`Error calling ${this.currentProvider}:`, error);
      throw new Error(`Failed to generate response from ${this.currentProvider}`);
    }
  }

  private static async generateOllamaResponse(prompt: string, systemContext: string): Promise<string> {
    const response = await fetch(`${this.OLLAMA_BASE_URL}/generate`, {
      method: 'POST',
      mode: "cors" as RequestMode,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.OLLAMA_MODEL,
        messages: [
          {
            role: 'system',
            content: systemContext
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        stream: false
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json() as Response;
    return data.content;
  }

  private static async generateGeminiResponse(prompt: string, systemContext: string): Promise<string> {
    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        systemContext
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(`API error (${response.status}): ${JSON.stringify(errorData) || response.statusText}`);
    }

    const data = await response.json();
    return JSON.stringify(data);
  }

  static async chat(message: string): Promise<Response> {
    // Simulate API call
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          content: `Processed: ${message}`
        });
      }, 1000);
    });
  }
} 