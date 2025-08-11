import { NextResponse } from "next/server";
import OpenAI from "openai";
import { databaseSystemPrompt } from "../../lib/databasePrompt";
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
    let isExistingWorkflow = false;
    let extractedCaseName: string | null = null;
    let extractedCaseDescription: string | null = null;

    if (systemContext) {
      try {
        const contextData = JSON.parse(systemContext);
        console.log("Parsed system context:", contextData);
        if (contextData.currentCaseId) {
          currentCaseId = contextData.currentCaseId;
          isExistingWorkflow = true;
          console.log(
            "Detected existing workflow with case ID:",
            currentCaseId,
          );
        }
      } catch (_parseError) {
        console.log(
          "System context is not JSON, treating as regular system prompt",
        );
      }
    }

    // Extract case name and description from the prompt for new workflows
    if (!isExistingWorkflow) {
      // Try to extract case name and description from the prompt
      const nameMatch =
        prompt.match(/name\s*["']([^"']+)["']/i) ||
        prompt.match(/workflow\s*["']([^"']+)["']/i) ||
        prompt.match(/create.*?["']([^"']+)\s*workflow["']/i);

      const descMatch =
        prompt.match(/description\s*["']([^"']+)["']/i) ||
        prompt.match(/for\s+([^.]+)/i);

      if (nameMatch) {
        extractedCaseName = nameMatch[1];
        console.log("Extracted case name from prompt:", extractedCaseName);
      }

      if (descMatch) {
        extractedCaseDescription = descMatch[1];
        console.log(
          "Extracted case description from prompt:",
          extractedCaseDescription,
        );
      }

      // If we couldn't extract, use defaults based on the prompt content
      if (!extractedCaseName) {
        if (prompt.toLowerCase().includes("tire")) {
          extractedCaseName = "Tire Replacement Workflow";
        } else if (prompt.toLowerCase().includes("kitchen")) {
          extractedCaseName = "Kitchen Renovation Workflow";
        } else if (prompt.toLowerCase().includes("loan")) {
          extractedCaseName = "Loan Application Workflow";
        } else {
          extractedCaseName = "Workflow";
        }
        console.log("Using default case name:", extractedCaseName);
      }

      if (!extractedCaseDescription) {
        extractedCaseDescription = "A workflow for managing the process";
        console.log(
          "Using default case description:",
          extractedCaseDescription,
        );
      }
    }

    // Enhance the user prompt with explicit instructions
    let enhancedPrompt = prompt;

    if (isExistingWorkflow && currentCaseId) {
      enhancedPrompt = `${prompt}

Working with existing case ID: ${currentCaseId}. For simple operations like deleting fields, use the specific tools (deleteField, saveFields, saveView) and STOP - do not call saveCase unless making structural changes to the workflow.`;
    } else {
      // For new workflow creation
      enhancedPrompt = `${prompt}

Create case, fields, views, then call saveCase with complete workflow model.`;
    }

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
    let workflowContextInstruction = "";
    if (currentCaseId) {
      filteredTools = databaseTools.filter((t) => t.name !== "createCase");
      workflowContextInstruction = `\nYou are working on workflow case ID: ${currentCaseId}.\nUse this ID for all tool calls.\nFor field-only changes (defaultValue, primary, required), use saveFields only and then stop.\nDo not mention that you are avoiding saveView/saveCase; simply perform the correct action.`;
    }

    // Rely on tool descriptions and system guidance (no heuristic gating)

    // Create OpenAI client with fresh token
    console.log("Creating OpenAI client...");
    const openai = await createOpenAIClient();

    // Build enhanced system prompt
    const enhancedSystemPrompt = `${databaseSystemPrompt}

${getToolsContext(filteredTools)}${workflowContextInstruction}

Current case ID: ${currentCaseId || "NEW"}

CRITICAL WORKFLOW COMPLETION RULES:
1. For NEW workflows: Create case → Create fields → Create views → Call saveCase with complete model
2. For EXISTING workflows: Use specific tools for simple operations (deleteField, saveFields, saveView) - DO NOT call saveCase unless making structural changes
3. saveCase should ONLY be called for:
   - Creating new workflows from scratch
   - Making structural changes (adding/removing stages, processes, or steps)
   - Finalizing new workflow creation
4. For simple operations on existing workflows (delete field, add field, update view), use the specific tools and STOP - do not call saveCase
5. After creating fields, you MUST create MULTIPLE views before calling saveCase (for new workflows only)
6. Each workflow step needs its own view - create separate views for different data collection steps
7. The saveCase call must include stages, processes, and steps with UNIQUE viewId references
8. Create COMPREHENSIVE workflows with multiple fields and views - don't create minimal workflows
9. Think about all the data that needs to be collected and managed in the workflow
10. DO NOT reuse the same viewId for multiple steps - each step needs its own view
11. IMPORTANT: Use the exact viewIds and fieldIds returned from previous tool calls - do not make up IDs

VALID FIELD TYPES: Address, AutoComplete, Checkbox, Currency, Date, DateTime, Decimal, Dropdown, Email, Integer, Location, ReferenceValues, DataReferenceSingle, DataReferenceMulti, CaseReferenceSingle, CaseReferenceMulti, Percentage, Phone, RadioButtons, RichText, Status, Text, TextArea, Time, URL, UserReference
- Use "Integer" for whole numbers, "Decimal" for numbers with decimals
- Use "Text" for single line text, "TextArea" for multi-line text`;

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
        let toolCallHistory: Array<{
          tool: string;
          timestamp: number;
          duration?: number;
        }> = [];

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

        while (!done && loopCount < 15) {
          // Force completion if we're at max iterations
          if (loopCount >= 15) {
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

              // For existing workflows, proactively nudge the model to execute appropriate tools
              if (currentCaseId) {
                messages.push({
                  role: "user" as const,
                  content:
                    "Proceed to apply the requested changes using the appropriate tools now.\n- For field-only changes (label, description, order, options, required, primary, defaultValue, type): use saveFields for the selected fields.\n- For view composition/layout changes: use saveView.\n- Only use saveCase for structural workflow model updates.\nDo not summarize; call the tool(s) directly.",
                });
                // Continue to next iteration to allow tool execution
                continue;
              }

              // For new workflows, encourage tool usage to complete creation
              let proceedMessage;
              if (loopCount === 1) {
                proceedMessage = {
                  role: "user" as const,
                  content: `Proceed using tools: create case, fields, views, then call saveCase to complete.`,
                };
              } else if (finishReason === "length") {
                proceedMessage = {
                  role: "user" as const,
                  content: `Continue: create stages, processes, steps; then call saveCase to complete.`,
                };
              } else {
                proceedMessage = {
                  role: "user" as const,
                  content: `Continue with tools: create stages/processes/steps, then call saveCase.`,
                };
              }

              messages.push(proceedMessage);
              continue; // Continue to next iteration
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

              // Execute all tool calls in parallel for better performance
              const toolCallPromises = toolCalls.map(async (toolCall) => {
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
                // Check for duplicate field creation and encourage view creation
                if (toolName === "saveFields" && toolArgs.name) {
                  const existingFieldCalls = toolCallHistory.filter(
                    (tc) => tc.tool === "saveFields",
                  );
                  const existingViewCalls = toolCallHistory.filter(
                    (tc) => tc.tool === "saveView",
                  );

                  if (existingFieldCalls.length > 0) {
                    console.log(
                      `WARNING: Field creation detected - ensure this is not a duplicate: ${toolArgs.name}`,
                    );
                  }

                  // If we have many fields but few views, encourage view creation
                  if (
                    existingFieldCalls.length >= 5 &&
                    existingViewCalls.length < 2
                  ) {
                    console.log(
                      `WARNING: Many fields created (${existingFieldCalls.length}) but few views (${existingViewCalls.length}). Consider creating views now.`,
                    );
                  }
                }

                // Track tool call history
                toolCallHistory.push({
                  tool: toolName,
                  timestamp: toolCallStartTime,
                });

                try {
                  const tool = filteredTools.find((t) => t.name === toolName);
                  if (!tool) throw new Error(`Tool ${toolName} not found`);

                  console.log(`Executing tool ${toolName}...`);
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
                  console.log(`Tool result:`, JSON.stringify(result, null, 2));

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
                    }> = Array.isArray(toolArgs?.fields) ? toolArgs.fields : [];

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
                        resultObj.fields as { name?: string; label?: string }[]
                      )?.map((f) => f.name || f.label || "Unknown field") || [];

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
                        resultObj.fields?.length || resultObj.ids?.length || 0;
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
                    await processor.sendText(`\nDeleted view: ${deletedName}`);
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
                  const toolExecutionDuration = Date.now() - toolCallStartTime;
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
              });

              // Wait for all tool calls to complete
              await Promise.all(toolCallPromises);

              const loopDuration = Date.now() - loopStartTime;
              console.log(
                `=== Loop iteration ${loopCount} completed in ${loopDuration}ms (${Math.round(
                  loopDuration / 1000,
                )}s) ===`,
              );

              // Check if saveCase was called in this iteration
              const saveCaseCalled = toolCalls.some(
                (tc) => tc.function.name === "saveCase",
              );

              // If we're at max iterations or saveCase was called, we can complete
              if (loopCount >= 15 || saveCaseCalled) {
                console.log(
                  `Loop completion: ${
                    saveCaseCalled
                      ? "saveCase called"
                      : "max iterations reached"
                  }`,
                );
                done = true;
                break;
              }

              // Only force saveCase if this is a new workflow creation, not for simple operations
              const isNewWorkflowCreation = !currentCaseId;
              const hasDeleteOperations = toolCallHistory.some((tc) =>
                tc.tool.startsWith("delete"),
              );

              console.log("=== Loop completion check ===");
              console.log("saveCaseCalled:", saveCaseCalled);
              console.log("isNewWorkflowCreation:", isNewWorkflowCreation);
              console.log("currentCaseId:", currentCaseId);
              console.log("hasDeleteOperations:", hasDeleteOperations);
              console.log(
                "toolCallHistory:",
                toolCallHistory.map((tc) => tc.tool),
              );

              // If saveCase wasn't called and we haven't reached max iterations,
              // and this is a new workflow creation (not a simple operation like field deletion)
              if (
                !saveCaseCalled &&
                isNewWorkflowCreation &&
                !hasDeleteOperations
              ) {
                console.log(
                  "saveCase not called - adding completion reminder for new workflow",
                );

                // Check what has been created so far
                const hasFields = toolCallHistory.some(
                  (tc) => tc.tool === "saveFields",
                );
                const hasViews = toolCallHistory.some(
                  (tc) => tc.tool === "saveView",
                );

                // Count what's been created
                // For saveFields, we need to count the actual number of fields created, not the number of calls
                // Each saveFields call can create multiple fields
                const saveFieldsCalls = toolCallHistory.filter(
                  (tc) => tc.tool === "saveFields",
                );

                // Get the actual field count from the tool results in messages
                let fieldCount = 0;
                for (const message of messages) {
                  if (
                    message.role === "tool" &&
                    typeof message.content === "string"
                  ) {
                    try {
                      const result = JSON.parse(message.content);
                      // Check if this is a saveFields result
                      if (result.fields && Array.isArray(result.fields)) {
                        fieldCount += result.fields.length;
                      } else if (result.ids && Array.isArray(result.ids)) {
                        fieldCount += result.ids.length;
                      }
                    } catch (_parseError) {
                      // Ignore parsing errors for non-JSON messages
                    }
                  }
                }

                // If we couldn't parse any results, fall back to counting calls
                if (fieldCount === 0) {
                  fieldCount = saveFieldsCalls.length;
                }

                const viewCount = toolCallHistory.filter(
                  (tc) => tc.tool === "saveView",
                ).length;

                console.log(
                  `Progress: ${fieldCount} fields, ${viewCount} views created`,
                );

                let completionMessage;

                // If we're getting close to max iterations, be more aggressive
                if (loopCount >= 12) {
                  completionMessage = {
                    role: "user" as const,
                    content: `URGENT: ${fieldCount} fields, ${viewCount} views. Call saveCase NOW with workflow model.`,
                  };
                } else if (hasFields && !hasViews) {
                  // Check if we have enough fields for a comprehensive workflow
                  if (fieldCount < 3) {
                    completionMessage = {
                      role: "user" as const,
                      content: `Progress: ${fieldCount} fields, ${viewCount} views. Create more fields then views.`,
                    };
                  } else if (fieldCount >= 8) {
                    // Force view creation if we have too many fields
                    completionMessage = {
                      role: "user" as const,
                      content: `STOP: ${fieldCount} fields created. Create views now for each workflow step.`,
                    };
                  } else {
                    completionMessage = {
                      role: "user" as const,
                      content: `Progress: ${fieldCount} fields, ${viewCount} views. Create views for each workflow step.`,
                    };
                  }
                } else if (hasViews) {
                  // Check if we have enough views for a proper workflow
                  if (viewCount < 3) {
                    completionMessage = {
                      role: "user" as const,
                      content: `Progress: ${fieldCount} fields, ${viewCount} views. Create more views then call saveCase.`,
                    };
                  } else {
                    completionMessage = {
                      role: "user" as const,
                      content: `Progress: ${fieldCount} fields, ${viewCount} views. Call saveCase with workflow model now.`,
                    };
                  }
                } else {
                  completionMessage = {
                    role: "user" as const,
                    content: `Progress: ${fieldCount} fields, ${viewCount} views. Create workflow and call saveCase.`,
                  };
                }
                messages.push(completionMessage);
              } else if (!saveCaseCalled && !isNewWorkflowCreation) {
                // For existing workflows, prefer completing the user's multi-step intent in one request:
                // 1) If only read-only tools ran, continue to allow modifications.
                // 2) If fields were just created but views weren't updated yet, instruct to update selected view(s) via saveView.
                // 3) Otherwise, if a state-changing operation completed and there's nothing else implied, stop to avoid duplicates.

                const toolNamesThisIteration = toolCalls.map(
                  (tc) => tc.function.name || "",
                );
                const onlyReadOnlyToolsThisIteration =
                  toolNamesThisIteration.every(
                    (name) => name.startsWith("get") || name.startsWith("list"),
                  );
                const didSaveFieldsThisIteration =
                  toolNamesThisIteration.includes("saveFields");
                const hasSaveViewInHistory = toolCallHistory.some(
                  (tc) => tc.tool === "saveView",
                );

                if (onlyReadOnlyToolsThisIteration) {
                  console.log(
                    "Existing workflow - read-only tools executed; continuing to allow modifications",
                  );
                  messages.push({
                    role: "user" as const,
                    content:
                      "Proceed to apply the requested changes using saveFields and/or saveView for the selected view. Avoid duplicates and validate with list tools if needed.",
                  });
                } else if (
                  didSaveFieldsThisIteration &&
                  !hasSaveViewInHistory
                ) {
                  // Extract newly created field IDs from the most recent tool result(s)
                  const newFieldIds: number[] = [];
                  for (let i = messages.length - 1; i >= 0; i--) {
                    const m = messages[i];
                    if (m.role === "tool" && typeof m.content === "string") {
                      try {
                        const obj = JSON.parse(m.content);
                        if (Array.isArray(obj?.ids) && obj.ids.length > 0) {
                          for (const id of obj.ids) {
                            if (typeof id === "number") newFieldIds.push(id);
                          }
                          break;
                        }
                      } catch {
                        // ignore
                      }
                    }
                  }

                  // Extract selected viewIds, stageIds, and processIds from the initial user message if present
                  let selectedViewIds: number[] = [];
                  let selectedStageIds: number[] = [];
                  let selectedProcessIds: number[] = [];
                  const initialUserMsg = messages.find(
                    (m) => m.role === "user",
                  );
                  if (
                    initialUserMsg &&
                    typeof initialUserMsg.content === "string"
                  ) {
                    const match = initialUserMsg.content.match(
                      /Selected viewIds=\s*\[(.*?)\]/,
                    );
                    if (match && match[1]) {
                      const parts = match[1]
                        .split(",")
                        .map((s) => Number(s.trim()))
                        .filter((n) => Number.isFinite(n));
                      if (parts.length > 0) selectedViewIds = parts as number[];
                    }
                    const stageMatch = initialUserMsg.content.match(
                      /Selected stageIds=\s*\[(.*?)\]/,
                    );
                    if (stageMatch && stageMatch[1]) {
                      const parts = stageMatch[1]
                        .split(",")
                        .map((s) => Number(s.trim()))
                        .filter((n) => Number.isFinite(n));
                      if (parts.length > 0)
                        selectedStageIds = parts as number[];
                    }
                    const processMatch = initialUserMsg.content.match(
                      /Selected processIds=\s*\[(.*?)\]/,
                    );
                    if (processMatch && processMatch[1]) {
                      const parts = processMatch[1]
                        .split(",")
                        .map((s) => Number(s.trim()))
                        .filter((n) => Number.isFinite(n));
                      if (parts.length > 0)
                        selectedProcessIds = parts as number[];
                    }
                  }

                  // If no explicit selection context was provided, STOP to avoid unintended view updates
                  if (
                    selectedViewIds.length === 0 &&
                    selectedStageIds.length === 0 &&
                    selectedProcessIds.length === 0
                  ) {
                    console.log(
                      "Existing workflow - fields updated with no selections; stopping to avoid unintended view changes",
                    );
                    done = true;
                    break;
                  }

                  console.log(
                    "Existing workflow - fields added; prompting to update selected context with new fields",
                    {
                      selectedViewIds,
                      selectedStageIds,
                      selectedProcessIds,
                      newFieldIds,
                    },
                  );

                  let targetText = "the relevant selected context";
                  const parts: string[] = [];
                  if (selectedViewIds.length > 0) {
                    parts.push(`view id(s): ${selectedViewIds.join(", ")}`);
                  }
                  if (selectedStageIds.length > 0) {
                    parts.push(`stage id(s): ${selectedStageIds.join(", ")}`);
                  }
                  if (selectedProcessIds.length > 0) {
                    parts.push(
                      `process id(s): ${selectedProcessIds.join(", ")}`,
                    );
                  }
                  if (parts.length > 0) {
                    targetText = `the selected ${parts.join("; ")}`;
                  }

                  const fieldListText =
                    newFieldIds.length > 0
                      ? ` The newly created fieldIds are: ${newFieldIds.join(
                          ", ",
                        )}.`
                      : "";

                  messages.push({
                    role: "user" as const,
                    content: `Now update ${targetText} with the new fields and take appropriate actions:\n- For views: append to model.fields as { fieldId } and call saveView with the same name and caseid, preserving existing fields and layout.\n- For stages/processes: if this implies structural changes, use saveCase to update the workflow model with correct stages, processes, and steps. Avoid duplicates and keep order sensible.${fieldListText}`,
                  });
                } else {
                  console.log(
                    "Existing workflow - simple operation completed; stopping loop to avoid duplicates",
                  );
                  done = true;
                  break;
                }
              }

              // Continue loop for next tool call or final message
              continue;
            }

            // If the model returns a final message (no tool call), send it now
            if (fullContent) {
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

        // Check if saveCase was called during the entire process
        const saveCaseWasCalled = toolCallHistory.some(
          (tc) => tc.tool === "saveCase",
        );
        const isNewWorkflowCreation = !currentCaseId;

        console.log("=== Final completion check ===");
        console.log("saveCaseWasCalled:", saveCaseWasCalled);
        console.log("isNewWorkflowCreation:", isNewWorkflowCreation);
        console.log("currentCaseId:", currentCaseId);
        console.log(
          "toolCallHistory:",
          toolCallHistory.map((tc) => tc.tool),
        );

        if (!saveCaseWasCalled && isNewWorkflowCreation) {
          console.warn(
            "WARNING: saveCase was never called - workflow is incomplete!",
          );
          await processor.sendText(
            "\n🚨 WARNING: Workflow creation incomplete! saveCase was never called.\n",
          );
          await processor.sendText(
            "The workflow model with stages, processes, and steps was not created.\n",
          );
        } else if (saveCaseWasCalled) {
          console.log(
            "SUCCESS: saveCase was called - workflow creation completed!",
          );
          await processor.sendText(
            "\n✅ Workflow creation completed successfully!\n",
          );
        } else if (!saveCaseWasCalled && !isNewWorkflowCreation) {
          // For existing workflows, simple operations don't need saveCase
          console.log("Operation completed successfully on existing workflow");
          await processor.sendText("\n✅ Operation completed successfully!\n");
        }

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
