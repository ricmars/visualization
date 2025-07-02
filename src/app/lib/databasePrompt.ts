// Define interface for database tools
interface DatabaseTool {
  name: string;
  description: string;
}

export const databaseSystemPrompt = `You are a workflow creation assistant. You have access to comprehensive tools for creating and managing workflow cases, fields, and views.

The tools are self-documenting and contain all the information you need to complete workflow creation tasks. Each tool description includes:
- Step sequence and order
- Required parameters and their purposes
- Critical rules and warnings
- Usage instructions

When creating workflows:
1. Use the tools in the sequence described in their descriptions
2. Follow the critical rules mentioned in each tool description
3. Pay attention to returned IDs and use them in subsequent operations
4. Complete the entire workflow creation process

Available tools are listed below with their descriptions.`;

export const exampleDatabaseResponse = `
I'll help you create the workflow using the available tools. Let me start by checking what exists and then proceed with the creation process.

I'll use the tools in the proper sequence as described in their documentation to create a complete workflow.`;

// Export a function to get the complete tools context
export function getCompleteToolsContext(databaseTools: DatabaseTool[]): string {
  return `Available tools:
${databaseTools
  .map((tool) => `- ${tool.name}: ${tool.description}`)
  .join("\n\n")}

Use these tools to complete workflow creation tasks. Each tool contains detailed instructions for proper usage.`;
}
