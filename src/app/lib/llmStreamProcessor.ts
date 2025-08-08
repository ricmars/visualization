import { StreamProcessor } from "./llmUtils";

export interface LLMStreamConfig {
  model: string;
  maxTokens?: number;
  temperature?: number;
}

// Define types for stream chunks - make it more flexible to accommodate different LLM APIs
// Include Google Generative AI response type and OpenAI ChatCompletionChunk type
export type StreamChunk =
  | Record<string, unknown>
  | { text: () => Promise<string> | string }
  | { text: string }
  | { choices: Array<{ delta?: { content?: string } }> };

// Define types for the extractText function
export interface ExtractTextConfig {
  extractText: (
    chunk: StreamChunk,
  ) => Promise<string | undefined> | string | undefined;
  onError?: (error: Error) => void;
}

export interface LLMStreamProcessor {
  processStream: (
    stream: AsyncIterable<StreamChunk>,
    processor: StreamProcessor,
    config: ExtractTextConfig,
  ) => Promise<void>;
}

export class SharedLLMStreamProcessor implements LLMStreamProcessor {
  async processStream(
    stream: AsyncIterable<StreamChunk>,
    processor: StreamProcessor,
    config: ExtractTextConfig,
  ) {
    let accumulatedText = "";

    try {
      for await (const chunk of stream) {
        const chunkText = await config.extractText(chunk);
        console.log("Chunk received:", chunkText);

        if (chunkText) {
          accumulatedText += chunkText;
          console.log("Accumulated text:", accumulatedText);

          // DISABLED: Text-based tool call processing
          // Since we're using OpenAI function calling, we don't need to process text-based tool calls
          // This prevents errors from malformed text-based tool calls

          // Process as regular text only
          await processor.processChunk(chunkText);
        }
      }

      await processor.sendDone();
    } catch (error) {
      console.error("Stream processing error:", error);
      if (config.onError) {
        config.onError(
          error instanceof Error ? error : new Error(String(error)),
        );
      }
      await processor.sendError(
        error instanceof Error ? error.message : "Stream processing error",
      );
      await processor.sendDone();
    }
  }
}
