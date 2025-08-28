import React, { useState, useEffect, useRef } from "react";
import {
  FaUndo,
  FaCheck,
  FaClock,
  FaArrowUp,
  FaStop,
  FaMicrophone,
} from "react-icons/fa";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";

// Typing indicator component
const TypingIndicator = () => (
  <div className="flex items-center space-x-1">
    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
    <div
      className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
      style={{ animationDelay: "0.1s" }}
    ></div>
    <div
      className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
      style={{ animationDelay: "0.2s" }}
    ></div>
  </div>
);

// Blinking cursor component
const BlinkingCursor = () => (
  <span className="inline-block w-0.5 h-4 bg-blue-500 animate-pulse ml-1"></span>
);

export interface ChatMessage {
  id: string;
  content: string;
  sender: "user" | "assistant";
  timestamp: Date;
  isThinking?: boolean; // Add flag to indicate if the message is actively being updated
  // Total time taken by the assistant to complete the response, in milliseconds
  durationMs?: number;
  // Approximate number of prompt tokens sent to the LLM for this response
  tokenCount?: number;
  tokenExact?: boolean;
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
  onAbort?: () => void;
  messages: ChatMessage[];
  isLoading: boolean;
  isProcessing: boolean;
  caseid?: number;
}

// Function to format content based on its type
function normalizeMarkdown(original: string): string {
  let content = original;
  // Hide completion control markers from user display
  content = content.replace(/^\s*\[\[COMPLETED\]\]\s*\n?/i, "");
  // Also remove any inline occurrences of the marker while preserving line breaks
  content = content.replace(/[ \t]*\[\[COMPLETED\]\][ \t]*/gi, "");
  // Normalize line endings to \n
  content = content.replace(/\r\n?/g, "\n");
  // Normalize headings and colon/bullet variants in one pass
  // Matches line starts like: "Analyze", "Reasoning", "Plan", "Next Action"
  // with optional leading bullet and optional trailing colon
  // Remove any empty heading lines like "#" or "##" with no text
  content = content.replace(/(^|\n)\s*#{1,6}\s*(?=\n|$)/g, "$1");
  // Ensure headings start at the beginning of a line with a blank line before
  content = content.replace(/([^\n])\s*(#{1,6})\s+/g, (match, prev, hashes) => {
    return `${prev}\n\n${hashes} `;
  });

  // Ensure unordered list markers start on a new line
  content = content.replace(/([^\n])\s*([\-*+]\s+)/g, (match, prev, marker) => {
    return `${prev}\n${marker}`;
  });

  // Ensure ordered list markers like "1. " start on a new line
  content = content.replace(/([^\n])\s*(\d+\.\s+)/g, (match, prev, marker) => {
    return `${prev}\n${marker}`;
  });

  // Add missing space after unordered list markers at line start: "*Item" -> "* Item"
  content = content.replace(
    /(^|\n)([\-*+])(?!\s|[\-*+])/g,
    (match, start, marker) => {
      return `${start}${marker} `;
    },
  );

  // Add missing space after ordered list markers at line start: "1.Item" -> "1. Item"
  content = content.replace(/(^|\n)(\d+\.)(?!\s)/g, (match, start, marker) => {
    return `${start}${marker} `;
  });

  // Normalize multiple consecutive spaces after list markers
  content = content.replace(
    /(^|\n)([\-*+]\s{2,})/g,
    (match, start) => `${start}* `,
  );

  // Ensure a blank line between paragraphs when headings or lists follow text immediately
  content = content.replace(
    /([\S])\n(#{1,6}|[\-*+]\s|\d+\.\s)/g,
    (m, prev, next) => {
      return `${prev}\n\n${next}`;
    },
  );

  // No special newline handling for completion phrase; rely on [[COMPLETED]] marker format

  return content;
}

function formatContent(content: string): string {
  // Check if content is JSON
  try {
    const parsed = JSON.parse(content);
    // If it's a valid JSON object, format it as a code block
    return `\`\`\`json\n${JSON.stringify(parsed, null, 2)}\n\`\`\``;
  } catch {
    // If it's not JSON, return as is (will be rendered as markdown)
    return normalizeMarkdown(content);
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

// Format duration into a human-friendly string per requirements
// - >= 60s: show minutes and seconds (e.g., 1m30s)
// - 10s..59.999s: show seconds only (rounded to nearest second)
// - 1s..9.999s: show seconds and milliseconds (e.g., 8s340ms)
// - < 1s: show milliseconds only (e.g., 450ms)
function formatDuration(durationMs: number): string {
  if (!Number.isFinite(durationMs) || durationMs < 0) return "";
  const totalMs = Math.round(durationMs);
  const totalSeconds = Math.floor(totalMs / 1000);
  const ms = totalMs % 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes >= 1) {
    return `${minutes}m ${seconds}s`;
  }
  if (totalSeconds >= 10) {
    return `${totalSeconds}s`;
  }
  if (totalSeconds >= 1) {
    return `${totalSeconds}s ${ms}ms`;
  }
  return `${ms}ms`;
}

export default function ChatInterface({
  onSendMessage,
  onAbort,
  messages,
  isLoading,
  isProcessing,
  caseid,
}: ChatInterfaceProps) {
  const [message, setMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [checkpointStatus, setCheckpointStatus] =
    useState<CheckpointStatus | null>(null);
  const [_isCheckpointLoading, setIsCheckpointLoading] = useState(false);
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [selectedLang, setSelectedLang] = useState<string>(
    typeof navigator !== "undefined" && (navigator as any).language
      ? (navigator as any).language
      : "en-US",
  );
  const [recognition, setRecognition] = useState<any | null>(null);
  const [disableRecord, setDisableRecord] = useState(false);
  const [recordedValue, setRecordedValue] = useState<string>("");
  const [audioOutputDevice, setAudioOutputDevice] =
    useState<MediaDeviceInfo | null>(null);
  const [audioOutputDevices, setAudioOutputDevices] = useState<
    MediaDeviceInfo[]
  >([]);
  const [preferredOutputDeviceId, setPreferredOutputDeviceId] = useState<
    string | null
  >(null);
  const [hasVoiceConfig, setHasVoiceConfig] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auto-resize textarea based on content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        150,
      )}px`;
    }
  }, [message]);

  // Load checkpoint status on component mount
  useEffect(() => {
    fetchCheckpointStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load saved voice config on mount
  useEffect(() => {
    try {
      const savedLang = localStorage.getItem("voice.lang");
      if (savedLang) setSelectedLang(savedLang);
      const savedDevId = localStorage.getItem("voice.audioOutputDeviceId");
      if (savedDevId) setPreferredOutputDeviceId(savedDevId);
      setHasVoiceConfig(localStorage.getItem("voice.configured") === "true");
    } catch {}
  }, []);

  // Initialize webkitSpeechRecognition / SpeechRecognition
  useEffect(() => {
    const W: any = typeof window !== "undefined" ? window : {};
    const SR = W.webkitSpeechRecognition || W.SpeechRecognition;
    if (!SR) return;
    const tmpRecognition = new SR();
    tmpRecognition.interimResults = false;
    tmpRecognition.continuous = false;
    tmpRecognition.onresult = (event: any) => {
      const lastIndex = event.results?.length ? event.results.length - 1 : 0;
      const result = event.results?.[lastIndex]?.[0]?.transcript;
      if (!result || String(result).trim() === "") return;
      setRecordedValue(result);
    };
    tmpRecognition.onend = () => {
      setDisableRecord(false);
      setIsRecording(false);
    };
    tmpRecognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event?.error);
      setDisableRecord(false);
    };
    tmpRecognition.onnomatch = () => {};
    setRecognition(tmpRecognition);
    return () => {
      try {
        tmpRecognition.stop();
      } catch {}
    };
  }, []);

  // When we have a recorded value, populate the textarea (do not auto-send)
  useEffect(() => {
    if (!recordedValue || recordedValue.trim() === "") return;
    setMessage(recordedValue);
  }, [recordedValue]);

  const startRecording = () => {
    if (!recognition) return;
    try {
      setDisableRecord(true);
      setIsRecording(true);
      recognition.lang = selectedLang;
      recognition.start();
    } catch (e) {
      console.error("Failed to start recognition", e);
      setDisableRecord(false);
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    try {
      recognition?.stop();
    } catch {}
  };

  const _openRecordModal = () => {
    setIsRecordModalOpen(true);
  };

  const closeRecordModal = () => {
    setIsRecordModalOpen(false);
  };

  const _handleChooseAudioOutput = async () => {
    try {
      const md: any = (navigator as any).mediaDevices;
      if (!md || !md.selectAudioOutput) {
        console.warn("selectAudioOutput() not supported in this browser.");
        return;
      }
      const device: MediaDeviceInfo = await md.selectAudioOutput();
      setAudioOutputDevice(device);
      setPreferredOutputDeviceId(device.deviceId);
      try {
        localStorage.setItem("voice.audioOutputDeviceId", device.deviceId);
      } catch {}
      if (audioRef.current && (audioRef.current as any).setSinkId) {
        try {
          await (audioRef.current as any).setSinkId(device.deviceId);
        } catch (err) {
          console.warn("Failed to set sinkId on audio element", err);
        }
      }
      await refreshOutputDevices();
    } catch (err) {
      console.error("Error selecting audio output:", err);
    }
  };

  const refreshOutputDevices = async () => {
    try {
      if (!navigator?.mediaDevices?.enumerateDevices) return;
      const devices = await navigator.mediaDevices.enumerateDevices();
      const outputs = devices.filter((d) => d.kind === "audiooutput");
      setAudioOutputDevices(outputs);
      if (audioOutputDevice) {
        const stillExists = outputs.find(
          (d) => d.deviceId === audioOutputDevice.deviceId,
        );
        if (!stillExists) setAudioOutputDevice(outputs[0] || null);
      } else if (outputs.length > 0) {
        setAudioOutputDevice(outputs[0]);
      }
    } catch (e) {
      console.warn("Could not enumerate devices", e);
    }
  };

  useEffect(() => {
    if (isRecordModalOpen) {
      void refreshOutputDevices();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecordModalOpen]);

  useEffect(() => {
    const md = navigator?.mediaDevices;
    if (!md) return;
    const handler = () => void refreshOutputDevices();
    md.addEventListener?.("devicechange", handler);
    return () => {
      md.removeEventListener?.("devicechange", handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchCheckpointStatus = async () => {
    try {
      const url = caseid
        ? `/api/checkpoint?caseid=${caseid}`
        : "/api/checkpoint";
      const response = await fetch(url);
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
      // Reset textarea height after sending
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const markdownComponents: Components = {
    h1({ children }) {
      const text = String(React.Children.toArray(children).join(" ")).trim();
      if (!text) return null;
      return (
        <h2 className="text-lg md:text-lg font-bold text-gray-900 dark:text-gray-100 mb-2 mt-3">
          {children}
        </h2>
      );
    },
    h2({ children }) {
      return (
        <h2 className="text-lg md:text-lg font-bold text-gray-900 dark:text-gray-100 mb-2 mt-3">
          {children}
        </h2>
      );
    },
    h3({ children }) {
      return (
        <h3 className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100 mb-2 mt-3">
          {children}
        </h3>
      );
    },
    code({ className, children }) {
      const match = /language-(\w+)/.exec(className || "");
      const isInline = !match;

      return isInline ? (
        <code
          className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-sm font-sans"
          style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
        >
          {children}
        </code>
      ) : (
        <pre
          className="bg-gray-100 dark:bg-gray-800 p-2 rounded text-sm overflow-x-auto font-sans"
          style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
        >
          <code
            className={className}
            style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
          >
            {children}
          </code>
        </pre>
      );
    },
    em({ children }) {
      return (
        <em
          className="italic font-sans"
          style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
        >
          {children}
        </em>
      );
    },
    strong({ children }) {
      return (
        <strong
          className="font-bold font-sans"
          style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
        >
          {children}
        </strong>
      );
    },
    pre({ children }) {
      return (
        <pre
          className="bg-gray-100 dark:bg-gray-800 p-2 rounded text-sm overflow-x-auto font-sans"
          style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
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
      <div className="flex-1 overflow-y-auto p-3 space-y-3 text-sm">
        {filteredMessages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${
              msg.sender === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[85%] p-2.5 rounded-lg text-sm ${
                msg.sender === "user"
                  ? "bg-blue-500 text-white"
                  : msg.isThinking
                  ? "bg-blue-50 dark:bg-blue-900/20 text-gray-900 dark:text-gray-100 border border-blue-200 dark:border-blue-700"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              }`}
            >
              <div
                className="prose prose-sm dark:prose-invert max-w-none font-sans"
                style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
              >
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkBreaks]}
                  components={markdownComponents}
                >
                  {formatContent(msg.content)}
                </ReactMarkdown>
                {msg.isThinking && <BlinkingCursor />}
              </div>
              <div
                className={`text-xs mt-1.5 ${
                  msg.sender === "user"
                    ? "text-blue-100"
                    : "text-gray-500 dark:text-gray-400"
                }`}
              >
                {msg.timestamp.toLocaleTimeString()}
                {!msg.isThinking && typeof msg.durationMs === "number" && (
                  <span className="ml-2">
                    • {formatDuration(msg.durationMs)}
                  </span>
                )}
                {typeof msg.tokenCount === "number" && (
                  <span className="ml-2">
                    • {msg.tokenExact ? "" : "~"}
                    {msg.tokenCount} tokens
                  </span>
                )}
                {msg.isThinking && (
                  <span className="ml-2 flex items-center">
                    <span className="mr-1 text-blue-600 dark:text-blue-400">
                      thinking
                    </span>
                    <TypingIndicator />
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Message input */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-3">
        <div className="flex flex-row items-center gap-2">
          <div className="flex-1 min-w-0">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
              rows={1}
              className="w-full min-h-[40px] max-h-[120px] p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none overflow-y-auto bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 text-sm leading-relaxed transition-all duration-200 ease-in-out"
              disabled={isLoading || isProcessing}
            />
          </div>
          <button
            onClick={() => {
              if (!recognition) return;
              // First time, open config modal
              if (!hasVoiceConfig) {
                setIsRecordModalOpen(true);
                return;
              }
              // Toggle record/stop
              if (isRecording) {
                stopRecording();
              } else {
                startRecording();
              }
            }}
            disabled={isLoading || isProcessing || !recognition}
            className="flex items-center justify-center w-10 h-10 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 ease-in-out"
            title={
              recognition
                ? isRecording
                  ? "Stop recording"
                  : "Start recording"
                : "Speech recognition not supported"
            }
          >
            {isRecording ? (
              <FaStop className="w-4 h-4" />
            ) : (
              <FaMicrophone className="w-4 h-4" />
            )}
          </button>
          {isProcessing ? (
            <button
              onClick={() => onAbort?.()}
              className="flex items-center justify-center px-3 h-10 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-1 transition-all duration-200 ease-in-out"
              title="Stop"
            >
              <FaStop className="w-4 h-4 mr-1" /> Stop
            </button>
          ) : (
            <button
              onClick={handleSendMessage}
              disabled={isLoading || !message.trim()}
              className="flex items-center justify-center w-10 h-10 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 ease-in-out"
              title="Send message"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <FaArrowUp className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      </div>
      {isRecordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={closeRecordModal}
          ></div>
          <div className="relative bg-white dark:bg-gray-900 rounded-lg shadow-lg w-full max-w-md mx-3 p-4 border border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
              Voice input
            </h4>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">
                  Language
                </label>
                <select
                  className="w-full text-sm p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  value={selectedLang}
                  onChange={(e) => setSelectedLang(e.target.value)}
                >
                  <option value="en-US">English (US)</option>
                  <option value="en-GB">English (UK)</option>
                  <option value="es-ES">Español (ES)</option>
                  <option value="fr-FR">Français (FR)</option>
                  <option value="de-DE">Deutsch (DE)</option>
                  <option value="pt-BR">Português (BR)</option>
                  <option value="it-IT">Italiano (IT)</option>
                  <option value="ja-JP">日本語 (JP)</option>
                  <option value="ko-KR">한국어 (KR)</option>
                  <option value="zh-CN">中文 (简体)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">
                  Audio output device
                </label>
                <div className="flex items-center gap-2">
                  <select
                    className="flex-1 text-sm p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    value={
                      audioOutputDevice?.deviceId ||
                      preferredOutputDeviceId ||
                      ""
                    }
                    onChange={async (e) => {
                      const selected = audioOutputDevices.find(
                        (d) => d.deviceId === e.target.value,
                      );
                      setAudioOutputDevice(selected || null);
                      setPreferredOutputDeviceId(selected?.deviceId || null);
                      try {
                        if (selected?.deviceId) {
                          localStorage.setItem(
                            "voice.audioOutputDeviceId",
                            selected.deviceId,
                          );
                        }
                      } catch {}
                      if (
                        selected &&
                        audioRef.current &&
                        (audioRef.current as any).setSinkId
                      ) {
                        try {
                          await (audioRef.current as any).setSinkId(
                            selected.deviceId,
                          );
                        } catch (err) {
                          console.warn("Failed to set sinkId", err);
                        }
                      }
                    }}
                  >
                    <option value="" disabled>
                      {audioOutputDevices.length > 0
                        ? "Choose device"
                        : "No outputs found"}
                    </option>
                    {audioOutputDevices.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label || d.deviceId}
                      </option>
                    ))}
                  </select>
                </div>
                <audio ref={audioRef} className="hidden" />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={closeRecordModal}
                className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  try {
                    localStorage.setItem("voice.lang", selectedLang);
                    if (audioOutputDevice) {
                      localStorage.setItem(
                        "voice.audioOutputDeviceId",
                        audioOutputDevice.deviceId,
                      );
                      setPreferredOutputDeviceId(audioOutputDevice.deviceId);
                    }
                    localStorage.setItem("voice.configured", "true");
                  } catch {}
                  setHasVoiceConfig(true);
                  closeRecordModal();
                  startRecording();
                }}
                disabled={disableRecord || !recognition}
                className="px-3 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {disableRecord ? "Recording…" : "Start Recording"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
