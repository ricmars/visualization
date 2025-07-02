// OpenAI tool schemas for function calling API
// These schemas should match the parameter types in llmTools.ts
import type { ChatCompletionTool } from "openai/resources/chat/completions";
import { pool } from "./db";
import { createSharedTools } from "./sharedTools";

// Generate schemas from shared tools to avoid duplication
export const openaiToolSchemas: ChatCompletionTool[] = (() => {
  const sharedTools = createSharedTools(pool);
  return sharedTools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
})();
