export function mockGeminiErrorStream() {
  // This is an async iterable of a single error chunk
  return {
    [Symbol.asyncIterator]: async function* () {
      yield { text: async () => JSON.stringify({ error: "API Error" }) };
    },
  };
}
