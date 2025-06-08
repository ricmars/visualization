declare module "ai" {
  export interface OpenAIStreamOptions {
    experimental_onFunctionCall?: (functionCall: {
      name: string;
      arguments: string;
    }) => Promise<void>;
    onCompletion?: (completion: string) => void;
  }

  export function OpenAIStream(
    response: Response,
    options?: OpenAIStreamOptions,
  ): ReadableStream;

  export class StreamingTextResponse extends Response {
    constructor(stream: ReadableStream);
  }
}
