import React, { useState, useEffect, useRef } from "react";
import { FaEllipsisH } from "react-icons/fa";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";

export interface ChatMessage {
  id: string;
  content: string;
  sender: "user" | "assistant";
  timestamp: Date;
}

interface ChatInterfaceProps {
  onSendMessage: (message: string) => void;
  messages: ChatMessage[];
  isLoading: boolean;
  onClear: () => void;
  isProcessing: boolean;
}

// Function to format content based on its type
function formatContent(content: string): string {
  // Check if content is JSON
  try {
    const parsed = JSON.parse(content);
    // If it's a valid JSON object, format it as a code block
    return `\`\`\`json\n${JSON.stringify(parsed, null, 2)}\n\`\`\``;
  } catch {
    // If it's not JSON, return as is (will be rendered as markdown)
    return content;
  }
}

// Function to check if content should be filtered out
function shouldFilterContent(content: string): boolean {
  // Filter out empty or whitespace-only content
  if (!content.trim()) {
    return true;
  }

  return false;
}

export default function ChatInterface({
  onSendMessage,
  messages,
  isLoading,
  onClear,
  isProcessing,
}: ChatInterfaceProps) {
  const [input, setInput] = useState("");
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

  const markdownComponents: Components = {
    code({ className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || "");
      const isInline = !match;

      return isInline ? (
        <code
          className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-sm"
          {...props}
        >
          {children}
        </code>
      ) : (
        <pre className="bg-gray-100 dark:bg-gray-800 p-2 rounded text-sm overflow-x-auto">
          <code className={className} {...props}>
            {children}
          </code>
        </pre>
      );
    },
    pre({ children, ...props }) {
      return (
        <pre
          className="bg-gray-100 dark:bg-gray-800 p-2 rounded text-sm overflow-x-auto"
          {...props}
        >
          {children}
        </pre>
      );
    },
  };

  const renderMessage = (message: ChatMessage) => {
    // Filter out content that shouldn't be displayed
    if (shouldFilterContent(message.content)) {
      return null;
    }

    const formattedContent = formatContent(message.content);

    return (
      <div className="max-w-xs lg:max-w-md">
        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
          {message.sender === "user" ? "You" : "Assistant"}
        </div>
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown components={markdownComponents}>
            {formattedContent}
          </ReactMarkdown>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Chat Header */}
      <div className="flex justify-between items-center p-4 border-b">
        <h2 className="text-lg font-semibold">Chat</h2>
        <div className="flex items-center space-x-2">
          <button
            onClick={onClear}
            className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto" ref={chatContainerRef}>
        {messages.map((message) => {
          const renderedMessage = renderMessage(message);
          if (!renderedMessage) return null;

          return (
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
                {renderedMessage}
              </div>
            </div>
          );
        })}
        {(isLoading || isProcessing) && (
          <div className="flex justify-start">
            <div className="rounded-lg p-2 bg-gray-50 dark:bg-gray-800/50">
              <FaEllipsisH className="w-5 h-5 text-gray-500 dark:text-gray-400 animate-pulse" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t">
        <div className="flex space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            disabled={isLoading || isProcessing}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading || isProcessing}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
