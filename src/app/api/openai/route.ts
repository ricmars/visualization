import { NextResponse } from "next/server";
import OpenAI from "openai";
import { buildDatabaseSystemPrompt } from "../../lib/databasePrompt";
import { pool } from "../../lib/db";

import {
  createStreamProcessor,
  createStreamResponse,
  getToolsContext,
  Tool,
} from "../../lib/llmUtils";
import { openaiToolSchemas } from "../../lib/openaiToolSchemas";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import {
  checkpointSessionManager,
  createCheckpointSharedTools,
} from "../../lib/checkpointTools";
import { SharedTool } from "../../lib/sharedTools";

// Add debug logging
console.log("OpenAI Route Environment Variables:", {
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  deployment: process.env.AZURE_OPENAI_DEPLOYMENT,
});

// Cache for Azure access token to avoid repeated token requests
let cachedToken: { token: string; expiresAt: number } | null = null;

// Function to get Azure AD token with caching
async function getAzureAccessToken() {
  // Check if we have a valid cached token
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    console.log("Using cached Azure access token");
    return cachedToken.token;
  }

  console.log("Getting Azure access token...");
  const tokenEndpoint = `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/token`;
  const scope = "https://cognitiveservices.azure.com/.default";

  console.log("Token endpoint:", tokenEndpoint);
  console.log("Scope:", scope);

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

  console.log("Token response status:", response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Token response error:", errorText);
    throw new Error(
      `Failed to get Azure access token: ${response.status} - ${errorText}`,
    );
  }

  const data = await response.json();
  console.log("Token received successfully");

  // Cache the token for 50 minutes (tokens typically expire in 1 hour)
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + 50 * 60 * 1000, // 50 minutes
  };

  return data.access_token;
}

// Initialize OpenAI client with Azure AD token
async function createOpenAIClient() {
  console.log("Creating OpenAI client...");
  const token = await getAzureAccessToken();
  const baseURL = `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT}`;
  console.log("OpenAI base URL:", baseURL);

  const client = new OpenAI({
    apiKey: "dummy", // Required by SDK but not used
    baseURL: baseURL,
    defaultQuery: { "api-version": "2024-12-01-preview" },
    defaultHeaders: { Authorization: `Bearer ${token}` },
  });

  console.log("OpenAI client created successfully");
  return client;
}

// Define interfaces for OpenAI response types
interface OpenAICompletion {
  [Symbol.asyncIterator](): AsyncIterator<{
    choices: Array<{
      delta?: {
        content?: string;
        tool_calls?: Array<{
          index: number;
          id: string;
          function?: {
            name?: string;
            arguments?: string;
          };
        }>;
      };
      finish_reason?: string;
    }>;
  }>;
}

interface ToolCall {
  index: number;
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

type ToolResult = {
  name?: string;
  fields?: unknown[];
  ids?: unknown[];
};

export async function POST(request: Request) {
  console.log("=== OpenAI POST request started ===");
  const startTime = Date.now();

  try {
    const { prompt, systemContext } = await request.json();
    console.log("Received request with prompt length:", prompt.length);
    console.log("Prompt preview:", prompt.substring(0, 100) + "...");
    console.log("System context length:", systemContext?.length || 0);

    // Parse system context to check if we're working with an existing workflow
    let currentCaseId: number | null = null;
    let _isExistingWorkflow = false;
    if (systemContext) {
      try {
        const contextData = JSON.parse(systemContext);
        console.log("Parsed system context:", contextData);
        if (contextData.currentCaseId) {
          currentCaseId = contextData.currentCaseId;
          _isExistingWorkflow = true;
          console.log(
            "Detected existing workflow with case ID:",
            currentCaseId,
          );
        }
      } catch (_parseError) {
        console.log("System context is not JSON; proceeding without it");
      }
    }

    // Keep the original user prompt as-is; rely on tool descriptions, not prompt grafting
    const enhancedPrompt = prompt;

    // Get checkpoint-aware database tools (unified approach)
    console.log("Getting checkpoint-aware database tools...");
    const sharedTools = createCheckpointSharedTools(pool); // Use unified checkpoint approach
    let databaseTools = sharedTools.map((tool: SharedTool<any, any>) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
      execute: tool.execute,
    })) as Tool[];
    console.log("Database tools count:", databaseTools.length);
    console.log(
      "Available tools:",
      databaseTools.map((t) => t.name),
    );

