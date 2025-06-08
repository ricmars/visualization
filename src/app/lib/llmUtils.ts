import { databaseTools } from "./llmTools";

export interface Tool {
  name: string;
  description: string;
  execute: (params: any) => Promise<any>;
}

export interface StreamProcessor {
  processChunk: (chunk: string) => Promise<void>;
  processToolCall: (toolName: string, params: any) => Promise<void>;
  sendText: (text: string) => Promise<void>;
  sendError: (error: string) => Promise<void>;
  sendDone: () => Promise<void>;
}

export function createStreamProcessor(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  encoder: TextEncoder,
): StreamProcessor {
  return {
    async processChunk(chunk: string) {
      await writer.write(
        encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`),
      );
    },

    async processToolCall(toolName: string, params: any) {
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
      } catch (error: any) {
        console.error("Error executing tool:", error);
        await writer.write(
          encoder.encode(
            `data: ${JSON.stringify({
              text: `\nError executing ${toolName}: ${error.message}\n`,
              error: error.message,
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

export function getToolsContext(): string {
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
): { toolName: string; params: any } | null {
  // Use a regex to find the tool call pattern
  const match = text.match(/TOOL:\s*(\w+)\s+PARAMS:\s*({[\s\S]*?})\s*(?:\n|$)/);
  if (!match) return null;

  const toolName = match[1];
  const paramsStr = match[2];

  // Count braces to ensure we have a complete JSON object
  let braceCount = 0;
  let completeParamsStr = "";
  for (let i = 0; i < paramsStr.length; i++) {
    const char = paramsStr[i];
    if (char === "{") braceCount++;
    if (char === "}") braceCount--;
    completeParamsStr += char;
    if (braceCount === 0) break;
  }

  // If braces are not balanced, the tool call is incomplete
  if (braceCount !== 0) return null;

  try {
    const params = JSON.parse(completeParamsStr);
    return { toolName, params };
  } catch (e) {
    console.error("Failed to parse tool call params:", e);
    return null;
  }
}
