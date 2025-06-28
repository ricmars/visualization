import { SharedLLMStreamProcessor } from "../llmStreamProcessor";
import { StreamProcessor, extractToolCall } from "../llmUtils";

// Mock extractToolCall to control its behavior in tests
jest.mock("../llmUtils", () => ({
  ...jest.requireActual("../llmUtils"),
  extractToolCall: jest.fn(),
}));

const mockExtractToolCall = extractToolCall as jest.MockedFunction<
  typeof extractToolCall
>;

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
      mockExtractToolCall.mockReturnValue(null);

      await processor.processStream(stream(), mockStreamProcessor, mockConfig);

      expect(mockStreamProcessor.processChunk).toHaveBeenCalledWith("Hello");
      expect(mockStreamProcessor.processChunk).toHaveBeenCalledWith(" World");
      expect(mockStreamProcessor.sendDone).toHaveBeenCalled();
    });

    it("should process tool calls and remove them from accumulated text", async () => {
      const stream = async function* () {
        yield { text: 'TOOL: createCase PARAMS: {"name": "test"}' };
      };

      mockConfig.extractText.mockResolvedValue(
        'TOOL: createCase PARAMS: {"name": "test"}',
      );
      mockExtractToolCall
        .mockReturnValueOnce({
          toolName: "createCase",
          params: { name: "test" },
        })
        .mockReturnValueOnce(null);

      await processor.processStream(stream(), mockStreamProcessor, mockConfig);

      expect(mockStreamProcessor.processToolCall).toHaveBeenCalledWith(
        "createCase",
        { name: "test" },
      );
      expect(mockStreamProcessor.sendDone).toHaveBeenCalled();
    });

    it("should process multiple tool calls in sequence", async () => {
      const stream = async function* () {
        yield {
          text: 'TOOL: createCase PARAMS: {"name": "test1"}\nTOOL: createField PARAMS: {"name": "field1"}',
        };
      };

      mockConfig.extractText.mockResolvedValue(
        'TOOL: createCase PARAMS: {"name": "test1"}\nTOOL: createField PARAMS: {"name": "field1"}',
      );
      mockExtractToolCall
        .mockReturnValueOnce({
          toolName: "createCase",
          params: { name: "test1" },
        })
        .mockReturnValueOnce({
          toolName: "createField",
          params: { name: "field1" },
        })
        .mockReturnValueOnce(null);

      await processor.processStream(stream(), mockStreamProcessor, mockConfig);

      expect(mockStreamProcessor.processToolCall).toHaveBeenCalledWith(
        "createCase",
        { name: "test1" },
      );
      expect(mockStreamProcessor.processToolCall).toHaveBeenCalledWith(
        "createField",
        { name: "field1" },
      );
      expect(mockStreamProcessor.sendDone).toHaveBeenCalled();
    });

    it("should handle mixed text and tool calls", async () => {
      const stream = async function* () {
        yield { text: 'Hello TOOL: createCase PARAMS: {"name": "test"} World' };
      };

      mockConfig.extractText.mockResolvedValue(
        'Hello TOOL: createCase PARAMS: {"name": "test"} World',
      );
      mockExtractToolCall
        .mockReturnValueOnce({
          toolName: "createCase",
          params: { name: "test" },
        })
        .mockReturnValueOnce(null);

      await processor.processStream(stream(), mockStreamProcessor, mockConfig);

      expect(mockStreamProcessor.processToolCall).toHaveBeenCalledWith(
        "createCase",
        { name: "test" },
      );
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
      mockExtractToolCall.mockReturnValue(null);

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
      mockExtractToolCall.mockReturnValue(null);

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

    it("should handle errors in processToolCall", async () => {
      const stream = async function* () {
        yield { text: 'TOOL: createCase PARAMS: {"name": "test"}' };
      };

      mockConfig.extractText.mockResolvedValue(
        'TOOL: createCase PARAMS: {"name": "test"}',
      );
      mockExtractToolCall.mockReturnValue({
        toolName: "createCase",
        params: { name: "test" },
      });
      mockStreamProcessor.processToolCall.mockRejectedValue(
        new Error("Tool execution error"),
      );

      await processor.processStream(stream(), mockStreamProcessor, mockConfig);

      expect(mockStreamProcessor.sendDone).toHaveBeenCalled();
    });

    it("should process remaining tool calls at end of stream", async () => {
      const stream = async function* () {
        yield { text: "Hello" };
      };

      mockConfig.extractText.mockResolvedValue("Hello");
      mockExtractToolCall
        .mockReturnValueOnce(null) // First call during stream processing
        .mockReturnValueOnce({
          toolName: "createCase",
          params: { name: "test" },
        }) // Final call
        .mockReturnValueOnce(null);

      await processor.processStream(stream(), mockStreamProcessor, mockConfig);

      expect(mockStreamProcessor.processToolCall).toHaveBeenCalledWith(
        "createCase",
        { name: "test" },
      );
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
      mockExtractToolCall.mockReturnValue(null);

      await processor.processStream(stream(), mockStreamProcessor, mockConfig);

      expect(mockStreamProcessor.processChunk).toHaveBeenCalledWith("Hello");
      expect(mockStreamProcessor.processChunk).toHaveBeenCalledWith("World");
      expect(mockStreamProcessor.processChunk).toHaveBeenCalledWith("!");
      expect(mockStreamProcessor.sendDone).toHaveBeenCalled();
    });
  });
});
