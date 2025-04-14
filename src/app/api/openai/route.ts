import { NextResponse } from "next/server";
import OpenAI from "openai";

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

    // Create a new TransformStream for streaming
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    // Start the response stream
    const streamResponse = new Response(stream.readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });

    // Process the stream in the background
    (async () => {
      try {
        // Send initial message to keep connection alive
        await writer.write(encoder.encode('data: {"init":true}\n\n'));
        console.log("Sent initial message");

        // Create OpenAI client with fresh token
        const openai = await createOpenAIClient();

        const completion = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [
            {
              role: "system",
              content: systemContext,
            },
            {
              role: "user",
              content: `${prompt}\n\nIMPORTANT: Respond ONLY with a JSON object. Do not include any markdown formatting, code blocks, or explanatory text. The JSON response must exactly match the format specified above.`,
            },
          ],
          temperature: 0.7,
          max_tokens: 4000,
          stream: true,
        });

        let accumulatedText = "";

        for await (const chunk of completion) {
          const content = chunk.choices[0]?.delta?.content;
          if (content) {
            accumulatedText += content;
            await writer.write(
              encoder.encode(`data: ${JSON.stringify({ text: content })}\n\n`),
            );
          }
        }

        console.log("Final accumulated text:", accumulatedText);

        try {
          // Clean the text by removing markdown code block formatting if present
          accumulatedText = accumulatedText
            .replace(/^```json\n/, "")
            .replace(/\n```$/, "")
            .trim();

          // Add debug logging
          console.log(
            "Attempting to parse JSON:",
            accumulatedText.substring(0, 100) + "...",
          );

          // Parse and validate the complete JSON
          let modelData;
          try {
            modelData = JSON.parse(accumulatedText);
          } catch (parseError: unknown) {
            if (parseError instanceof Error) {
              console.error("JSON Parse Error:", parseError);
              console.error("Problematic JSON text:", accumulatedText);
              throw new Error(
                `Failed to parse JSON response: ${parseError.message}`,
              );
            }
            throw new Error("Failed to parse JSON response: Unknown error");
          }

          if (
            !modelData.model ||
            (!modelData.model.stages && !modelData.model.fields)
          ) {
            throw new Error("Response missing required model data");
          }

          const validatedResponse = {
            message: modelData.message || "",
            model: {
              name: modelData.model.name || "",
              stages: Array.isArray(modelData.model.stages)
                ? modelData.model.stages
                : [],
              fields: Array.isArray(modelData.model.fields)
                ? modelData.model.fields
                : [],
            },
            action: modelData.action || { changes: [] },
            visualization: modelData.visualization || {
              totalStages: modelData.model.stages?.length || 0,
              stageBreakdown: [],
            },
          };

          // Send the final validated response
          await writer.write(
            encoder.encode(
              `data: ${JSON.stringify({ final: validatedResponse })}\n\n`,
            ),
          );
        } catch (error) {
          console.error("Error parsing model data:", error);
          throw new Error(
            error instanceof Error
              ? `Invalid JSON structure: ${error.message}`
              : "Invalid JSON structure in response text",
          );
        }

        await writer.close();
      } catch (error) {
        console.error("Stream processing error:", error);
        try {
          await writer.write(
            encoder.encode(
              `data: ${JSON.stringify({
                error:
                  error instanceof Error
                    ? error.message
                    : "Stream processing error",
              })}\n\n`,
            ),
          );
          await writer.close();
        } catch (e) {
          console.error(
            "Error while handling stream error:",
            e instanceof Error ? e.message : e,
          );
        }
      }
    })();

    // Return the stream response immediately
    console.log("Returning stream response");
    return streamResponse;
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