    // Filter out createCase if working on an existing workflow
    let filteredTools = databaseTools;
    if (currentCaseId) {
      filteredTools = databaseTools.filter((t) => t.name !== "createCase");
    }

    // Rely on tool descriptions and system guidance (no heuristic gating)

    // Create OpenAI client with fresh token
    console.log("Creating OpenAI client...");
    const openai = await createOpenAIClient();

    // Build lightweight system prompt
    const systemCore = buildDatabaseSystemPrompt();
    const contextLine = `Context: caseId=${currentCaseId ?? "NEW"}; mode=${
      currentCaseId ? "EXISTING" : "NEW"
    }`;
    const enhancedSystemPrompt = `${systemCore}

Use ONLY the provided tools. Tool descriptions are authoritative. Destructive tools must be called ONLY when the user is explicit; if unsure, ask for confirmation.
${getToolsContext(filteredTools)}
${contextLine}`;

    console.log("Building enhanced system prompt...");
    console.log("Enhanced system prompt length:", enhancedSystemPrompt.length);

    // Create streaming response
    console.log("Creating streaming response...");
    const { writer, encoder, response } = createStreamResponse();
    const processor = createStreamProcessor(writer, encoder, filteredTools);

    (async () => {
      try {
        // Function call loop
        let messages: ChatCompletionMessageParam[] = [
          { role: "system", content: enhancedSystemPrompt },
          { role: "user", content: enhancedPrompt },
        ];
        let loopCount = 0;
        let done = false;
        let nudgedToUseTools = false;
        let toolCallHistory: Array<{
          tool: string;
          timestamp: number;
          duration?: number;
        }> = [];
        // When we ask the model for a post-condition confirmation, we set this
        // so the next assistant message (without tool calls) is treated as final
        // instead of being nudged to use tools again.
        let awaitingPostCheckConfirmation = false;

        // Context management: Remove duplicates and keep only essential messages
        const trimMessages = () => {
          // Remove duplicate system prompts and error messages
          const cleanedMessages: ChatCompletionMessageParam[] = [];
          const seenContent = new Set<string>();

          for (const message of messages) {
            const content =
              typeof message.content === "string"
                ? message.content
                : JSON.stringify(message);

            // Skip duplicate system prompts and error messages
            if (message.role === "system") {
              if (!seenContent.has("system")) {
                cleanedMessages.push(message);
                seenContent.add("system");
              }
            } else if (
              message.role === "user" &&
              content.includes("🚨 WORKFLOW INCOMPLETE")
            ) {
              // Keep only the most recent error message
              const existingErrorIndex = cleanedMessages.findIndex(
                (m) =>
                  typeof m.content === "string" &&
                  m.content.includes("🚨 WORKFLOW INCOMPLETE"),
              );
              if (existingErrorIndex >= 0) {
                cleanedMessages[existingErrorIndex] = message;
              } else {
                cleanedMessages.push(message);
              }
            } else if (message.role === "tool") {
              // Always keep tool results (they contain important IDs)
              cleanedMessages.push(message);
            } else if (message.role === "assistant") {
              // Always keep assistant messages (they contain tool calls)
              cleanedMessages.push(message);
            } else {
              // Keep other user messages
              cleanedMessages.push(message);
            }
          }

          // Only update if we actually removed duplicates
          if (cleanedMessages.length < messages.length) {
            const originalCount = messages.length;
            messages.length = 0;
            messages.push(...cleanedMessages);

            const approximateTokens = messages.reduce((total, msg) => {
              const content =
                typeof msg.content === "string"
                  ? msg.content
                  : JSON.stringify(msg);
              return total + Math.ceil(content.length / 4);
            }, 0);

            console.log(
              `Cleaned context: ${originalCount} → ${messages.length} messages, ~${approximateTokens} tokens`,
            );
          } else {
            const approximateTokens = messages.reduce((total, msg) => {
              const content =
                typeof msg.content === "string"
                  ? msg.content
                  : JSON.stringify(msg);
              return total + Math.ceil(content.length / 4);
            }, 0);

            console.log(
              `Context: ${messages.length} messages, ~${approximateTokens} tokens`,
            );
          }
        };

        console.log("=== Starting LLM function call loop ===");
        console.log(
          "Initial prompt:",
          enhancedPrompt.substring(0, 200) + "...",
        );

        // Begin checkpoint session for this LLM interaction (only if we have a case ID)
        let checkpointSession = null;
        if (currentCaseId) {
          checkpointSession = await checkpointSessionManager.beginSession(
            currentCaseId,
            `LLM Tool Execution: ${enhancedPrompt.substring(0, 50)}...`,
            prompt, // Store the original user command
            "LLM",
          );
          console.log("Started checkpoint session:", checkpointSession.id);
        } else {
          console.log(
            "No case ID available, skipping checkpoint session for new workflow creation",
          );
        }

        while (!done && loopCount < 30) {
          // Force completion if we're at max iterations
          if (loopCount >= 30) {
            console.log("Reached maximum iterations, forcing completion");
            done = true;
            break;
          }

          loopCount++;
          const loopStartTime = Date.now();
          console.log(
            `=== Function call loop iteration ${loopCount} (${
              Date.now() - startTime
            }ms elapsed) ===`,
          );

          try {
            console.log(`Calling OpenAI API (iteration ${loopCount})...`);
            const apiCallStartTime = Date.now();

            // Add timeout to prevent long delays (1 minute)
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(
                () => reject(new Error("OpenAI API timeout after 1 minute")),
                60000,
              );
            });

            // Log message count and approximate token usage
            const messageCount = messages.length;
            const approximateTokens = messages.reduce((total, msg) => {
              const content =
                typeof msg.content === "string"
                  ? msg.content
                  : JSON.stringify(msg);
              return total + Math.ceil(content.length / 4); // Rough estimate: 4 chars per token
            }, 0);
            console.log(
              `Message count: ${messageCount}, Approximate tokens: ${approximateTokens}`,
            );
            // console.log("messages XXXX:", messages);

            const completionPromise = openai.chat.completions.create({
              model: process.env.AZURE_OPENAI_DEPLOYMENT!,
              messages,
              max_completion_tokens: 6000, // Reduced for faster generation
              stream: true, // Enable streaming for faster responses
              tools: openaiToolSchemas,
            });

            const completion = (await Promise.race([
              completionPromise,
              timeoutPromise,
            ])) as OpenAICompletion;
            const apiCallDuration = Date.now() - apiCallStartTime;
            console.log(
              `OpenAI API call completed in ${apiCallDuration}ms (${Math.round(
                apiCallDuration / 1000,
              )}s)`,
            );

            // Handle streaming response
            let fullContent = "";
            let toolCalls: ToolCall[] = [];
            let finishReason = "";
            const streamingStartTime = Date.now();
            let accumulatedStreamText = "";
            // Track whether we've already sent any streamed text to the client
            let didStreamContent = false;

            try {
              for await (const chunk of completion) {
                const choice = chunk.choices[0];
                if (choice?.delta?.content) {
                  const contentChunk = choice.delta.content;
                  fullContent += contentChunk;
                  accumulatedStreamText += contentChunk;

                  // Send accumulated text periodically to avoid word-by-word streaming
                  // Send when we have a complete sentence or after a certain amount of text
                  // Stream brief reasoning to the user, but batch by sentence/newline
                  if (
                    accumulatedStreamText.includes(".") ||
                    accumulatedStreamText.includes("\n") ||
                    accumulatedStreamText.length > 120
                  ) {
                    await processor.sendText(accumulatedStreamText);
                    didStreamContent = true;
                    accumulatedStreamText = "";
                  }
                }
                if (choice?.delta?.tool_calls) {
                  for (const toolCall of choice.delta.tool_calls) {
                    const existingIndex = toolCalls.findIndex(
                      (tc) => tc.index === toolCall.index,
                    );
                    if (existingIndex >= 0) {
                      // Update existing tool call
                      if (toolCall.function?.name) {
                        toolCalls[existingIndex].function.name =
                          toolCall.function.name;
                      }
                      if (toolCall.function?.arguments) {
                        toolCalls[existingIndex].function.arguments =
                          (toolCalls[existingIndex].function.arguments || "") +
                          toolCall.function.arguments;
                      }
                    } else {
                      // Add new tool call
                      toolCalls.push({
                        index: toolCall.index,
                        id: toolCall.id,
                        type: "function",
                        function: {
                          name: toolCall.function?.name || "",
                          arguments: toolCall.function?.arguments || "",
                        },
                      });
                    }
                  }
                }
                if (choice?.finish_reason) {
                  finishReason = choice.finish_reason;
                }
              }
            } catch (streamError) {
              console.error(
                "Error processing streaming response:",
                streamError,
              );
              throw new Error(`Streaming error: ${streamError}`);
            }

            // Flush any remaining brief reasoning text
            if (accumulatedStreamText.trim()) {
              await processor.sendText(accumulatedStreamText);
              didStreamContent = true;
            }

            const streamingDuration = Date.now() - streamingStartTime;
            console.log(
              `Streaming processing completed in ${streamingDuration}ms (${Math.round(
                streamingDuration / 1000,
              )}s)`,
            );
            console.log(`Finish reason: ${finishReason}`);

            // Handle cases where the model doesn't make tool calls
            if (finishReason !== "tool_calls") {
              console.log(
                `Model finished without tool calls (reason: ${finishReason})`,
              );
              // If we were expecting a short confirmation after a post-condition check,
              // treat this as the final answer and stop without nudging.
              if (awaitingPostCheckConfirmation) {
                // Only send the full content if we haven't already streamed it
                if (fullContent && !didStreamContent) {
                  await processor.sendText(fullContent);
                }
                awaitingPostCheckConfirmation = false;
                done = true;
                break;
              }
              if (!nudgedToUseTools) {
                messages.push({
                  role: "user" as const,
                  content:
                    "Continue using the available tools to complete the requested changes. Avoid summaries; call tools directly.",
                });
                nudgedToUseTools = true;
                continue;
              } else {
                // Only send the full content if we haven't already streamed it
                if (fullContent && !didStreamContent) {
                  await processor.sendText(fullContent);
                }
                done = true;
                break;
              }
            }

            // If the model wants to call a function
            if (finishReason === "tool_calls" && toolCalls.length > 0) {
              console.log(`Tool calls detected: ${toolCalls.length} tools`);

              // Create assistant message with tool calls
              const assistantMessage = {
                role: "assistant" as const,
                content: fullContent,
                tool_calls: toolCalls,
              };

              // Add the assistant message with tool calls to the conversation
              messages.push(assistantMessage);

              // Log context size (no trimming)
              trimMessages();

              // Deduplicate createCase within the same iteration: allow only the first
              const dedupedToolCalls: typeof toolCalls = [];
              let seenCreateCase = false;
              for (const tc of toolCalls) {
                const name = tc.function.name;
                if (name === "createCase") {
                  if (seenCreateCase) {
                    // Skip executing duplicate createCase; we'll emit an error tool message below
                    dedupedToolCalls.push({
                      ...tc,
                      function: {
                        ...tc.function,
                        name: "__skip_createCase_duplicate__",
                      },
                    });
                    continue;
                  }
                  seenCreateCase = true;
                }
                dedupedToolCalls.push(tc);
              }

              // Execute all tool calls in parallel for better performance
              let createdCaseId: number | null = null;
              const toolCallPromises = dedupedToolCalls.map(
                async (toolCall) => {
                  const toolName = toolCall.function.name;
                  const toolArgs = JSON.parse(
                    toolCall.function.arguments || "{}",
                  );
                  const toolCallStartTime = Date.now();

                  /*  console.log(`=== Executing tool: ${toolName} ===`);
                console.log(
                  `Tool arguments:`,
                  JSON.stringify(toolArgs, null, 2),
                );
*/
                  // Track tool call history
                  toolCallHistory.push({
                    tool: toolName,
                    timestamp: toolCallStartTime,
                  });

                  try {
                    // No heuristic blocking: rely on tool descriptions for safety and confirmation

                    // If this is a skipped duplicate createCase, emit a synthetic error tool message and return
                    if (toolName === "__skip_createCase_duplicate__") {
                      await processor.sendText(
                        `\nSkipping duplicate createCase call in the same turn.`,
                      );
                      messages.push({
                        role: "tool",
                        content: JSON.stringify({
                          error:
                            "Duplicate createCase call skipped. A case was already created in this turn.",
                        }),
                        tool_call_id: toolCall.id,
                      });
                      return {
                        success: false,
                        error: "duplicate createCase skipped",
                      };
                    }

                    const tool = filteredTools.find((t) => t.name === toolName);
                    if (!tool) throw new Error(`Tool ${toolName} not found`);

                    console.log(`Executing tool ${toolName}...`);
                    // Stream a status update to the client immediately when execution starts
                    await processor.sendText(`\nExecuting ${toolName}...`);
                    const toolExecutionStartTime = Date.now();
                    const result = await tool.execute(toolArgs);
                    const toolExecutionDuration =
                      Date.now() - toolExecutionStartTime;

                    // Update tool call history with duration
                    const lastToolCall =
                      toolCallHistory[toolCallHistory.length - 1];
                    if (lastToolCall) {
                      lastToolCall.duration = toolExecutionDuration;
                    }

                    console.log(
                      `Tool ${toolName} executed successfully in ${toolExecutionDuration}ms (${Math.round(
                        toolExecutionDuration / 1000,
                      )}s)`,
                    );
                    console.log(
                      `Tool result:`,
                      JSON.stringify(result, null, 2),
                    );

                    // Capture newly created case ID to prevent duplicate createCase calls
                    if (
                      toolName === "createCase" &&
                      result &&
                      (result as any).id
                    ) {
                      createdCaseId = Number((result as any).id) || null;
                    }

                    // Don't send raw JSON tool results to the client
                    // Only send user-friendly messages for specific tools
                    const resultObj: ToolResult = result as ToolResult;
                    if (toolName === "saveCase") {
                      await processor.sendText(
                        `\nWorkflow '${
                          resultObj.name || "Unknown"
                        }' saved successfully`,
                      );
                    } else if (toolName === "saveView") {
                      await processor.sendText(
                        `\nSaved '${resultObj.name || "Unknown"}'`,
                      );
                    } else if (toolName === "saveFields") {
                      // Determine created vs updated from tool arguments (presence of id in fields)
                      const fieldsParam: Array<{
                        id?: number;
                        name?: string;
                        label?: string;
                      }> = Array.isArray(toolArgs?.fields)
                        ? toolArgs.fields
                        : [];

                      const createdParam = fieldsParam.filter(
                        (f) =>
                          !("id" in f) || f.id === undefined || f.id === null,
                      );
                      const updatedParam = fieldsParam.filter(
                        (f) => typeof f.id === "number",
                      );

                      const createdCount = createdParam.length;
                      const updatedCount = updatedParam.length;

                      const resultFieldNames =
                        (
                          resultObj.fields as {
                            name?: string;
                            label?: string;
                          }[]
                        )?.map((f) => f.name || f.label || "Unknown field") ||
                        [];

                      const parts: string[] = [];
                      if (updatedCount > 0) {
                        const suffix = updatedCount === 1 ? "" : "s";
                        const names = updatedParam.map(
                          (f) => f.name || f.label || "Unknown field",
                        );
                        parts.push(
                          `Updated ${updatedCount} field${suffix}: ${names.join(
                            ", ",
                          )}`,
                        );
                      }
                      if (createdCount > 0) {
                        const suffix = createdCount === 1 ? "" : "s";
                        const names = createdParam.map(
                          (f) => f.name || f.label || "Unknown field",
                        );
                        // If names are empty (unlikely), fall back to result names
                        parts.push(
                          names.length > 0
                            ? `Created ${createdCount} field${suffix}: ${names.join(
                                ", ",
                              )}`
                            : `Created ${createdCount} field${suffix}: ${resultFieldNames.join(
                                ", ",
                              )}`,
                        );
                      }
                      if (parts.length === 0) {
                        const total =
                          resultObj.fields?.length ||
                          resultObj.ids?.length ||
                          0;
                        const suffix = total === 1 ? "" : "s";
                        await processor.sendText(
                          `\nSaved ${total} field${suffix}`,
                        );
                      } else {
                        await processor.sendText(`\n${parts.join("; ")}`);
                      }
                    } else if (toolName === "deleteField") {
                      const deletedName =
                        (resultObj as any).deletedName || "Unknown field";
                      const updatedViewsCount =
                        (resultObj as any).updatedViewsCount || 0;
                      if (updatedViewsCount > 0) {
                        await processor.sendText(
                          `\nDeleted field: ${deletedName} (removed from ${updatedViewsCount} view${
                            updatedViewsCount === 1 ? "" : "s"
                          })`,
                        );
                      } else {
                        await processor.sendText(
                          `\nDeleted field: ${deletedName}`,
                        );
                      }
                    } else if (toolName === "deleteView") {
                      const deletedName =
                        (resultObj as any).deletedName || "Unknown view";
                      await processor.sendText(
                        `\nDeleted view: ${deletedName}`,
                      );
                    } else if (toolName === "deleteCase") {
                      await processor.sendText(`\nDeleted case successfully`);
                    } else if (
                      toolName.startsWith("get") ||
                      toolName.startsWith("list")
                    ) {
                      // Don't send any message for get/list tools - they're read-only operations
                    } else {
                      // For other tools, send a generic success message with separation
                      await processor.sendText(
                        `\nOperation completed successfully`,
                      );
                    }

                    // Add tool result to messages
                    messages.push({
                      role: "tool",
                      content: JSON.stringify(result),
                      tool_call_id: toolCall.id,
                    });

                    // Log context size (no trimming)
                    trimMessages();

                    return { success: true, result };
                  } catch (err) {
                    const toolExecutionDuration =
                      Date.now() - toolCallStartTime;
                    console.error(
                      `Tool ${toolName} failed after ${toolExecutionDuration}ms:`,
                      err,
                    );

                    // Update tool call history with duration
                    const lastToolCall =
                      toolCallHistory[toolCallHistory.length - 1];
                    if (lastToolCall) {
                      lastToolCall.duration = toolExecutionDuration;
                    }

                    await processor.sendText(
                      `\nError executing ${toolName}: ${err}\n`,
                    );

                    // Add tool result to messages
                    messages.push({
                      role: "tool",
                      content: JSON.stringify({ error: String(err) }),
                      tool_call_id: toolCall.id,
                    });

                    // Log context size (no trimming)
                    trimMessages();

                    return { success: false, error: err };
                  }
                },
              );

              // Wait for all tool calls to complete
              await Promise.all(toolCallPromises);

              // If a new case was created in this iteration, update context to EXISTING and disable createCase for subsequent iterations
              if (createdCaseId && Number.isInteger(createdCaseId)) {
                currentCaseId = createdCaseId;
                // Update filtered tools so createCase cannot be executed again in this session
                filteredTools = filteredTools.filter(
                  (t) => t.name !== "createCase",
                );

                // Inform the model about the updated context and restriction
                const updatedContextLine = `Context update: caseId=${currentCaseId}; mode=EXISTING. Do NOT call createCase again; continue with saveFields, saveView, and saveCase using this caseId.`;
                messages.push({ role: "system", content: updatedContextLine });
              }

              // Generic post-condition verification loop:
              // After any mutating tool call (saveCase/saveView/saveFields/delete*), ask the model to self-verify against the user goal.
              // We provide only the latest tool results + last user prompt, and instruct the model to either:
              // - call additional tools to satisfy unmet constraints, or
              // - return a terse confirmation that constraints are satisfied.
              // This keeps it generic for any request without hardcoding rules.
              const mutatingTools = [
                "saveCase",
                "saveView",
                "saveFields",
                "deleteField",
                "deleteView",
                "deleteCase",
              ];
              const anyMutations = toolCalls.some((tc) =>
                mutatingTools.includes(tc.function.name || ""),
              );

              if (anyMutations) {
                // Summarize last tool results for context
                const lastToolResults = messages
                  .filter((m) => m.role === "tool")
                  .slice(-Math.max(1, toolCalls.length))
                  .map((m) => (typeof m.content === "string" ? m.content : ""))
                  .join("\n");

                messages.push({
                  role: "system",
                  content:
                    "Post-condition check: Verify the user's goal is truly satisfied based on the latest state. If anything is missing or inconsistent, call the appropriate tools to fix it. If everything is correct, reply concisely with 'All constraints satisfied.' Avoid summaries.",
                });
                messages.push({ role: "user", content: enhancedPrompt });
                messages.push({
                  role: "user",
                  content: `Latest tool results JSON: ${lastToolResults}`,
                });
                // We're now expecting a short confirmation, so avoid nudging on the next turn
                awaitingPostCheckConfirmation = true;
                // Loop continues; next iteration will either call more tools or end with a short confirmation
              }

              const loopDuration = Date.now() - loopStartTime;
              console.log(
                `=== Loop iteration ${loopCount} completed in ${loopDuration}ms (${Math.round(
                  loopDuration / 1000,
                )}s) ===`,
              );

              // Continue loop for next tool call or final message
              continue;
            }

            // If the model returns a final message (no tool call), send it now
            if (fullContent && !didStreamContent) {
              console.log(
                "Final message received:",
                fullContent.substring(0, 200) + "...",
              );
              await processor.sendText(fullContent);
            }

            const loopDuration = Date.now() - loopStartTime;
            console.log(
              `=== Final loop iteration completed in ${loopDuration}ms ===`,
            );
            done = true;
          } catch (error) {
            const totalDuration = Date.now() - startTime;
            console.error(
              `Error in function call loop after ${totalDuration}ms:`,
              error,
            );
            try {
              await processor.sendError(
                error instanceof Error ? error.message : String(error),
              );
              await processor.sendDone();
            } catch (sendError) {
              console.error("Error sending error message:", sendError);
            }
            // Don't close writer here - let the outer catch handle it
            break; // Exit the loop
          }
        }

        const totalDuration = Date.now() - startTime;
        console.log(
          `=== LLM function call loop completed in ${totalDuration}ms ===`,
        );
        console.log(`Tool call history:`, toolCallHistory);

        // Finalization is handled by the model output and tool results; no heuristic completion checks

        // Commit checkpoint session on successful completion
        try {
          await checkpointSessionManager.commitSession();
          console.log("Checkpoint session committed successfully");
        } catch (checkpointError) {
          console.error(
            "Failed to commit checkpoint session:",
            checkpointError,
          );
        }

        await processor.sendDone();
        await writer.close();
      } catch (error) {
        // Rollback checkpoint session on error
        try {
          await checkpointSessionManager.rollbackSession();
          console.log("Checkpoint session rolled back due to error");
        } catch (checkpointError) {
          console.error(
            "Failed to rollback checkpoint session:",
            checkpointError,
          );
        }
        const totalDuration = Date.now() - startTime;
        console.error(
          `=== OpenAI POST request failed after ${totalDuration}ms ===`,
        );
        console.error("API route error:", error);
        console.error(
          "Error stack:",
          error instanceof Error ? error.stack : "No stack trace",
        );
        return NextResponse.json(
          {
            error:
              error instanceof Error ? error.message : "Internal server error",
          },
          { status: 500 },
        );
      }
    })();

    console.log("=== OpenAI POST request completed successfully ===");
    return response;
  } catch (error) {
    const totalDuration = Date.now() - startTime;
    console.error(
      `=== OpenAI POST request failed after ${totalDuration}ms ===`,
    );
    console.error("API route error:", error);
    console.error(
      "Error stack:",
      error instanceof Error ? error.stack : "No stack trace",
    );
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
