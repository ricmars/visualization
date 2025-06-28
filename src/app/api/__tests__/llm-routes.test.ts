// Mock OpenAI client as a constructor
jest.mock("openai", () => {
  return {
    __esModule: true,
    default: class OpenAI {
      constructor() {
        return {
          chat: {
            completions: {
              create: jest.fn().mockResolvedValue({
                [Symbol.asyncIterator]: async function* () {
                  yield {
                    choices: [
                      {
                        delta: {
                          content: "Test response",
                        },
                      },
                    ],
                  };
                  yield {
                    choices: [
                      {
                        delta: {
                          content: " completed",
                        },
                      },
                    ],
                  };
                },
              }),
            },
          },
        };
      }
    },
  };
});

import { NextRequest } from "next/server";
import { POST as openaiPost } from "../openai/route";

// Mock environment variables
process.env.AZURE_OPENAI_ENDPOINT = "https://test.openai.azure.com";
process.env.AZURE_OPENAI_DEPLOYMENT = "test-deployment";
process.env.AZURE_TENANT_ID = "test-tenant";
process.env.AZURE_CLIENT_ID = "test-client";
process.env.AZURE_CLIENT_SECRET = "test-secret";

// Mock fetch for Azure token
global.fetch = jest.fn().mockImplementation((url) => {
  if (url.includes("login.microsoftonline.com")) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ access_token: "test-token" }),
    });
  }
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
  });
});

function mockRequest(prompt: string): NextRequest {
  return new NextRequest("http://localhost:3000/api/openai", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      systemContext: "Test system context",
    }),
  });
}

// Helper function to parse SSE response
async function parseSSEResponse(
  response: Response,
): Promise<{ text: string[]; errors: string[] }> {
  const text = await response.text();
  const lines = text.split("\n");
  const messages: string[] = [];
  const errors: string[] = [];

  for (const line of lines) {
    if (line.startsWith("data: ")) {
      try {
        const data = JSON.parse(line.slice(6));
        if (data.text) {
          messages.push(data.text);
        }
        if (data.error) {
          errors.push(data.error);
        }
      } catch (_e) {
        // Ignore parsing errors for non-JSON lines
      }
    }
  }

  return { text: messages, errors };
}

describe("LLM Routes Integration Tests", () => {
  describe("OpenAI Route", () => {
    it("should process a simple prompt and return a streaming response", async () => {
      const request = mockRequest("Create a simple case");
      const response = await openaiPost(request);
      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("text/event-stream");

      const { text } = await parseSSEResponse(response);
      expect(text.length).toBeGreaterThan(0);
      expect(text.join("")).toContain("Test response");
    });

    it("should handle errors gracefully", async () => {
      // Mock the OpenAI client to throw an error
      const mockCreate = jest.fn().mockRejectedValue(new Error("API Error"));
      const mockOpenAI = {
        chat: {
          completions: {
            create: mockCreate,
          },
        },
      };

      // Replace the mock implementation
      const openaiModule = require("openai");
      openaiModule.default = jest.fn().mockReturnValue(mockOpenAI);

      const request = mockRequest("Create a case");
      const response = await openaiPost(request);
      expect(response.status).toBe(200); // Streaming responses return 200 even with errors
      expect(response.headers.get("Content-Type")).toBe("text/event-stream");

      const { errors } = await parseSSEResponse(response);
      expect(errors.join("")).toContain("API Error");
    });
  });
});
