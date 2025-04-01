export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface OllamaResponse {
  content: string;
}

export class OllamaService {
  private static readonly BASE_URL = 'http://localhost:11434/api';
  private static readonly MODEL = 'mistral';

  static async generateResponse(prompt: string): Promise<string> {
    try {
      const response = await fetch(`${this.BASE_URL}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.MODEL,
          prompt: prompt,
          stream: false
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json() as OllamaResponse;
      return data.content;
    } catch (error) {
      console.error('Error calling Ollama:', error);
      throw new Error('Failed to generate response from Ollama');
    }
  }

  static async chat(message: string): Promise<OllamaResponse> {
    // Simulate API call
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          content: `Processed: ${message}`
        });
      }, 1000);
    });
  }
} 