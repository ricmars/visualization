import React, { useState, useRef, useEffect } from "react";
import { Message } from "../types";
import { LLMProvider } from "../services/service";
import { FaEllipsisH } from "react-icons/fa";

export interface ChatInterfaceProps {
  onSendMessage: (message: string) => void;
  messages: Message[];
  isLoading: boolean;
  onClear: () => void;
  isProcessing: boolean;
}

interface StageBreakdown {
  name: string;
  processes: {
    name: string;
    steps: {
      name: string;
    }[];
  }[];
}

export default function ChatInterface({
  onSendMessage,
  messages,
  isLoading,
  onClear,
  isProcessing,
}: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const [provider, setProvider] = useState<LLMProvider>("gemini");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onSendMessage(input.trim());
      setInput("");
    }
  };

  const renderMessage = (message: Message) => {
    if (message.type === "json") {
      const content =
        typeof message.content === "string"
          ? JSON.parse(message.content)
          : message.content;
      return (
        <div className="whitespace-pre-wrap">
          {typeof content.message === "string" ? content.message : ""}
          {content.visualization && (
            <div className="mt-2">
              <h3 className="font-semibold">Workflow Structure:</h3>
              <div className="mt-1">
                {content.visualization.stageBreakdown.map(
                  (stage: StageBreakdown, index: number) => (
                    <div key={index} className="ml-4">
                      <p className="font-medium">{stage.name}</p>
                      <div className="ml-4">
                        {stage.processes.map((process, pIndex: number) => (
                          <div key={pIndex} className="ml-4">
                            <p className="text-sm text-gray-600">
                              {process.name}
                            </p>
                            <div className="ml-4">
                              {process.steps.map((step, sIndex: number) => (
                                <p
                                  key={sIndex}
                                  className="text-sm text-gray-500"
                                >
                                  • {step.name}
                                </p>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>
          )}
        </div>
      );
    }
    // Only render string content for text messages
    return (
      <div className="whitespace-pre-wrap">
        {typeof message.content === "string" ? message.content : ""}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Chat Header */}
      <div className="flex justify-between items-center p-4 border-b">
        <h2 className="text-lg font-semibold">Chat</h2>
        <div className="flex items-center space-x-2">
          <select
            value={provider}
            onChange={(e) => {
              setProvider(e.target.value as LLMProvider);
            }}
            className="bg-gray-700 text-white px-3 py-1 rounded"
          >
            <option value="openai">OpenAI</option>
            <option value="gemini">Gemini</option>
          </select>
          <button
            onClick={onClear}
            className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto" ref={chatContainerRef}>
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.sender === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`rounded-lg p-2 ${
                message.sender === "user"
                  ? "bg-blue-50 dark:bg-blue-900/20"
                  : "bg-gray-50 dark:bg-gray-800/50"
              }`}
            >
              {renderMessage(message)}
            </div>
          </div>
        ))}
        {(isLoading || isProcessing) && (
          <div className="flex justify-start">
            <div className="rounded-lg p-2 bg-gray-50 dark:bg-gray-800/50">
              <FaEllipsisH className="w-5 h-5 text-gray-500 dark:text-gray-400 animate-pulse" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <form
        onSubmit={handleSubmit}
        className="p-2 border-t dark:border-gray-700 bg-white dark:bg-gray-900"
      >
        <div className="flex space-x-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder="Type a command or ask a question..."
            className="flex-1 p-2 rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-none h-[72px] min-h-[72px] overflow-y-auto"
            rows={3}
            disabled={isProcessing}
          />
          <button
            type="submit"
            className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors h-[72px] disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isProcessing}
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
