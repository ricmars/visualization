import type { NextRequest } from "next/server";
import { POST } from "../openai/route";

type ToolExecute = (params: unknown) => Promise<unknown>;

type ToolMock = {
  name: string;
  description: string;
  execute: ToolExecute;
};

// Helper to create a tool mock
function createToolMock(name: string, executeImpl?: ToolExecute): ToolMock {
  return {
    name,
    description: `Mock tool for ${name}`,
    execute: jest.fn(
      executeImpl ?? (async () => ({ id: 1, name: name + " Result" })),
    ),
  };
}

// Default tool mocks for most tests
const defaultTools: ToolMock[] = [
  createToolMock("createCase", async (params) => ({
    id: 1,
    name: "Test Workflow",
    description: "A test workflow",
    model: '{"stages": []}',
  })),
  createToolMock("createField", async (params) => ({
    id: 2,
    name: "Test Field",
    type: "Text",
    caseID: 1,
    label: "Project Name",
  })),
];

// Mock the database and tools
jest.mock("../../lib/db", () => ({
  pool: {
    query: jest.fn(),
  },
}));

// We'll override this in specific tests as needed
jest.mock("../../lib/llmTools", () => ({
  getDatabaseTools: jest.fn(() => defaultTools),
}));

// Inline OpenAI mock to avoid hoisting issues
jest.mock("openai", () => {
  const mockCreate = jest.fn().mockResolvedValue({
    [Symbol.asyncIterator]: async function* () {
      // First chunk: text content
      yield {
        choices: [
          {
            delta: {
              content: "I'll create a new case for you.\n\n",
            },
          },
        ],
      };
      // Second chunk: start of tool call
      yield {
        choices: [
          {
            delta: {
              tool_calls: [
                {
                  id: "call_123",
                  function: {
                    name: "createCase",
                    arguments: '{"name": "Test Workflow"',
                  },
                },
              ],
            },
          },
        ],
      };
      // Third chunk: continue tool call arguments (only arguments field)
      yield {
        choices: [
          {
            delta: {
              tool_calls: [
                {
                  id: "call_123",
                  function: {
                    arguments: ', "description": "A test workflow"',
                  },
                },
              ],
            },
          },
        ],
      };
      // Fourth chunk: complete tool call arguments (only arguments field)
      yield {
        choices: [
          {
            delta: {
              tool_calls: [
                {
                  id: "call_123",
                  function: {
                    arguments: ', "model": {"stages": []}}',
                  },
                },
              ],
            },
          },
        ],
      };
    },
  });
  const mockOpenAI = jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  }));
  return {
    __esModule: true,
    default: mockOpenAI,
    mockCreate,
  };
});

// Mock Azure token fetch
global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: jest.fn().mockResolvedValue({ access_token: "mock-token" }),
});

// Helper function to parse SSE response
async function parseSSEResponse(
  response: Response,
): Promise<{ text: string[]; toolResults: unknown[]; errors: string[] }> {
  const text = await response.text();
  const lines = text.split("\n");
  const textMessages: string[] = [];
  const toolResults: unknown[] = [];
  const errors: string[] = [];

  for (const line of lines) {
    if (line.startsWith("data: ")) {
      try {
        const data = JSON.parse(line.slice(6));
        if (data.text) {
          textMessages.push(data.text);
        }
        if (data.toolResult) {
          toolResults.push(data.toolResult);
        }
        if (data.error) {
          errors.push(data.error);
        }
      } catch (_e) {
        // Ignore parsing errors for non-JSON lines
      }
    }
  }

  return { text: textMessages, toolResults, errors };
}

