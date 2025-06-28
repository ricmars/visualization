export type ChatRole = "system" | "user" | "assistant";
export type LLMProvider = "openai";

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
    console.log(`Setting provider to: ${provider}`);
    this.currentProvider = provider;
  }

  static getProvider(): LLMProvider {
    return this.currentProvider;
  }

  static async generateResponse(prompt: string, systemContext: string) {
    console.log(`Generating response with provider: ${this.currentProvider}`);
    return await this.generateOpenAIResponse(prompt, systemContext);
  }

  private static async generateOpenAIResponse(
    prompt: string,
    systemContext: string,
  ) {
    console.log("Calling OpenAI API...");
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
