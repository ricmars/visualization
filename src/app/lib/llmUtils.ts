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
      await writer.write(
        encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`),
      );
    },

    async processToolCall(toolName: string, params: unknown) {
      try {
        const tool = databaseTools.find((t) => t.name === toolName);
        if (!tool) {
          throw new Error(`Tool ${toolName} not found`);
        }

        // Send execution message
        await writer.write(
          encoder.encode(
            `data: ${JSON.stringify({
              text: `\nExecuting ${tool.name}...\n`,
            })}\n\n`,
          ),
        );

        const result = await tool.execute(params);

        // Send success message
        await writer.write(
          encoder.encode(
            `data: ${JSON.stringify({
              text: `\nSuccessfully executed ${tool.name}.\n`,
              toolResult: result,
            })}\n\n`,
          ),
        );
      } catch (error: unknown) {
        console.error("Error executing tool:", error);
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        await writer.write(
          encoder.encode(
            `data: ${JSON.stringify({
              text: `\nError executing ${toolName}: ${errorMessage}\n`,
              error: errorMessage,
            })}\n\n`,
          ),
        );
      }
    },

    async sendText(text: string) {
      await writer.write(
        encoder.encode(`data: ${JSON.stringify({ text })}\n\n`),
      );
    },

    async sendError(error: string) {
      await writer.write(
        encoder.encode(
          `data: ${JSON.stringify({
            error: error,
          })}\n\n`,
        ),
      );
    },

    async sendDone() {
      await writer.write(
        encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`),
      );
    },
  };
}

export function getToolsContext(databaseTools: Tool[]): string {
  return `Available tools:
${databaseTools.map((tool) => `- ${tool.name}: ${tool.description}`).join("\n")}

You can use these tools to interact with the database. When you want to use a tool, include a special format in your response:

TOOL: toolName
PARAMS: {"param1": "value1", "param2": "value2"}

This will be detected and the tool will be executed automatically.

IMPORTANT:
1. Always explain your reasoning before using tools
2. Show your thought process in the chat
3. Break down complex operations into steps
4. Confirm successful creation of each component
5. Handle errors gracefully and explain what went wrong`;
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