describe("OpenAI API Tool Calls", () => {
  let mockCreate: jest.Mock;
  let getDatabaseTools: jest.Mock;
  beforeEach(() => {
    jest.clearAllMocks();
    // Get the mockCreate function from the OpenAI mock
    mockCreate = require("openai").mockCreate;
    mockCreate.mockClear();
    getDatabaseTools = require("../../lib/llmTools").getDatabaseTools;
    getDatabaseTools.mockImplementation(() => defaultTools);
  });

  it("should extract and execute tool calls from AI response with multi-chunk arguments", async () => {
    const request = new Request("http://localhost:3000/api/openai", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: "Create a new workflow called 'Test Workflow'",
        systemContext:
          "You are a helpful AI assistant. Use the function calling API to create cases.",
      }),
    });

    const response = await POST(request as NextRequest);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");

    const { text, toolResults } = await parseSSEResponse(response);
    expect(text.join("")).toContain("I'll create a new case for you");
    expect(toolResults.length).toBeGreaterThan(0);
  });

  it("should handle responses without tool calls", async () => {
    // Mock OpenAI to return a response without tool calls
    mockCreate.mockResolvedValueOnce({
      [Symbol.asyncIterator]: async function* () {
        yield {
          choices: [
            {
              delta: {
                content: "This is a regular response without tool calls.",
              },
            },
          ],
        };
      },
    });

    const request = new Request("http://localhost:3000/api/openai", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: "Just give me some information",
        systemContext: "You are a helpful AI assistant.",
      }),
    });

    const response = await POST(request as NextRequest);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");

    const { text } = await parseSSEResponse(response);
    expect(text.join("")).toContain(
      "This is a regular response without tool calls",
    );
  });

  it("should handle tool execution errors gracefully", async () => {
    // Mock tool execution to throw an error and complete the tool call
    getDatabaseTools.mockImplementation(() => [
      createToolMock("createCase", async () => {
        throw new Error("Database error");
      }),
    ]);
    mockCreate.mockResolvedValueOnce({
      [Symbol.asyncIterator]: async function* () {
        yield {
          choices: [
            {
              delta: {
                content: "I'll create a new case for you.\n\n",
              },
            },
          ],
        };
        yield {
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    id: "call_123",
                    function: {
                      name: "createCase",
                      arguments: '{"name": "Test Workflow"',
                    },
                  },
                ],
              },
            },
          ],
        };
        yield {
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    id: "call_123",
                    function: {
                      arguments: ', "description": "A test workflow"',
                    },
                  },
                ],
              },
            },
          ],
        };
        yield {
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    id: "call_123",
                    function: {
                      arguments: ', "model": {"stages": []}}',
                    },
                  },
                ],
              },
            },
          ],
        };
      },
    });

    const request = new Request("http://localhost:3000/api/openai", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: "Create a new workflow",
        systemContext:
          "You are a helpful AI assistant. Use the function calling API to create cases.",
      }),
    });

    const response = await POST(request as NextRequest);
    expect(response.status).toBe(200); // Streaming responses return 200 even with errors
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");

    const { text, errors } = await parseSSEResponse(response);
    const fullText = text.join("");
    expect(fullText).toContain("I'll create a new case for you");
    expect(errors.join("")).toContain("Database error");
  });

  it("should handle incomplete tool call arguments gracefully", async () => {
    // Mock OpenAI to return incomplete tool call arguments
    mockCreate.mockResolvedValueOnce({
      [Symbol.asyncIterator]: async function* () {
        yield {
          choices: [
            {
              delta: {
                content: "I'll create a new case for you.\n\n",
              },
            },
          ],
        };
        // Start tool call with incomplete arguments
        yield {
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    id: "call_123",
                    function: {
                      name: "createCase",
                      arguments: '{"name": "Test Workflow"',
                    },
                  },
                ],
              },
            },
          ],
        };
        // End stream without completing the arguments
        // This should not cause a JSON parsing error
      },
    });

    const request = new Request("http://localhost:3000/api/openai", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: "Create a new workflow",
        systemContext:
          "You are a helpful AI assistant. Use the function calling API to create cases.",
      }),
    });

    const response = await POST(request as NextRequest);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");

    const { text } = await parseSSEResponse(response);
    expect(text.join("")).toContain("I'll create a new case for you");
    // Should not have executed the tool call due to incomplete arguments
  });

  it("should handle multiple tool calls with complex arguments", async () => {
    // Mock OpenAI to return multiple tool calls with complex arguments
    getDatabaseTools.mockImplementation(() => [
      createToolMock("createCase", async (params) => ({
        id: 1,
        name: "Complex Workflow",
      })),
      createToolMock("createField", async (params) => ({
        id: 2,
        name: "projectName",
      })),
    ]);
    mockCreate.mockResolvedValueOnce({
      [Symbol.asyncIterator]: async function* () {
        yield {
          choices: [
            {
              delta: {
                content: "I'll create a workflow with multiple components.\n\n",
              },
            },
          ],
        };
        // First tool call: createCase
        yield {
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    id: "call_1",
                    function: {
                      name: "createCase",
                      arguments:
                        '{"name": "Complex Workflow", "description": "A workflow with multiple stages"',
                    },
                  },
                ],
              },
            },
          ],
        };
        yield {
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    id: "call_1",
                    function: {
                      arguments:
                        ', "model": {"stages": [{"id": "stage1", "name": "Planning", "order": 1, "processes": []}]}}',
                    },
                  },
                ],
              },
            },
          ],
        };
        // Second tool call: createField
        yield {
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    id: "call_2",
                    function: {
                      name: "createField",
                      arguments:
                        '{"name": "projectName", "type": "Text", "caseID": 1, "label": "Project Name"',
                    },
                  },
                ],
              },
            },
          ],
        };
        yield {
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    id: "call_2",
                    function: {
                      arguments:
                        ', "description": "Name of the project", "primary": true, "required": true}',
                    },
                  },
                ],
              },
            },
          ],
        };
      },
    });

    const request = new Request("http://localhost:3000/api/openai", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: "Create a complex workflow with multiple components",
        systemContext:
          "You are a helpful AI assistant. Use the function calling API to create cases and fields.",
      }),
    });

    const response = await POST(request as NextRequest);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");

    const { text, toolResults } = await parseSSEResponse(response);
    expect(text.join("")).toContain(
      "I'll create a workflow with multiple components",
    );
    expect(toolResults.length).toBeGreaterThan(0);
  });
});
