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
      enhancedPrompt = `🚨 CRITICAL: YOU MUST ALWAYS USE HELPER TOOLS FIRST BEFORE ANY CREATION OPERATIONS!
🚨 NEVER CREATE ANYTHING WITHOUT CHECKING WHAT EXISTS FIRST!
🚨 ALWAYS USE getCase, listFields, AND listViews BEFORE CREATING ANYTHING!

${prompt}

🚨 MANDATORY: You are working with EXISTING Case ID: ${currentCaseId}
🚨 MANDATORY: Use getCase FIRST to see the current workflow structure
🚨 MANDATORY: Use listFields and listViews to see existing items
🚨 MANDATORY: Proceed with the requested modifications using the existing case ID
🚨 CRITICAL: Do NOT ask for case name/description - you already have an existing case!`;
    } else {
      // For new workflow creation
      enhancedPrompt = `🚨 CRITICAL: YOU MUST ALWAYS USE HELPER TOOLS FIRST BEFORE ANY CREATION OPERATIONS!
🚨 NEVER CREATE ANYTHING WITHOUT CHECKING WHAT EXISTS FIRST!
🚨 ALWAYS USE getCase, listFields, AND listViews BEFORE CREATING ANYTHING!

${prompt}

🚨 MANDATORY: Extract case name and description from the user's request
🚨 MANDATORY: Case Name: "${extractedCaseName}"
🚨 MANDATORY: Case Description: "${extractedCaseDescription}"
🚨 MANDATORY: Proceed directly with workflow creation using these details
🚨 CRITICAL: Do NOT ask for case name/description - extract it from the prompt
🚨 CRITICAL: Follow the exact sequence: getCase → saveField → saveView → saveCase
🚨 CRITICAL: Do NOT stop to ask questions - proceed with the workflow creation!`;
    }

    // Get database tools
    console.log("Getting database tools...");
    const databaseTools = getDatabaseTools(pool) as Tool[];
    console.log("Database tools count:", databaseTools.length);
    console.log(
      "Available tools:",
      databaseTools.map((t) => t.name),
    );

    // Create OpenAI client with fresh token
    console.log("Creating OpenAI client...");
    const openai = await createOpenAIClient();

    // Build enhanced system prompt
    const enhancedSystemPrompt = `${databaseSystemPrompt}

${getToolsContext(databaseTools)}

CRITICAL INSTRUCTIONS:
1. ALWAYS use helper tools FIRST (getCase, listFields, listViews) before any creation operations
2. NEVER create anything without checking what exists first
3. Use saveField, saveView, and saveCase in sequence
4. Create logical field groupings and distribute them across multiple views
5. Complete the entire workflow in minimal iterations
6. Do NOT ask questions - proceed with the workflow creation immediately

Current case ID: ${currentCaseId || "NEW"}`;

    console.log("Building enhanced system prompt...");
    console.log("Enhanced system prompt length:", enhancedSystemPrompt.length);

    // Create streaming response
    console.log("Creating streaming response...");
    const { writer, encoder, response } = createStreamResponse();
    const processor = createStreamProcessor(writer, encoder, databaseTools);

    (async () => {
      try {
        // Function call loop
        let messages: ChatCompletionMessageParam[] = [
          { role: "system", content: enhancedSystemPrompt },
          { role: "user", content: enhancedPrompt },
        ];
        let loopCount = 0;
        let done = false;
        let consecutiveErrors = 0;
        let lastErrorTool = "";
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

        while (!done && loopCount < 10) {
          // prevent infinite loops
          loopCount++;
          const loopStartTime = Date.now();
          console.log(
            `=== Function call loop iteration ${loopCount} (${
              Date.now() - startTime
            }ms elapsed) ===`,
          );

          // Add early termination for excessive iterations
          if (loopCount > 8) {
            console.log("Reached maximum iterations, forcing completion");
            const finalMessage = {
              role: "user" as const,
              content:
                "Complete the workflow creation with the remaining required fields and views. Do not ask questions - proceed immediately.",
            };
            messages.push(finalMessage);
          }

          // If we have consecutive errors with the same tool, force the AI to use helper tools
          if (consecutiveErrors >= 1) {
            console.log(
              "Detected consecutive errors, forcing helper tool usage",
            );
            const forceHelperMessage = {
              role: "user" as const,
              content: `🚨 CRITICAL ERROR: You are getting repeated errors because you are NOT following the mandatory first steps!

🚨 STOP ALL CREATION OPERATIONS IMMEDIATELY!
🚨 You MUST use these helper tools FIRST before creating anything:
1. Use getCase to see the current workflow structure
2. Use listFields to see existing fields (to avoid duplicate names)
3. Use listViews to see existing views (to avoid duplicate names)

🚨 The errors you're getting are because you're trying to create items that already exist.
🚨 Use getCase, listFields, and listViews NOW before any other operations.
🚨 Do NOT retry the same failed operation - use the helper tools first!

🚨 CRITICAL UNDERSTANDING: WHAT ARE FIELDS VS STAGES/STEPS?
FIELDS represent BUSINESS DATA that gets collected from users (like forms, surveys, etc.)
- Examples: "Applicant Name", "Budget", "Start Date", "Cabinet Style", "Contractor Contact"
- Fields are the actual data points that users fill out
- Fields are stored in VIEWS, not in steps

STAGES/STEPS represent the WORKFLOW STRUCTURE (the process flow)
- Examples: "Request Stage", "Approval Stage", "Request Details Step", "Approval Step"
- Stages and steps define the process flow and organization
- Stages and steps are defined in the case model structure
- Stages and steps do NOT need fields - they are just containers/organizers

🚨 CRITICAL: NEVER CREATE FIELDS FOR WORKFLOW STRUCTURE!
🚨 WRONG: Creating fields like "Stage1", "Stage2", "Step1", "Step2", "Stage1Name", "Step1Description"
🚨 RIGHT: Creating fields like "Applicant Name", "Budget", "Start Date", "Cabinet Style"

🚨 CRITICAL: For workflow creation, you MUST complete ALL steps:
- Create case with basic structure
- Create meaningful business data fields (NOT generic stage/step fields)
- Create views for "Collect information" steps
- Update case with viewId references to link views to steps

🚨 CRITICAL FIELD CREATION RULES:
- Create fields for ACTUAL BUSINESS DATA, not workflow structure
- DO NOT create generic fields like "Stage1", "Stage2", "Step1", "Step2"
- Create fields that represent real data to be collected (e.g., "Applicant Name", "Budget", "Start Date")
- Focus on the business domain of the workflow
- Fields are for USER INPUT DATA, not for representing workflow structure
- The workflow structure (stages/steps) is already complete - you don't need fields for it

🚨 NEVER STOP AFTER CREATING FIELDS - COMPLETE THE ENTIRE WORKFLOW!`,
            };
            messages.push(forceHelperMessage);
            consecutiveErrors = 0; // Reset counter
          }

          console.log(`Calling OpenAI API (iteration ${loopCount})...`);
          const apiCallStartTime = Date.now();
          const completion = await openai.chat.completions.create({
            model: "gpt-35-turbo-16k",
            messages,
            max_tokens: 4096,
            stream: false,
            tools: openaiToolSchemas,
            temperature: 0.1,
          });
          const apiCallDuration = Date.now() - apiCallStartTime;
          console.log(`OpenAI API call completed in ${apiCallDuration}ms`);

          const choice = completion.choices[0];
          console.log(`Finish reason: ${choice.finish_reason}`);

          // Check if first iteration without tool calls and add instruction to proceed
          if (loopCount === 1 && choice.finish_reason !== "tool_calls") {
            console.log(
              "First iteration without tool calls - adding instruction to proceed with tools",
            );
            const proceedMessage = {
              role: "user" as const,
              content: `🚨 CRITICAL: DO NOT ASK QUESTIONS - PROCEED WITH TOOL CALLS!
🚨 You have all the information you need to proceed
🚨 Start with getCase, listFields, and listViews to check existing data
🚨 Then proceed with saveField, saveView, and saveCase in sequence
🚨 Do NOT ask for case name/description - extract it from the prompt
🚨 Do NOT stop to ask questions - proceed with the workflow creation!`,
            };
            messages.push(proceedMessage);
            continue; // Continue to next iteration
          }

          // If the model wants to call a function
          if (
            choice.finish_reason === "tool_calls" &&
            choice.message.tool_calls
          ) {
            console.log(
              `Tool calls detected: ${choice.message.tool_calls.length} tools`,
            );

            // Add the assistant message with tool calls to the conversation
            messages.push(choice.message);

            // Execute all tool calls in parallel for better performance
            const toolCallPromises = choice.message.tool_calls.map(
              async (toolCall) => {
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
                  const tool = databaseTools.find((t) => t.name === toolName);
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

                  // Add tool result to messages using the new format for o4-mini
                  messages.push({
                    role: "tool",
                    content: JSON.stringify(result),
                    tool_call_id: toolCall.id,
                  });

                  // Reset error counter on success
                  consecutiveErrors = 0;
                  lastErrorTool = "";

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

                  // Add tool result to messages using the new format for o4-mini
                  messages.push({
                    role: "tool",
                    content: JSON.stringify({ error: String(err) }),
                    tool_call_id: toolCall.id,
                  });

                  // Track consecutive errors
                  if (toolName === lastErrorTool) {
                    consecutiveErrors++;
                  } else {
                    consecutiveErrors = 1;
                    lastErrorTool = toolName;
                  }

                  return { success: false, error: err };
                }
              },
            );

            // Wait for all tool calls to complete
            await Promise.all(toolCallPromises);

            const loopDuration = Date.now() - loopStartTime;
            console.log(
              `=== Loop iteration ${loopCount} completed in ${loopDuration}ms ===`,
            );

            // Continue loop for next tool call or final message
            continue;
          }

          // If the model returns a final message (no tool call)
          if (choice.message.content) {
            console.log(
              "Final message received:",
              choice.message.content.substring(0, 200) + "...",
            );
            await processor.sendText(choice.message.content);
          }

          const loopDuration = Date.now() - loopStartTime;
          console.log(
            `=== Final loop iteration completed in ${loopDuration}ms ===`,
          );
          done = true;
        }

        const totalDuration = Date.now() - startTime;
        console.log(
          `=== LLM function call loop completed in ${totalDuration}ms ===`,
        );
        console.log(`Tool call history:`, toolCallHistory);

        await processor.sendDone();
        await writer.close();
      } catch (error) {
        const totalDuration = Date.now() - startTime;
        console.error(
          `Error in function call loop after ${totalDuration}ms:`,
          error,
        );
        await processor.sendError(
          error instanceof Error ? error.message : String(error),
        );
        await processor.sendDone();
        await writer.close();
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
