import { createSharedTools } from "./sharedTools";
import { pool } from "./db";

// Claude integration layer for MCP server
export class ClaudeMCPIntegration {
  private sharedTools: ReturnType<typeof createSharedTools>;

  constructor() {
    this.sharedTools = createSharedTools(pool);
  }

  // Convert Claude function call to MCP tool call
  async executeTool(toolName: string, arguments_: Record<string, unknown>) {
    const tool = this.sharedTools.find((t) => t.name === toolName);

    if (!tool) {
      throw new Error(`Tool ${toolName} not found`);
    }

    try {
      // Type assertion since we know the tool exists and can handle the arguments
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (tool as any).execute(arguments_);
      return {
        success: true,
        result,
        content: JSON.stringify(result, null, 2),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // Get available tools for Claude function calling
  getAvailableTools() {
    return this.sharedTools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));
  }

  // Get tool schemas in OpenAI format for Claude
  getOpenAIToolSchemas() {
    return this.sharedTools.map((tool) => ({
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }
}

// Singleton instance
export const claudeMCP = new ClaudeMCPIntegration();
