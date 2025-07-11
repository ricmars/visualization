import { NextRequest, NextResponse } from "next/server";
import { pool } from "../../lib/db";
import { createSharedTools } from "../../lib/sharedTools";

// Initialize shared tools
let sharedTools: ReturnType<typeof createSharedTools> = [];

// Initialize tools when server starts
async function initializeTools() {
  try {
    if (sharedTools.length === 0) {
      console.log("Initializing shared tools...");
      sharedTools = createSharedTools(pool);
      console.log(`Initialized ${sharedTools.length} tools`);
    }
  } catch (error) {
    console.error("Error initializing tools:", error);
    throw error;
  }
}

// Handle HTTP requests for MCP over HTTP
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    console.log(`MCP Request: ${body.method} (ID: ${body.id})`);

    // Handle MCP requests over HTTP
    if (body.method === "tools/list") {
      await initializeTools();

      const response = {
        jsonrpc: "2.0",
        id: body.id,
        result: {
          tools: sharedTools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.parameters,
          })),
        },
      };

      console.log(
        `MCP tools/list response sent in ${Date.now() - startTime}ms`,
      );
      return NextResponse.json(response, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    if (body.method === "tools/call") {
      await initializeTools();

      const { name, arguments: args } = body.params;

      console.log(`MCP HTTP Tool Call: ${name}`, args);

      // Find the tool
      const tool = sharedTools.find((t) => t.name === name);
      if (!tool) {
        return NextResponse.json(
          {
            jsonrpc: "2.0",
            id: body.id,
            error: {
              code: -32601,
              message: `Tool ${name} not found`,
            },
          },
          {
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
              "Access-Control-Allow-Headers": "Content-Type",
            },
          },
        );
      }

      try {
        // Execute the tool
        const result = await tool.execute(args);

        console.log(`MCP HTTP Tool Result: ${name}`, result);

        return NextResponse.json(
          {
            jsonrpc: "2.0",
            id: body.id,
            result: {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(result, null, 2),
                },
              ],
            },
          },
          {
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
              "Access-Control-Allow-Headers": "Content-Type",
            },
          },
        );
      } catch (error) {
        console.error(`MCP HTTP Tool Error: ${name}`, error);
        return NextResponse.json(
          {
            jsonrpc: "2.0",
            id: body.id,
            error: {
              code: -32603,
              message: `Tool execution failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          },
          {
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
              "Access-Control-Allow-Headers": "Content-Type",
            },
          },
        );
      }
    }

    // Handle initialization
    if (body.method === "initialize") {
      const response = {
        jsonrpc: "2.0",
        id: body.id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: {},
            resources: {},
            prompts: {},
          },
          serverInfo: {
            name: "workflow-tools-server",
            version: "1.0.0",
          },
        },
      };

      console.log(
        `MCP initialize response sent in ${Date.now() - startTime}ms`,
      );
      return NextResponse.json(response, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    // Handle resources/list
    if (body.method === "resources/list") {
      const response = {
        jsonrpc: "2.0",
        id: body.id,
        result: {
          resources: [],
        },
      };

      console.log(
        `MCP resources/list response sent in ${Date.now() - startTime}ms`,
      );
      return NextResponse.json(response, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    console.log(`MCP Method not found: ${body.method}`);
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: body.id,
        error: {
          code: -32601,
          message: "Method not found",
        },
      },
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      },
    );
  } catch (error) {
    console.error("MCP HTTP Error:", error);
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32700,
          message: "Parse error",
        },
      },
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      },
    );
  }
}

// Handle OPTIONS requests for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

// Handle GET requests for tool discovery
export async function GET() {
  try {
    await initializeTools();

    return NextResponse.json(
      {
        server: {
          name: "workflow-tools-server",
          version: "1.0.0",
        },
        tools: sharedTools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        })),
      },
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      },
    );
  } catch (error) {
    console.error("Error in GET /api/mcp:", error);
    return NextResponse.json(
      { error: "Failed to initialize tools" },
      {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      },
    );
  }
}
