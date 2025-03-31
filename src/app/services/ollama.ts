interface OllamaResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
}

export type ChatRole = 'system' | 'user' | 'assistant';

interface ChatMessage {
  role: ChatRole;
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
      return data.message.content;
    } catch (error) {
      console.error('Error calling Ollama:', error);
      throw new Error('Failed to generate response from Ollama');
    }
  }

  static async chat(messages: ChatMessage[]): Promise<string> {
    try {
      const response = await fetch(`${this.BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.MODEL,
          messages: messages,
          stream: false
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json() as OllamaResponse;
      console.log('Ollama response:', data); // Debug log
      return data.message.content;
    } catch (error) {
      console.error('Error calling Ollama chat:', error);
      throw new Error('Failed to generate chat response from Ollama');
    }
  }
} 