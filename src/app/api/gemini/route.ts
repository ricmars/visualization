import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const generativeModel = genAI.getGenerativeModel({
  model: "gemini-2.0-flash-001",
  generationConfig: {
    maxOutputTokens: 8192,
  },
});

export async function POST(request: Request) {
  try {
    const { prompt, systemContext } = await request.json();
    console.error("Received request with prompt length:", prompt.length);

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
        console.error("Sent initial message");

        // Make the API call
        const requestPayload = {
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `${systemContext}\n\nUser request: ${prompt}\n\nIMPORTANT: Respond ONLY with a JSON object. Do not include any markdown formatting, code blocks, or explanatory text. The JSON response must exactly match the format specified above.`,
                },
              ],
            },
          ],
        };
        console.error("Sending request to Gemini");

        const streamingResp = await generativeModel.generateContentStream(
          requestPayload,
        );
        let accumulatedText = "";

        for await (const chunk of streamingResp.stream) {
          const chunkText = chunk.text();
          if (chunkText) {
            accumulatedText += chunkText;
            await writer.write(
              encoder.encode(
                `data: ${JSON.stringify({ text: chunkText })}\n\n`,
              ),
            );
          }
        }

        console.error("Final accumulated text:", accumulatedText);

        try {
          // Clean the text by removing markdown code block formatting
          accumulatedText = accumulatedText
            .replace(/^```json\n/, "")
            .replace(/\n```$/, "")
            .trim();

          // Add debug logging
          console.error(
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
          throw new Error("Invalid JSON structure in response text");
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
          console.error("Error while handling stream error:", e);
        }
      }
    })();

    // Return the stream response immediately
    console.error("Returning stream response");
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
