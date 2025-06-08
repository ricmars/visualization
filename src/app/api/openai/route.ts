import { NextResponse } from "next/server";
import OpenAI from "openai";
import {
  databaseSystemPrompt,
  exampleDatabaseResponse,
} from "../../lib/databasePrompt";
import {
  createStreamResponse,
  createStreamProcessor,
  getToolsContext,
} from "../../lib/llmUtils";
import { SharedLLMStreamProcessor } from "../../lib/llmStreamProcessor";

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

    // Create stream response using shared utility
    const { writer, encoder, response } = createStreamResponse();
    const processor = createStreamProcessor(writer, encoder);
    const streamProcessor = new SharedLLMStreamProcessor();

    // Process the stream in the background
    (async () => {
      try {
        // Send initial message to keep connection alive
        await processor.sendText('{"init":true}');
        console.log("Sent initial message");

        // Create OpenAI client with fresh token
        const openai = await createOpenAIClient();

        // Enhanced system prompt to ensure proper tool usage
        const enhancedSystemPrompt = `${databaseSystemPrompt}\n\n${getToolsContext()}\n\n${exampleDatabaseResponse}`;

        const completion = await openai.chat.completions.create({
          model: "gpt-4",
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
        });

        await streamProcessor.processStream(completion, processor, {
          extractText: (chunk) => chunk.choices[0]?.delta?.content,
          onError: (error) => {
            console.error("OpenAI stream processing error:", error);
          },
        });

        await writer.close();
      } catch (error) {
        console.error("Stream processing error:", error);
        await processor.sendError(
          error instanceof Error ? error.message : "Stream processing error",
        );
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
