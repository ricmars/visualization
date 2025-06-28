import {
  extractToolCall,
  createStreamProcessor,
  getToolsContext,
  createStreamResponse,
} from "../llmUtils";

// Mock tools for testing
const mockTools = [
  {
    name: "createCase",
    description: "Creates a new case",
    execute: jest.fn().mockResolvedValue({ id: 1, name: "Test Case" }),
  },
  {
    name: "createField",
    description: "Creates a new field",
    execute: jest.fn().mockResolvedValue({ id: 1, name: "Test Field" }),
  },
];

describe("extractToolCall", () => {
  it("extracts a single tool call", () => {
    const text =
      'TOOL: createCase PARAMS: {"name": "Test", "description": "Test case", "model": {"stages": []}}';
    const result = extractToolCall(text);
    expect(result).toEqual({
      toolName: "createCase",
      params: { name: "Test", description: "Test case", model: { stages: [] } },
    });
  });

  it("extracts a tool call with nested JSON", () => {
    const text =
      'TOOL: createView PARAMS: {"name": "View1", "caseID": 1, "model": {"fields": [{"fieldId": 1, "required": true}], "layout": {"type": "form", "columns": 1}}}';
    const result = extractToolCall(text);
    expect(result).toEqual({
      toolName: "createView",
      params: {
        name: "View1",
        caseID: 1,
        model: {
          fields: [{ fieldId: 1, required: true }],
          layout: { type: "form", columns: 1 },
        },
      },
    });
  });

  it("extracts a tool call with braces in string values", () => {
    const text =
      'TOOL: createField PARAMS: {"name": "description", "type": "Text", "caseID": 1, "label": "Description (optional)", "description": "Field with braces {like this}"}';
    const result = extractToolCall(text);
    expect(result).toEqual({
      toolName: "createField",
      params: {
        name: "description",
        type: "Text",
        caseID: 1,
        label: "Description (optional)",
        description: "Field with braces {like this}",
      },
    });
  });

  it("extracts multiple tool calls sequentially", () => {
    const text = `TOOL: createCase PARAMS: {"name": "Test", "description": "Test case", "model": {"stages": []}}
TOOL: createField PARAMS: {"name": "field1", "type": "Text", "caseID": 1, "label": "Field 1"}
TOOL: createView PARAMS: {"name": "View1", "caseID": 1, "model": {"fields": [], "layout": {"type": "form", "columns": 1}}}`;
    let remainingText = text;
    const toolCalls = [];
    while (true) {
      const toolCall = extractToolCall(remainingText);
      if (toolCall) {
        toolCalls.push(toolCall.toolName);
        // Remove the first tool call using a regex (matches the same as extractToolCall)
        remainingText = remainingText.replace(
          /TOOL:\s*\w+\s+PARAMS:\s*{[\s\S]*?}\s*(?:\n|$)/,
          "",
        );
      } else {
        break;
      }
    }
    expect(toolCalls).toEqual(["createCase", "createField", "createView"]);
  });

  it("returns null for text without tool calls", () => {
    const text = "This is just regular text without any tool calls";
    const result = extractToolCall(text);
    expect(result).toBeNull();
  });

  it("returns null for incomplete tool call", () => {
    const text = 'TOOL: createCase PARAMS: {"name": "Test"';
    const result = extractToolCall(text);
    expect(result).toBeNull();
  });

  it("returns null for malformed JSON in params", () => {
    const text =
      'TOOL: createCase PARAMS: {"name": "Test", "description": "Test case", "model": {"stages": [}}';
    const result = extractToolCall(text);
    expect(result).toBeNull();
  });

  it("handles escaped characters in JSON strings", () => {
    const text =
      'TOOL: createField PARAMS: {"name": "description", "type": "Text", "description": "Field with \\"quotes\\" and \\\\backslashes\\\\"}';
    const result = extractToolCall(text);
    expect(result).toEqual({
      toolName: "createField",
      params: {
        name: "description",
        type: "Text",
        description: 'Field with "quotes" and \\backslashes\\',
      },
    });
  });

  it("handles tool calls with newlines in the middle", () => {
    const text =
      'TOOL: createCase PARAMS: {\n  "name": "test",\n  "description": "test"\n}';
    const result = extractToolCall(text);
    expect(result).toEqual({
      toolName: "createCase",
      params: { name: "test", description: "test" },
    });
  });

  it("extracts tool calls from markdown code blocks", () => {
    const text =
      '```tool_code\nTOOL: createCase PARAMS: {"name": "test", "description": "test"}\n```';
    const result = extractToolCall(text);
    expect(result).toEqual({
      toolName: "createCase",
      params: { name: "test", description: "test" },
    });
  });

  it("extracts tool calls from regular markdown code blocks", () => {
    const text =
      '```\nTOOL: createCase PARAMS: {"name": "test", "description": "test"}\n```';
    const result = extractToolCall(text);
    expect(result).toEqual({
      toolName: "createCase",
      params: { name: "test", description: "test" },
    });
  });
});

