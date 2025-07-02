import { NextResponse } from "next/server";
import OpenAI from "openai";
import { databaseSystemPrompt } from "../../lib/databasePrompt";
import { pool } from "../../lib/db";
import { getDatabaseTools } from "../../lib/llmTools";
import {
  createStreamProcessor,
  createStreamResponse,
  getToolsContext,
  Tool,
} from "../../lib/llmUtils";
import { openaiToolSchemas } from "../../lib/openaiToolSchemas";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

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

You are working with an existing case (ID: ${currentCaseId}). Use the available tools to check the current state and make the requested modifications.`;
    } else {
      // For new workflow creation
      enhancedPrompt = `${prompt}

Extract the case name and description from the user's request and proceed with workflow creation using the available tools.`;
    }

    // Get database tools
    console.log("Getting database tools...");
    let databaseTools = getDatabaseTools(pool) as Tool[];
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
      workflowContextInstruction = `\nYou are working on workflow case ID: ${currentCaseId}.\nUse this ID for all tool calls (saveCase, saveField, saveView, etc).\nDo not create a new case.`;
    }

    // Create OpenAI client with fresh token
    console.log("Creating OpenAI client...");
    const openai = await createOpenAIClient();

    // Build enhanced system prompt
    const enhancedSystemPrompt = `${databaseSystemPrompt}

${getToolsContext(filteredTools)}${workflowContextInstruction}

Current case ID: ${currentCaseId || "NEW"}`;

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

        console.log("=== Starting LLM function call loop ===");
        console.log(
          "Initial prompt:",
          enhancedPrompt.substring(0, 200) + "...",
        );

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

            // Add timeout to prevent long delays
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(
                () => reject(new Error("OpenAI API timeout after 15 seconds")),
                15000,
              );
            });

            const completionPromise = openai.chat.completions.create({
              model: "gpt-35-turbo-16k",
              messages,
              max_tokens: 2048, // Reduced from 4096
              stream: true, // Enable streaming for faster responses
              tools: openaiToolSchemas,
              temperature: 0.1,
              top_p: 0.9, // Add top_p for better performance
              presence_penalty: 0.1, // Reduce repetition
              frequency_penalty: 0.1, // Reduce repetition
            });

            const completion = (await Promise.race([
              completionPromise,
              timeoutPromise,
            ])) as OpenAICompletion;
            const apiCallDuration = Date.now() - apiCallStartTime;
            console.log(`OpenAI API call completed in ${apiCallDuration}ms`);

            // Handle streaming response
            let fullContent = "";
            let toolCalls: ToolCall[] = [];
            let finishReason = "";

            try {
              for await (const chunk of completion) {
                const choice = chunk.choices[0];
                if (choice?.delta?.content) {
                  fullContent += choice.delta.content;
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

            console.log(`Finish reason: ${finishReason}`);

            // Check if first iteration without tool calls and add instruction to proceed
            if (loopCount === 1 && finishReason !== "tool_calls") {
              console.log(
                "First iteration without tool calls - adding instruction to proceed with tools",
              );
              const proceedMessage = {
                role: "user" as const,
                content: `Please proceed with the workflow creation using the available tools. The tools contain all the information you need to complete this task.`,
              };
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

              // Execute all tool calls in parallel for better performance
              const toolCallPromises = toolCalls.map(async (toolCall) => {
                const toolName = toolCall.function.name;
                const toolArgs = JSON.parse(
                  toolCall.function.arguments || "{}",
                );
                const toolCallStartTime = Date.now();

                console.log(`=== Executing tool: ${toolName} ===`);
                console.log(
                  `Tool arguments:`,
                  JSON.stringify(toolArgs, null, 2),
                );

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
                    `Tool ${toolName} executed successfully in ${toolExecutionDuration}ms`,
                  );
                  console.log(`Tool result:`, JSON.stringify(result, null, 2));

                  await processor.sendText(
                    `\nSuccessfully executed ${toolName}.\n`,
                  );
                  await processor.sendText(JSON.stringify(result));

                  // Add tool result to messages
                  messages.push({
                    role: "tool",
                    content: JSON.stringify(result),
                    tool_call_id: toolCall.id,
                  });

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

                  return { success: false, error: err };
                }
              });

              // Wait for all tool calls to complete
              await Promise.all(toolCallPromises);

              const loopDuration = Date.now() - loopStartTime;
              console.log(
                `=== Loop iteration ${loopCount} completed in ${loopDuration}ms ===`,
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

              // If saveCase wasn't called and we haven't reached max iterations,
              // add a message to force the LLM to continue with workflow completion
              if (!saveCaseCalled) {
                console.log("saveCase not called - adding completion reminder");

                const completionMessage = {
                  role: "user" as const,
                  content: `🚨 WORKFLOW INCOMPLETE!
🚨 You need to complete the workflow by calling saveCase with the workflow model.
🚨 Create views for data collection steps, then call saveCase with stages, processes, and steps.
🚨 Do not stop here - complete the workflow!`,
                };
                messages.push(completionMessage);
              }

              // Continue loop for next tool call or final message
              continue;
            }

            // If the model returns a final message (no tool call)
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

        if (!saveCaseWasCalled) {
          console.warn(
            "WARNING: saveCase was never called - workflow is incomplete!",
          );
          await processor.sendText(
            "\n🚨 WARNING: Workflow creation incomplete! saveCase was never called.\n",
          );
          await processor.sendText(
            "The workflow model with stages, processes, and steps was not created.\n",
          );
        } else {
          console.log(
            "SUCCESS: saveCase was called - workflow creation completed!",
          );
          await processor.sendText(
            "\n✅ Workflow creation completed successfully!\n",
          );
        }

        await processor.sendDone();
        await writer.close();
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
