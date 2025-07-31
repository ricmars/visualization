import { NextRequest, NextResponse } from "next/server";
import { pool } from "../../lib/db";
import {
  checkpointSessionManager,
  createCheckpointSharedTools,
} from "../../lib/checkpointTools";
import { SharedTool } from "../../lib/sharedTools";

// Initialize shared tools
let sharedTools: SharedTool<any, any>[] = [];
let toolsInitialized = false;

// Initialize tools when server starts
async function initializeTools() {
  try {
    if (!toolsInitialized) {
      console.log("Initializing checkpoint-aware shared tools for MCP...");

      // Test database connection first
      const client = await pool.connect();
      await client.query("SELECT 1");
      client.release();
      console.log("Database connection verified");

      sharedTools = createCheckpointSharedTools(pool); // Enable checkpoints for MCP
      toolsInitialized = true;
      console.log(
        `Initialized ${sharedTools.length} tools with checkpoint support`,
      );
    }
  } catch (error) {
    console.error("Error initializing tools:", error);
    // Don't throw error, just log it and continue with empty tools array
    toolsInitialized = true; // Mark as initialized to prevent infinite retries
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
          tools: sharedTools.map((tool: SharedTool<any, any>) => ({
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
      const tool = sharedTools.find(
        (t: SharedTool<any, any>) => t.name === name,
      );
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

      // Check if this is a database modification tool that needs checkpoint management
      const modificationTools = [
        "saveFields",
        "saveCase",
        "saveView",
        "deleteField",
        "deleteView",
        "createCase",
      ];
      const needsCheckpoint = modificationTools.includes(name);

      let checkpointSession = null;
      if (needsCheckpoint) {
        // Begin checkpoint session for database modification tools
        const mcpCommand = `MCP ${name}(${JSON.stringify(args).substring(
          0,
          100,
        )}...)`;

        // Get caseid from args if available, otherwise use a default
        const caseid = args.caseid || args.caseId || 1; // Default to 1 if no caseid provided

        checkpointSession = await checkpointSessionManager.beginSession(
          caseid,
          `MCP Tool: ${name}`,
          mcpCommand,
          "MCP",
        );
        console.log(
          `Started checkpoint session for MCP tool ${name}:`,
          checkpointSession.id,
        );
      }

      try {
        // Execute the tool
        const result = await tool.execute(args);

        console.log(`MCP HTTP Tool Result: ${name}`, result);

        // Commit checkpoint session on successful execution
        if (needsCheckpoint && checkpointSession) {
          await checkpointSessionManager.commitSession();
          console.log(`Committed checkpoint session for MCP tool ${name}`);
        }

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
        // Rollback checkpoint session on error
        if (needsCheckpoint && checkpointSession) {
          try {
            await checkpointSessionManager.rollbackSession();
            console.log(
              `Rolled back checkpoint session for MCP tool ${name} due to error`,
            );
          } catch (rollbackError) {
            console.error(
              `Failed to rollback checkpoint session for MCP tool ${name}:`,
              rollbackError,
            );
          }
        }
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
      console.log("MCP initialize request received");

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
    let requestBody;
    try {
      requestBody = await request.json();
    } catch {
      requestBody = {};
    }

    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: requestBody?.id || null,
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
        tools: sharedTools.map((tool: SharedTool<any, any>) => ({
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
