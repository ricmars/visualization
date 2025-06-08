import { Stage, Field } from "../types";
import { databaseSystemPrompt } from "../lib/databasePrompt";
import { fetchWithBaseUrl } from "../lib/fetchWithBaseUrl";

export type ChatRole = "system" | "user" | "assistant";
export type LLMProvider = "gemini" | "openai";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface Response {
  content: string;
}

export class Service {
  private static currentProvider: LLMProvider = "openai";

  static setProvider(provider: LLMProvider) {
    this.currentProvider = provider;
  }

  static getProvider(): LLMProvider {
    return this.currentProvider;
  }

  static async generateResponse(prompt: string, systemContext: string) {
    if (this.currentProvider === "gemini") {
      return await this.generateGeminiResponse(prompt, systemContext);
    } else {
      return await this.generateOpenAIResponse(prompt, systemContext);
    }
  }

  private static async generateGeminiResponse(
    prompt: string,
    systemContext: string,
  ) {
    const response = await fetch("/api/gemini", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        systemContext,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to generate response: ${response.statusText}`);
    }

    return response;
  }

  private static async generateOpenAIResponse(
    prompt: string,
    systemContext: string,
  ) {
    const response = await fetch("/api/openai", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        systemContext,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to generate response: ${response.statusText}`);
    }

    return response;
  }

  static async chat(message: string): Promise<Response> {
    // Simulate API call
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          content: `Processed: ${message}`,
        });
      }, 1000);
    });
  }
}
