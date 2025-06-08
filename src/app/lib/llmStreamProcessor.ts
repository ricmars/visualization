import { StreamProcessor, extractToolCall } from "./llmUtils";

export interface LLMStreamConfig {
  model: string;
  maxTokens?: number;
  temperature?: number;
}

export interface LLMStreamProcessor {
  processStream: (
    stream: AsyncIterable<any>,
    processor: StreamProcessor,
    config: {
      extractText: (
        chunk: any,
      ) => Promise<string | undefined> | string | undefined;
      onError?: (error: Error) => void;
    },
  ) => Promise<void>;
}

export class SharedLLMStreamProcessor implements LLMStreamProcessor {
  async processStream(
    stream: AsyncIterable<any>,
    processor: StreamProcessor,
    config: {
      extractText: (
        chunk: any,
      ) => Promise<string | undefined> | string | undefined;
      onError?: (error: Error) => void;
    },
  ) {
    let accumulatedText = "";

    try {
      for await (const chunk of stream) {
        const chunkText = await config.extractText(chunk);
        console.log("Chunk received:", chunkText);

        if (chunkText) {
          accumulatedText += chunkText;
          console.log("Accumulated text:", accumulatedText);

          // Try to extract a tool call from the accumulated text
          const toolCall = extractToolCall(accumulatedText);
          if (toolCall) {
            console.log("Tool call detected:", toolCall);
            await processor.processToolCall(toolCall.toolName, toolCall.params);
            // Clear the processed tool call from accumulated text
            accumulatedText = accumulatedText.replace(
              /TOOL:\s*\w+\s+PARAMS:\s*{[\s\S]*?}\s*(?:\n|$)/,
              "",
            );
          } else {
            // If no tool call was found, process as regular text
            await processor.processChunk(chunkText);
          }
        }
      }

      // Check for any remaining tool call at the end of the stream
      if (accumulatedText) {
        const finalToolCall = extractToolCall(accumulatedText);
        if (finalToolCall) {
          console.log("Final tool call detected:", finalToolCall);
          await processor.processToolCall(
            finalToolCall.toolName,
            finalToolCall.params,
          );
        } else {
          // Process any remaining text
          await processor.processChunk(accumulatedText);
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
    }
  }
}
