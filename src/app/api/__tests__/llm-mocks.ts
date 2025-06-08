import { ReadableStream } from "stream/web";

export const mockOpenAIResponse = {
  choices: [
    {
      delta: {
        content:
          'Let me help you create a case.\n\nTOOL: createCase PARAMS: {\n  "name": "Test Case",\n  "description": "A test case",\n  "model": {\n    "stages": []\n  }\n}',
      },
    },
  ],
};

export const mockGeminiResponse = {
  text: () =>
    'Let me help you create a case.\n\nTOOL: createCase PARAMS: {\n  "name": "Test Case",\n  "description": "A test case",\n  "model": {\n    "stages": []\n  }\n}',
};

export const createMockStream = (chunks: any[]) => {
  return new ReadableStream({
    async start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });
};

// Async generator for OpenAI mock stream
async function* openAIStreamGenerator() {
  yield { choices: [{ delta: { content: '{"init":true}' } }] };
  yield { choices: [{ delta: { content: "TOOL: createCase PARAMS: {\n" } }] };
  yield { choices: [{ delta: { content: '  "name": "Test Case",\n' } }] };
  yield {
    choices: [{ delta: { content: '  "description": "A test case",\n' } }],
  };
  yield { choices: [{ delta: { content: '  "model": {\n' } }] };
  yield { choices: [{ delta: { content: '    "stages": []\n' } }] };
  yield { choices: [{ delta: { content: "  }\n" } }] };
  yield { choices: [{ delta: { content: "}" } }] };
}

export function mockOpenAIStream() {
  return { stream: openAIStreamGenerator() };
}

// Async generator for Gemini mock stream
// export function geminiStreamGenerator() {
//   return {
//     [Symbol.asyncIterator]: async function* () {
//       yield { text: () => 'data: {"text":"{\\"init\\":true}"}' };
//       yield { text: () => 'data: {"text":"{\\"toolCall\\":{\\"name\\":\\"Test Case\\"}}"} };
//       yield { text: () => 'data: {"done":true}' };
//     }
//   };
// }

export function mockGeminiStream() {
  // This is an async iterable of objects with a .text() method
  const chunks = [
    { text: async () => 'data: {"text":"{\\"init\\":true}"}' },
    {
      text: async () =>
        'data: {"text":"{\\"toolCall\\":{\\"name\\":\\"Test Case\\"}}"}',
    },
    { text: async () => 'data: {"done":true}' },
  ];
  return {
    [Symbol.asyncIterator]: async function* () {
      for (const chunk of chunks) {
        yield chunk;
      }
    },
  };
}

export function mockGeminiErrorStream() {
  // This is an async iterable of a single error chunk
  return {
    [Symbol.asyncIterator]: async function* () {
      yield { text: async () => JSON.stringify({ error: "API Error" }) };
    },
  };
}
