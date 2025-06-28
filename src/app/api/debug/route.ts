import { NextResponse } from "next/server";
import { Service } from "../../services/service";
import {
  databaseSystemPrompt,
  exampleDatabaseResponse,
} from "../../lib/databasePrompt";

export async function GET() {
  const currentProvider = Service.getProvider();
  const enhancedSystemPrompt = `${databaseSystemPrompt}\n\n${exampleDatabaseResponse}`;

  return NextResponse.json({
    currentProvider,
    systemPromptLength: enhancedSystemPrompt.length,
    systemPromptPreview: enhancedSystemPrompt.substring(0, 200) + "...",
    hasToolInstructions: enhancedSystemPrompt.includes("TOOL:"),
    hasCreateCase: enhancedSystemPrompt.includes("createCase"),
    timestamp: new Date().toISOString(),
  });
}
