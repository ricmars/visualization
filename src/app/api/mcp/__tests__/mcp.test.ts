import { NextRequest } from "next/server";
import { POST, GET } from "../route";

// Mock the database pool
jest.mock("../../../lib/db", () => ({
  pool: {
    query: jest.fn(),
  },
}));

// Mock shared tools
jest.mock("../../../lib/sharedTools", () => ({
  createSharedTools: jest.fn(() => [
    {
      name: "testTool",
      description: "A test tool",
      parameters: {
        type: "object",
        properties: {
          testParam: { type: "string" },
        },
        required: ["testParam"],
      },
      execute: jest.fn().mockResolvedValue({ success: true }),
    },
  ]),
  convertToLLMTools: jest.fn((tools) => tools),
}));

describe("MCP Server", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/mcp", () => {
    it("should return server info and available tools", async () => {
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.server).toEqual({
        name: "workflow-tools-server",
        version: "1.0.0",
      });
      expect(data.tools).toHaveLength(1);
      expect(data.tools[0].name).toBe("testTool");
    });
  });

  describe("POST /api/mcp", () => {
    it("should handle tools/list request", async () => {
      const request = new NextRequest("http://localhost:3000/api/mcp", {
        method: "POST",
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/list",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.jsonrpc).toBe("2.0");
      expect(data.id).toBe(1);
      expect(data.result.tools).toHaveLength(1);
      expect(data.result.tools[0].name).toBe("testTool");
    });

    it("should handle tools/call request", async () => {
      const request = new NextRequest("http://localhost:3000/api/mcp", {
        method: "POST",
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: {
            name: "testTool",
            arguments: { testParam: "test" },
          },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.jsonrpc).toBe("2.0");
      expect(data.id).toBe(1);
      expect(data.result.content[0].text).toContain('"success": true');
    });

    it("should handle initialize request", async () => {
      const request = new NextRequest("http://localhost:3000/api/mcp", {
        method: "POST",
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.jsonrpc).toBe("2.0");
      expect(data.id).toBe(1);
      expect(data.result.protocolVersion).toBe("2024-11-05");
      expect(data.result.serverInfo.name).toBe("workflow-tools-server");
    });

    it("should handle unknown method", async () => {
      const request = new NextRequest("http://localhost:3000/api/mcp", {
        method: "POST",
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "unknown",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.jsonrpc).toBe("2.0");
      expect(data.id).toBe(1);
      expect(data.error.code).toBe(-32601);
      expect(data.error.message).toBe("Method not found");
    });

    it("should handle invalid JSON", async () => {
      const request = new NextRequest("http://localhost:3000/api/mcp", {
        method: "POST",
        body: "invalid json",
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.jsonrpc).toBe("2.0");
      expect(data.error.code).toBe(-32700);
      expect(data.error.message).toBe("Parse error");
    });
  });
});