describe("createStreamProcessor", () => {
  let mockWriter: jest.Mocked<WritableStreamDefaultWriter<Uint8Array>>;
  let encoder: TextEncoder;
  let processor: ReturnType<typeof createStreamProcessor>;

  beforeEach(() => {
    mockWriter = {
      write: jest.fn(),
      close: jest.fn(),
      releaseLock: jest.fn(),
      ready: Promise.resolve(),
      closed: Promise.resolve(),
      desiredSize: 1,
      abort: jest.fn(),
    };
    encoder = new TextEncoder();
    processor = createStreamProcessor(mockWriter, encoder, mockTools);
  });

  it("processes text chunks correctly", async () => {
    await processor.processChunk("Hello World");

    expect(mockWriter.write).toHaveBeenCalledWith(
      encoder.encode('data: {"text":"Hello World"}\n\n'),
    );
  });

  it("processes tool calls successfully", async () => {
    await processor.processToolCall("createCase", { name: "Test" });

    expect(mockWriter.write).toHaveBeenCalledWith(
      encoder.encode('data: {"text":"\\nExecuting createCase...\\n"}\n\n'),
    );
    expect(mockWriter.write).toHaveBeenCalledWith(
      encoder.encode(
        'data: {"text":"\\nSuccessfully executed createCase.\\n","toolResult":{"id":1,"name":"Test Case"}}\n\n',
      ),
    );
  });

  it("handles tool execution errors", async () => {
    // Mock the tool to throw an error
    mockTools[0].execute.mockRejectedValueOnce(new Error("Database error"));

    await processor.processToolCall("createCase", { name: "Test" });

    expect(mockWriter.write).toHaveBeenCalledWith(
      encoder.encode(
        'data: {"text":"\\nError executing createCase: Database error\\n","error":"Database error"}\n\n',
      ),
    );
  });

  it("handles non-existent tools", async () => {
    await processor.processToolCall("nonExistentTool", {});

    expect(mockWriter.write).toHaveBeenCalledWith(
      encoder.encode(
        'data: {"text":"\\nError executing nonExistentTool: Tool nonExistentTool not found\\n","error":"Tool nonExistentTool not found"}\n\n',
      ),
    );
  });

  it("sends text messages correctly", async () => {
    await processor.sendText("Custom message");

    expect(mockWriter.write).toHaveBeenCalledWith(
      encoder.encode('data: {"text":"Custom message"}\n\n'),
    );
  });

  it("sends error messages correctly", async () => {
    await processor.sendError("Error message");

    expect(mockWriter.write).toHaveBeenCalledWith(
      encoder.encode('data: {"error":"Error message"}\n\n'),
    );
  });

  it("sends done message correctly", async () => {
    await processor.sendDone();

    expect(mockWriter.write).toHaveBeenCalledWith(
      encoder.encode('data: {"done":true}\n\n'),
    );
  });
});

describe("getToolsContext", () => {
  it("returns a string containing tool information", () => {
    const context = getToolsContext(mockTools);
    expect(context).toContain("Available tools:");
    expect(context).toContain("createCase");
    expect(context).toContain("createField");
    expect(context).toContain("TOOL: toolName");
    expect(context).toContain("PARAMS:");
  });
});

describe("createStreamResponse", () => {
  it("creates a proper stream response with correct headers", () => {
    const { stream, writer, encoder, response } = createStreamResponse();

    expect(stream).toBeDefined();
    expect(writer).toBeDefined();
    expect(encoder).toBeDefined();
    expect(response).toBeDefined();
    expect(response.headers.get("content-type")).toBe("text/event-stream");
    expect(response.headers.get("cache-control")).toBe("no-cache");
    expect(response.headers.get("connection")).toBe("keep-alive");
  });
});
