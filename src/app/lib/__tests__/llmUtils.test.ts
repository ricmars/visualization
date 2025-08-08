import {
  extractToolCall,
  createStreamProcessor,
  getToolsContext,
  createStreamResponse,
} from "../llmUtils";

// Mock tools for testing
const mockTools = [
  {
    name: "saveCase",
    description: "Creates or updates a case",
    execute: jest.fn().mockResolvedValue({ id: 1, name: "Test Case" }),
  },
  {
    name: "saveField",
    description: "Test tool",
    execute: jest.fn(),
  },
];

describe("extractToolCall", () => {
  it("extracts a single tool call", () => {
    const text =
      'TOOL: saveCase PARAMS: {"name": "Test", "description": "Test case", "model": {"stages": []}}';
    const result = extractToolCall(text);
    expect(result).toEqual({
      toolName: "saveCase",
      params: {
        name: "Test",
        description: "Test case",
        model: { stages: [] },
      },
    });
  });

  it("extracts a tool call with nested JSON", () => {
    const text =
      'TOOL: saveView PARAMS: {"name": "View1", "caseid": 1, "model": {"fields": [{"fieldId": 1, "required": true}], "layout": {"type": "form", "columns": 1}}}';
    const result = extractToolCall(text);
    expect(result).toEqual({
      toolName: "saveView",
      params: {
        name: "View1",
        caseid: 1,
        model: {
          fields: [{ fieldId: 1, required: true }],
          layout: { type: "form", columns: 1 },
        },
      },
    });
  });

  it("extracts a tool call with braces in string values", () => {
    const text =
      'TOOL: saveField PARAMS: {"name": "description", "type": "Text", "caseid": 1, "label": "Description (optional)", "description": "Field with braces {like this}"}';
    const result = extractToolCall(text);
    expect(result).toEqual({
      toolName: "saveField",
      params: {
        name: "description",
        type: "Text",
        caseid: 1,
        label: "Description (optional)",
        description: "Field with braces {like this}",
      },
    });
  });

  it("extracts multiple tool calls sequentially", () => {
    const text = `TOOL: saveCase PARAMS: {"name": "Test", "description": "Test case", "model": {"stages": []}}
TOOL: saveField PARAMS: {"name": "field1", "type": "Text", "caseid": 1, "label": "Field 1"}
TOOL: saveView PARAMS: {"name": "View1", "caseid": 1, "model": {"fields": [], "layout": {"type": "form", "columns": 1}}}`;
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
    expect(toolCalls).toEqual(["saveCase", "saveField", "saveView"]);
  });

  it("returns null for text without tool calls", () => {
    const text = "This is just regular text without any tool calls";
    const result = extractToolCall(text);
    expect(result).toBeNull();
  });

  it("returns null for incomplete tool call", () => {
    const text = 'TOOL: saveCase PARAMS: {"name": "Test"';
    const result = extractToolCall(text);
    expect(result).toBeNull();
  });

  it("returns null for malformed JSON in params", () => {
    const text =
      'TOOL: saveCase PARAMS: {"name": "Test", "description": "Test case", "model": {"stages": [}}';
    const result = extractToolCall(text);
    expect(result).toBeNull();
  });

  it("handles escaped characters in JSON strings", () => {
    const text =
      'TOOL: saveField PARAMS: {"name": "description", "type": "Text", "description": "Field with \\"quotes\\" and \\\\backslashes\\\\"}';
    const result = extractToolCall(text);
    expect(result).toEqual({
      toolName: "saveField",
      params: {
        name: "description",
        type: "Text",
        description: 'Field with "quotes" and \\backslashes\\',
      },
    });
  });

  it("handles tool calls with newlines in the middle", () => {
    const text =
      'TOOL: saveCase PARAMS: {\n  "name": "test",\n  "description": "test"\n}';
    const result = extractToolCall(text);
    expect(result).toEqual({
      toolName: "saveCase",
      params: { name: "test", description: "test" },
    });
  });

  it("extracts tool calls from markdown code blocks", () => {
    const text =
      '```tool_code\nTOOL: saveCase PARAMS: {"name": "test", "description": "test"}\n```';
    const result = extractToolCall(text);
    expect(result).toEqual({
      toolName: "saveCase",
      params: { name: "test", description: "test" },
    });
  });

  it("extracts tool calls from regular markdown code blocks", () => {
    const text =
      '```\nTOOL: saveCase PARAMS: {"name": "test", "description": "test"}\n```';
    const result = extractToolCall(text);
    expect(result).toEqual({
      toolName: "saveCase",
      params: { name: "test", description: "test" },
    });
  });

  it("extracts a tool call with id for update", () => {
    const toolCallText =
      'TOOL: saveView PARAMS: {"id": 1, "name": "View1", "caseid": 1, "model": {"fields": [{"fieldId": 1, "required": true}], "layout": {"type": "form", "columns": 1}}, "stepName": "Test Step"}';

    const result = extractToolCall(toolCallText);
    expect(result).toEqual({
      toolName: "saveView",
      params: {
        id: 1,
        name: "View1",
        caseid: 1,
        model: {
          fields: [{ fieldId: 1, required: true }],
          layout: { type: "form", columns: 1 },
        },
        stepName: "Test Step",
      },
    });
  });

  it("extracts a tool call with id for saveField", () => {
    const toolCallText =
      'TOOL: saveField PARAMS: {"id": 1, "name": "description", "type": "Text", "description": "Field with \\"quotes\\" and \\\\backslashes\\\\"}';

    const result = extractToolCall(toolCallText);
    expect(result).toEqual({
      toolName: "saveField",
      params: {
        id: 1,
        name: "description",
        type: "Text",
        description: 'Field with "quotes" and \\backslashes\\',
      },
    });
  });

  it("extracts multiple tool calls with id for updates", () => {
    const toolCallText = `TOOL: saveField PARAMS: {"id": 1, "name": "field1", "type": "Text", "caseid": 1, "label": "Field 1"}
TOOL: saveView PARAMS: {"id": 1, "name": "View1", "caseid": 1, "model": {"fields": [], "layout": {"type": "form", "columns": 1}}, "stepName": "Test Step"}`;

    const result = extractToolCall(toolCallText);
    expect(result).toEqual({
      toolName: "saveField",
      params: {
        id: 1,
        name: "field1",
        type: "Text",
        caseid: 1,
        label: "Field 1",
      },
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
    await processor.processToolCall("saveCase", { name: "Test" });

    expect(mockWriter.write).toHaveBeenCalledWith(
      encoder.encode('data: {"text":"\\nExecuting saveCase...\\n"}\n\n'),
    );
    expect(mockWriter.write).toHaveBeenCalledWith(
      encoder.encode(
        'data: {"text":"\\nWorkflow \'Test Case\' saved successfully"}\n\n',
      ),
    );
  });

  it("handles tool execution errors", async () => {
    // Mock the tool to throw an error
    mockTools[0].execute.mockRejectedValueOnce(new Error("Database error"));

    await processor.processToolCall("saveCase", { name: "Test" });

    expect(mockWriter.write).toHaveBeenCalledWith(
      encoder.encode(
        'data: {"text":"\\nError executing saveCase: Database error\\n","error":"Database error"}\n\n',
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
    expect(context).toContain("saveCase");
    expect(context).toContain("saveField");
    expect(context).toContain(
      "Use these tools to complete workflow creation tasks",
    );
    expect(context).toContain(
      "Each tool contains detailed instructions for proper usage",
    );
  });
});

describe("createStreamResponse", () => {
  it("creates a proper stream response with correct headers", () => {
    const { stream, writer, encoder, response } = createStreamResponse();

    expect(stream).toBeDefined();
    expect(writer).toBeDefined();
    expect(encoder).toBeDefined();
    expect(response).toBeDefined();
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    expect(response.headers.get("Cache-Control")).toBe("no-cache");
    expect(response.headers.get("Connection")).toBe("keep-alive");
  });
});
