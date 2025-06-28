import { NextResponse } from "next/server";
import OpenAI from "openai";
import {
  databaseSystemPrompt,
  exampleDatabaseResponse,
} from "../../lib/databasePrompt";
import { pool } from "../../lib/db";
import { getDatabaseTools } from "../../lib/llmTools";
import {
  createStreamProcessor,
  createStreamResponse,
  getToolsContext,
  Tool,
} from "../../lib/llmUtils";
import { openaiToolSchemas } from "../../lib/openaiToolSchemas";

// Add debug logging
console.log("OpenAI Route Environment Variables:", {
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  deployment: process.env.AZURE_OPENAI_DEPLOYMENT,
});

// Function to get Azure AD token
async function getAzureAccessToken() {
  const tokenEndpoint = `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/token`;
  const scope = "https://cognitiveservices.azure.com/.default";

  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.AZURE_CLIENT_ID!,
      client_secret: process.env.AZURE_CLIENT_SECRET!,
      scope: scope,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to get Azure access token: ${response.status}`);
  }

  const data = await response.json();
  return data.access_token;
}

// Initialize OpenAI client with Azure AD token
async function createOpenAIClient() {
  const token = await getAzureAccessToken();
  return new OpenAI({
    apiKey: "dummy", // Required by SDK but not used
    baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT}`,
    defaultQuery: { "api-version": "2024-02-15-preview" },
    defaultHeaders: { Authorization: `Bearer ${token}` },
  });
}

export async function POST(request: Request) {
  try {
    const { prompt, systemContext } = await request.json();
    console.log("Received request with prompt length:", prompt.length);

    // Get database tools
    const databaseTools = getDatabaseTools(pool) as Tool[];

    // Create OpenAI client with fresh token
    const openai = await createOpenAIClient();

    // Enhanced system prompt with tools context
    const toolsContext = getToolsContext(databaseTools);
    const enhancedSystemPrompt = `${databaseSystemPrompt}\n\n${toolsContext}\n\n${exampleDatabaseResponse}`;

    // Create streaming response
    const { writer, encoder, response } = createStreamResponse();
    const processor = createStreamProcessor(writer, encoder, databaseTools);

    (async () => {
      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: systemContext || enhancedSystemPrompt,
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 4000,
          stream: true,
          tools: openaiToolSchemas,
        });

        // Map to accumulate arguments for each tool_call.id
        const toolCallBuffers: Record<
          string,
          { name: string; arguments: string }
        > = {};

        for await (const chunk of completion) {
          // Handle tool calls (function calls)
          const toolCalls = chunk.choices[0]?.delta?.tool_calls;
          if (toolCalls && toolCalls.length > 0) {
            for (const toolCall of toolCalls) {
              if (
                toolCall.id &&
                toolCall.function &&
                typeof toolCall.function.name === "string" &&
                typeof toolCall.function.arguments === "string"
              ) {
                // Accumulate arguments for this tool_call.id
                if (!toolCallBuffers[toolCall.id]) {
                  toolCallBuffers[toolCall.id] = {
                    name: toolCall.function.name,
                    arguments: "",
                  };
                }
                toolCallBuffers[toolCall.id].arguments +=
                  toolCall.function.arguments;
                // Try to parse the arguments (if complete)
                try {
                  const args = JSON.parse(
                    toolCallBuffers[toolCall.id].arguments,
                  );
                  await processor.processToolCall(
                    toolCallBuffers[toolCall.id].name,
                    args,
                  );
                  // Remove from buffer after successful execution
                  delete toolCallBuffers[toolCall.id];
                } catch (_err) {
                  // Not valid JSON yet, keep accumulating
                }
              }
            }
            continue;
          }

          // Handle normal text streaming
          const content = chunk.choices[0]?.delta?.content || "";
          if (content) {
            await processor.processChunk(content);
          }
        }
        await processor.sendDone();
      } catch (error) {
        console.error("Error in streaming response:", error);
        await processor.sendError(
          error instanceof Error ? error.message : "Unknown error occurred",
        );
        await processor.sendDone();
      } finally {
        await writer.close();
      }
    })();

    return response;
  } catch (error) {
    console.error("API route error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
