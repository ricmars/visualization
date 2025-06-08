import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  createStreamResponse,
  createStreamProcessor,
  getToolsContext,
} from "@/app/lib/llmUtils";
import { SharedLLMStreamProcessor } from "../../lib/llmStreamProcessor";
import { databaseSystemPrompt } from "../../lib/databasePrompt";

// Initialize the Google Generative AI client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const generativeModel = genAI.getGenerativeModel({
  model: "gemini-2.0-flash-001",
  generationConfig: {
    maxOutputTokens: 8192,
  },
});

export async function POST(request: Request) {
  console.log("=== Gemini API Route Started ===");
  try {
    const { prompt, systemContext } = await request.json();
    const enhancedSystemPrompt = `${databaseSystemPrompt}\n\n${getToolsContext()}\n\n`;
    const context = systemContext || enhancedSystemPrompt;
    console.log("Request details:", {
      promptLength: prompt.length,
      systemContextLength: context.length,
      promptPreview: prompt.substring(0, 100) + "...",
      systemContextPreview: context.substring(0, 100) + "...",
    });

    const { writer, encoder, response } = createStreamResponse();
    const processor = createStreamProcessor(writer, encoder);
    const streamProcessor = new SharedLLMStreamProcessor();
    console.log("Stream response initialized");

    // Process the stream in the background
    (async () => {
      try {
        // Send initial message to keep connection alive
        await processor.sendText('{"init":true}');
        console.log("=== Initial Message Sent ===");

        const requestPayload = {
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `${context}\n\nUser request: ${prompt}`,
                },
              ],
            },
          ],
        };
        console.log("=== Request Payload Prepared ===", {
          contentLength: requestPayload.contents[0].parts[0].text.length,
          preview:
            requestPayload.contents[0].parts[0].text.substring(0, 100) + "...",
          hasToolsContext:
            requestPayload.contents[0].parts[0].text.includes(
              "Available tools:",
            ),
        });
        console.log(
          "Request payload:",
          JSON.stringify(requestPayload, null, 2),
        );

        console.log("=== Sending Request to Gemini API ===");
        const streamingResp = await generativeModel.generateContentStream(
          requestPayload,
        );
        console.log("=== Received Streaming Response from Gemini ===");

        await streamProcessor.processStream(streamingResp.stream, processor, {
          extractText: async (chunk) =>
            typeof chunk.text === "function" ? await chunk.text() : chunk.text,
          onError: (error) => {
            console.error("Gemini stream processing error:", error);
          },
        });

        await writer.close();
        console.log("=== Stream Closed Successfully ===");
      } catch (error) {
        console.error("=== Stream Processing Error ===", {
          error: error instanceof Error ? error.message : "Unknown error",
          stack: error instanceof Error ? error.stack : undefined,
        });
        try {
          await processor.sendError(
            error instanceof Error ? error.message : "Stream processing error",
          );
          await writer.close();
          console.log("=== Error Response Sent and Stream Closed ===");
        } catch (e) {
          console.error("=== Error While Handling Stream Error ===", {
            error: e instanceof Error ? e.message : "Unknown error",
            stack: e instanceof Error ? e.stack : undefined,
          });
        }
      }
    })();

    // Return the stream response immediately
    console.log("Returning stream response to client");
    return response;
  } catch (error) {
    console.log("Gemini route error catch block hit");
    console.error("API route error:", error);
    if (error instanceof Error) {
      console.error("Gemini Route Error Stack:", error.stack);
    }
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    );
  } finally {
    console.log("=== Gemini API Route Completed ===");
  }
}
