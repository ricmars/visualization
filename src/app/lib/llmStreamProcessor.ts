import { StreamProcessor, extractToolCall } from "./llmUtils";

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

          // Process all tool calls in the accumulated text
          let toolCallProcessed = false;
          let remainingText = accumulatedText;

          while (true) {
            const toolCall = extractToolCall(remainingText);
            if (toolCall) {
              console.log("Tool call detected:", toolCall);
              try {
                await processor.processToolCall(
                  toolCall.toolName,
                  toolCall.params,
                );
              } catch (error) {
                console.error("Error in processToolCall:", error);
                if (config.onError) {
                  config.onError(
                    error instanceof Error ? error : new Error(String(error)),
                  );
                }
                await processor.sendError(
                  error instanceof Error ? error.message : String(error),
                );
                // Continue processing other tool calls or text
              }
              toolCallProcessed = true;

              // Remove the processed tool call from the remaining text
              // Use a more flexible approach to handle different JSON formatting
              const toolCallRegex = new RegExp(
                `TOOL:\\s*${toolCall.toolName}\\s+PARAMS:\\s*{[\s\S]*?}\\s*(?:\\n|$)`,
                "g",
              );
              remainingText = remainingText.replace(toolCallRegex, "");

              // If the text didn't change, break to prevent infinite loop
              if (remainingText === accumulatedText) {
                console.warn(
                  "Tool call removal failed, breaking to prevent infinite loop",
                );
                break;
              }
            } else {
              break;
            }
          }

          // If we processed tool calls, update accumulated text to remaining text
          if (toolCallProcessed) {
            accumulatedText = remainingText;
          } else {
            // If no tool call was found, process as regular text
            await processor.processChunk(chunkText);
          }
        }
      }

      // Check for any remaining tool calls at the end of the stream
      if (accumulatedText) {
        let remainingText = accumulatedText;

        while (true) {
          const finalToolCall = extractToolCall(remainingText);
          if (finalToolCall) {
            console.log("Final tool call detected:", finalToolCall);
            try {
              await processor.processToolCall(
                finalToolCall.toolName,
                finalToolCall.params,
              );
            } catch (error) {
              console.error("Error in processToolCall:", error);
              if (config.onError) {
                config.onError(
                  error instanceof Error ? error : new Error(String(error)),
                );
              }
              await processor.sendError(
                error instanceof Error ? error.message : String(error),
              );
            }

            // Remove the processed tool call
            const toolCallRegex = new RegExp(
              `TOOL:\\s*${finalToolCall.toolName}\\s+PARAMS:\\s*{[\s\S]*?}\\s*(?:\\n|$)`,
              "g",
            );
            remainingText = remainingText.replace(toolCallRegex, "");

            // If the text didn't change, break to prevent infinite loop
            if (remainingText === accumulatedText) {
              console.warn(
                "Final tool call removal failed, breaking to prevent infinite loop",
              );
              break;
            }
          } else {
            break;
          }
        }

        // Process any remaining text
        if (remainingText.trim()) {
          await processor.processChunk(remainingText);
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
