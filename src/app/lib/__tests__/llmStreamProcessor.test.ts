import { SharedLLMStreamProcessor } from "../llmStreamProcessor";
import { StreamProcessor } from "../llmUtils";

// Define proper types for test configuration
interface MockExtractTextConfig {
  extractText: jest.MockedFunction<
    (chunk: unknown) => Promise<string | undefined> | string | undefined
  >;
  onError?: jest.MockedFunction<(error: Error) => void>;
}

describe("SharedLLMStreamProcessor", () => {
  let processor: SharedLLMStreamProcessor;
  let mockStreamProcessor: jest.Mocked<StreamProcessor>;
  let mockConfig: MockExtractTextConfig;

  beforeEach(() => {
    processor = new SharedLLMStreamProcessor();
    mockStreamProcessor = {
      processChunk: jest.fn(),
      processToolCall: jest.fn(),
      sendText: jest.fn(),
      sendError: jest.fn(),
      sendDone: jest.fn(),
    };
    mockConfig = {
      extractText: jest.fn(),
      onError: jest.fn(),
    };
    jest.clearAllMocks();
  });

  describe("processStream", () => {
    it("should process regular text chunks without tool calls", async () => {
      const stream = async function* () {
        yield { text: "Hello" };
        yield { text: " World" };
      };

      mockConfig.extractText
        .mockResolvedValueOnce("Hello")
        .mockResolvedValueOnce(" World");

      await processor.processStream(stream(), mockStreamProcessor, mockConfig);

      expect(mockStreamProcessor.processChunk).toHaveBeenCalledWith("Hello");
      expect(mockStreamProcessor.processChunk).toHaveBeenCalledWith(" World");
      expect(mockStreamProcessor.sendDone).toHaveBeenCalled();
    });

    it("should process text chunks containing tool call patterns as regular text", async () => {
      const stream = async function* () {
        yield {
          text: 'TOOL: saveCase PARAMS: {"name": "test"}',
        };
      };

      mockConfig.extractText.mockResolvedValue(
        'TOOL: saveCase PARAMS: {"name": "test"}',
      );

      await processor.processStream(stream(), mockStreamProcessor, mockConfig);

      // Should process as regular text, not as tool calls
      expect(mockStreamProcessor.processChunk).toHaveBeenCalledWith(
        'TOOL: saveCase PARAMS: {"name": "test"}',
      );
      expect(mockStreamProcessor.processToolCall).not.toHaveBeenCalled();
      expect(mockStreamProcessor.sendDone).toHaveBeenCalled();
    });

    it("should process multiple text chunks with tool call patterns as regular text", async () => {
      const stream = async function* () {
        yield {
          text: 'TOOL: saveCase PARAMS: {"name": "test1"}\nTOOL: saveField PARAMS: {"name": "field1"}',
        };
      };

      mockConfig.extractText.mockResolvedValue(
        'TOOL: saveCase PARAMS: {"name": "test1"}\nTOOL: saveField PARAMS: {"name": "field1"}',
      );

      await processor.processStream(stream(), mockStreamProcessor, mockConfig);

      // Should process as regular text, not as tool calls
      expect(mockStreamProcessor.processChunk).toHaveBeenCalledWith(
        'TOOL: saveCase PARAMS: {"name": "test1"}\nTOOL: saveField PARAMS: {"name": "field1"}',
      );
      expect(mockStreamProcessor.processToolCall).not.toHaveBeenCalled();
      expect(mockStreamProcessor.sendDone).toHaveBeenCalled();
    });

    it("should handle mixed text and tool call patterns as regular text", async () => {
      const stream = async function* () {
        yield {
          text: 'Hello TOOL: saveCase PARAMS: {"name": "test"} World',
        };
      };

      mockConfig.extractText.mockResolvedValue(
        'Hello TOOL: saveCase PARAMS: {"name": "test"} World',
      );

      await processor.processStream(stream(), mockStreamProcessor, mockConfig);

      // Should process as regular text, not as tool calls
      expect(mockStreamProcessor.processChunk).toHaveBeenCalledWith(
        'Hello TOOL: saveCase PARAMS: {"name": "test"} World',
      );
      expect(mockStreamProcessor.processToolCall).not.toHaveBeenCalled();
      expect(mockStreamProcessor.sendDone).toHaveBeenCalled();
    });

    it("should handle empty chunks", async () => {
      const stream = async function* () {
        yield { text: "" };
        yield { text: "Hello" };
      };

      mockConfig.extractText
        .mockResolvedValueOnce("")
        .mockResolvedValueOnce("Hello");

      await processor.processStream(stream(), mockStreamProcessor, mockConfig);

      expect(mockStreamProcessor.processChunk).toHaveBeenCalledWith("Hello");
      expect(mockStreamProcessor.sendDone).toHaveBeenCalled();
    });

    it("should handle undefined chunks", async () => {
      const stream = async function* () {
        yield { text: undefined };
        yield { text: "Hello" };
      };

      mockConfig.extractText
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce("Hello");

      await processor.processStream(stream(), mockStreamProcessor, mockConfig);

      expect(mockStreamProcessor.processChunk).toHaveBeenCalledWith("Hello");
      expect(mockStreamProcessor.sendDone).toHaveBeenCalled();
    });

    it("should handle errors in extractText", async () => {
      const stream = async function* () {
        yield { text: "Hello" };
      };

      mockConfig.extractText.mockRejectedValue(new Error("Extract error"));

      await processor.processStream(stream(), mockStreamProcessor, mockConfig);

      expect(mockConfig.onError).toHaveBeenCalledWith(expect.any(Error));
      expect(mockStreamProcessor.sendError).toHaveBeenCalledWith(
        "Extract error",
      );
    });

    it("should process remaining text at end of stream", async () => {
      const stream = async function* () {
        yield { text: "Hello" };
      };

      mockConfig.extractText.mockResolvedValue("Hello");

      await processor.processStream(stream(), mockStreamProcessor, mockConfig);

      expect(mockStreamProcessor.processChunk).toHaveBeenCalledWith("Hello");
      expect(mockStreamProcessor.sendDone).toHaveBeenCalled();
    });

    it("should handle different chunk types", async () => {
      const stream = async function* () {
        yield { text: () => "Hello" };
        yield { text: "World" };
        yield { choices: [{ delta: { content: "!" } }] };
      };

      mockConfig.extractText
        .mockResolvedValueOnce("Hello")
        .mockResolvedValueOnce("World")
        .mockResolvedValueOnce("!");

      await processor.processStream(stream(), mockStreamProcessor, mockConfig);

      expect(mockStreamProcessor.processChunk).toHaveBeenCalledWith("Hello");
      expect(mockStreamProcessor.processChunk).toHaveBeenCalledWith("World");
      expect(mockStreamProcessor.processChunk).toHaveBeenCalledWith("!");
      expect(mockStreamProcessor.sendDone).toHaveBeenCalled();
    });
  });
});
