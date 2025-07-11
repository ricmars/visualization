import { getCompleteToolsContext } from "./databasePrompt";

// Add ToolResult type for tool result objects
export type ToolResult = {
  name?: string;
  fields?: unknown[];
  ids?: unknown[];
};

export interface Tool {
  name: string;
  description: string;
  execute: (params: unknown) => Promise<unknown>;
}

export interface StreamProcessor {
  processChunk: (chunk: string) => Promise<void>;
  processToolCall: (toolName: string, params: unknown) => Promise<void>;
  sendText: (text: string) => Promise<void>;
  sendError: (error: string) => Promise<void>;
  sendDone: () => Promise<void>;
}

export function createStreamProcessor(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  encoder: TextEncoder,
  databaseTools: Tool[],
): StreamProcessor {
  return {
    async processChunk(chunk: string) {
      console.log("StreamProcessor: Processing text chunk:", chunk);
      await writer.write(
        encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`),
      );
      console.log("StreamProcessor: Text chunk sent to client");
    },

    async processToolCall(toolName: string, params: unknown) {
      console.log("StreamProcessor: Starting tool execution for:", toolName);
      console.log(
        "StreamProcessor: Tool parameters:",
        JSON.stringify(params, null, 2),
      );

      try {
        const tool = databaseTools.find((t) => t.name === toolName);
        if (!tool) {
          console.error("StreamProcessor: Tool not found:", toolName);
          throw new Error(`Tool ${toolName} not found`);
        }

        console.log("StreamProcessor: Found tool:", tool.name);
        console.log(
          "StreamProcessor: Available tools:",
          databaseTools.map((t) => t.name),
        );

        // Send execution message
        console.log("StreamProcessor: Sending execution message to client");
        await writer.write(
          encoder.encode(
            `data: ${JSON.stringify({
              text: `\nExecuting ${tool.name}...\n`,
            })}\n\n`,
          ),
        );

        console.log(
          "StreamProcessor: Calling tool.execute with params:",
          params,
        );
        const result = await tool.execute(params);
        console.log("StreamProcessor: Tool execution completed successfully");
        console.log(
          "StreamProcessor: Tool result:",
          JSON.stringify(result, null, 2),
        );

        // Send user-friendly tool result message instead of raw JSON
        console.log("StreamProcessor: Sending tool result to client");
        const resultObj: ToolResult = result as ToolResult;
        let userMessage = "Operation completed successfully";

        if (toolName === "saveCase") {
          userMessage = `Workflow '${
            resultObj.name || "Unknown"
          }' saved successfully`;
        } else if (toolName === "saveView") {
          userMessage = `Saved '${resultObj.name || "Unknown"}'`;
        } else if (toolName === "saveFields") {
          const fieldCount =
            resultObj.fields?.length || resultObj.ids?.length || 0;
          userMessage = `Created ${fieldCount} field${
            fieldCount === 1 ? "" : "s"
          }`;
        }

        await writer.write(
          encoder.encode(
            `data: ${JSON.stringify({
              text: userMessage,
            })}\n\n`,
          ),
        );
        console.log("StreamProcessor: Tool result sent to client");
      } catch (error: unknown) {
        console.error("StreamProcessor: Error executing tool:", error);
        console.error(
          "StreamProcessor: Error stack:",
          error instanceof Error ? error.stack : "No stack trace",
        );
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        console.log("StreamProcessor: Sending error message to client");
        await writer.write(
          encoder.encode(
            `data: ${JSON.stringify({
              text: `\nError executing ${toolName}: ${errorMessage}\n`,
              error: errorMessage,
            })}\n\n`,
          ),
        );
        console.log("StreamProcessor: Error message sent to client");
      }
    },

    async sendText(text: string) {
      console.log("StreamProcessor: Sending text:", text);
      await writer.write(
        encoder.encode(`data: ${JSON.stringify({ text })}\n\n`),
      );
    },

    async sendError(error: string) {
      console.log("StreamProcessor: Sending error:", error);
      await writer.write(
        encoder.encode(
          `data: ${JSON.stringify({
            error: error,
          })}\n\n`,
        ),
      );
    },

    async sendDone() {
      console.log("StreamProcessor: Sending done signal");
      await writer.write(
        encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`),
      );
      console.log("StreamProcessor: Done signal sent");
    },
  };
}

export function getToolsContext(databaseTools: Tool[]): string {
  return getCompleteToolsContext(databaseTools);
}

export function createStreamResponse(): {
  stream: TransformStream;
  writer: WritableStreamDefaultWriter<Uint8Array>;
  encoder: TextEncoder;
  response: Response;
} {
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const response = new Response(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });

  return { stream, writer, encoder, response };
}

export function extractToolCall(
  text: string,
): { toolName: string; params: unknown } | null {
  // First, try to extract tool calls from markdown code blocks
  const codeBlockMatch = text.match(
    /```(?:tool_code)?\s*\n(TOOL:\s*\w+\s+PARAMS:\s*{[\s\S]*?})\s*\n```/,
  );
  if (codeBlockMatch) {
    const toolCallText = codeBlockMatch[1];
    const match = toolCallText.match(
      /TOOL:\s*(\w+)\s+PARAMS:\s*({[\s\S]*?})\s*(?:\n|$)/,
    );
    if (match) {
      const toolName = match[1];
      const paramsStr = match[2];

      try {
        const params = JSON.parse(paramsStr);
        return { toolName, params };
      } catch (e) {
        console.error("Failed to parse tool call params from code block:", e);
        console.error("Params string:", paramsStr);
      }
    }
  }

  // Use a regex to find the tool call pattern (original logic)
  const match = text.match(/TOOL:\s*(\w+)\s+PARAMS:\s*({[\s\S]*?})\s*(?:\n|$)/);
  if (!match) return null;

  const toolName = match[1];
  const paramsStr = match[2];

  // Try to parse the JSON directly first
  try {
    const params = JSON.parse(paramsStr);
    return { toolName, params };
  } catch (e) {
    // If direct parsing fails, try to clean up and complete the JSON
    console.log(
      "Direct JSON parsing failed, attempting to clean up:",
      paramsStr,
    );

    // Try to complete incomplete JSON by adding missing closing braces
    let completedJson = paramsStr;
    let braceCount = 0;
    let inString = false;
    let escapeNext = false;

    for (let i = 0; i < paramsStr.length; i++) {
      const char = paramsStr[i];

      // Handle string escaping
      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === "\\") {
        escapeNext = true;
        continue;
      }

      // Handle string boundaries
      if (char === '"' && !escapeNext) {
        inString = !inString;
        continue;
      }

      // Only count braces when not inside a string
      if (!inString) {
        if (char === "{") {
          braceCount++;
        }
        if (char === "}") {
          braceCount--;
        }
      }
    }

    // Add missing closing braces
    while (braceCount > 0) {
      completedJson += "}";
      braceCount--;
    }

    // Try to parse the completed JSON
    try {
      const params = JSON.parse(completedJson);
      console.log("Successfully parsed completed JSON:", completedJson);
      return { toolName, params };
    } catch (parseError) {
      console.error("Failed to parse completed JSON:", parseError);
      console.error("Completed JSON string:", completedJson);
    }

    // If all else fails, log the issue and return null
    console.error("Failed to parse tool call params:", e);
    console.error("Original params string:", paramsStr);
    return null;
  }
}
