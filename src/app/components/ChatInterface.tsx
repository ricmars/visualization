import React, { useState, useEffect, useRef } from "react";
import { FaEllipsisH, FaUndo, FaCheck, FaClock } from "react-icons/fa";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";

export interface ChatMessage {
  id: string;
  content: string;
  sender: "user" | "assistant";
  timestamp: Date;
}

interface CheckpointSession {
  id: string;
  description: string;
  startedAt: string;
}

interface CheckpointStatus {
  activeSession?: CheckpointSession;
  activeCheckpoints: Array<{
    id: string;
    description: string;
    created_at: Date;
    source?: string;
    toolName?: string;
  }>;
  summary: {
    total: number;
    mcp: number;
    llm: number;
  };
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
  const [message, setMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [checkpointStatus, setCheckpointStatus] =
    useState<CheckpointStatus | null>(null);
  const [_isCheckpointLoading, setIsCheckpointLoading] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load checkpoint status on component mount
  useEffect(() => {
    fetchCheckpointStatus();
  }, []);

  const fetchCheckpointStatus = async () => {
    try {
      const response = await fetch("/api/checkpoint");
      const data = await response.json();
      if (data.activeSession) {
        setCheckpointStatus(data);
      }
      // Log checkpoint summary for debugging
      if (data.summary && data.summary.total > 0) {
        console.log(
          `Active checkpoints: ${data.summary.total} (${data.summary.llm} LLM, ${data.summary.mcp} MCP)`,
        );
      }
    } catch (error) {
      console.error("Failed to fetch checkpoint status:", error);
    }
  };

  const rollbackCheckpoint = async () => {
    if (!checkpointStatus?.activeSession) return;

    setIsCheckpointLoading(true);
    try {
      const response = await fetch("/api/checkpoint?action=rollback", {
        method: "POST",
      });

      if (response.ok) {
        setCheckpointStatus(null);
        // Optionally refresh the page or reload data
        window.location.reload();
      } else {
        console.error("Failed to rollback checkpoint");
      }
    } catch (error) {
      console.error("Error rolling back checkpoint:", error);
    } finally {
      setIsCheckpointLoading(false);
    }
  };

  const commitCheckpoint = async () => {
    if (!checkpointStatus?.activeSession) return;

    setIsCheckpointLoading(true);
    try {
      const response = await fetch("/api/checkpoint?action=commit", {
        method: "POST",
      });

      if (response.ok) {
        setCheckpointStatus(null);
      } else {
        console.error("Failed to commit checkpoint");
      }
    } catch (error) {
      console.error("Error committing checkpoint:", error);
    } finally {
      setIsCheckpointLoading(false);
    }
  };

  const handleSendMessage = () => {
    if (message.trim()) {
      onSendMessage(message.trim());
      setMessage("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
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

  const filteredMessages = messages.filter(
    (msg) => !shouldFilterContent(msg.content),
  );

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* Checkpoint Status Bar */}
      {checkpointStatus?.activeSession && (
        <div className="bg-blue-50 dark:bg-blue-900 border-b border-blue-200 dark:border-blue-700 px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <FaClock className="text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  Active Session: {checkpointStatus.activeSession.description}
                </span>
                <span className="text-xs text-blue-700 dark:text-blue-300">
                  Started{" "}
                  {new Date(
                    checkpointStatus.activeSession.startedAt,
                  ).toLocaleTimeString()}
                </span>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={rollbackCheckpoint}
                className="flex items-center space-x-1 px-3 py-1 text-sm bg-red-100 hover:bg-red-200 dark:bg-red-900 dark:hover:bg-red-800 text-red-700 dark:text-red-300 rounded-md"
              >
                <FaUndo className="w-3 h-3" />
                <span>Rollback</span>
              </button>
              <button
                onClick={commitCheckpoint}
                className="flex items-center space-x-1 px-3 py-1 text-sm bg-green-100 hover:bg-green-200 dark:bg-green-900 dark:hover:bg-green-800 text-green-700 dark:text-green-300 rounded-md"
              >
                <FaCheck className="w-3 h-3" />
                <span>Commit</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {filteredMessages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${
              msg.sender === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[80%] p-3 rounded-lg ${
                msg.sender === "user"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              }`}
            >
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown components={markdownComponents}>
                  {formatContent(msg.content)}
                </ReactMarkdown>
              </div>
              <div
                className={`text-xs mt-2 ${
                  msg.sender === "user"
                    ? "text-blue-100"
                    : "text-gray-500 dark:text-gray-400"
                }`}
              >
                {msg.timestamp.toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Message input */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-4">
        <div className="flex space-x-2">
          <div className="flex-1">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              rows={1}
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              disabled={isLoading || isProcessing}
            />
          </div>
          <button
            onClick={handleSendMessage}
            disabled={isLoading || !message.trim() || isProcessing}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading || isProcessing ? "..." : "Send"}
          </button>
          <button
            onClick={onClear}
            className="px-3 py-2 text-gray-600 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 rounded-lg ring-1 ring-gray-200 dark:ring-gray-700 hover:ring-red-200 dark:hover:ring-red-800 focus:outline-none focus:ring-2 focus:ring-red-500 dark:focus:ring-red-500 active:bg-red-50 dark:active:bg-red-900/20 transition-colors"
          >
            <FaEllipsisH />
          </button>
        </div>
      </div>
    </div>
  );
}
