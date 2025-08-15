import React, { useState, useEffect } from "react";
import {
  FaUndo,
  FaClock,
  FaUser,
  FaRobot,
  FaCheck,
  FaTimes,
  FaExclamationTriangle,
} from "react-icons/fa";

interface CheckpointHistoryItem {
  id: string;
  description: string;
  user_command: string;
  status: string;
  source: string;
  created_at: string;
  finished_at: string;
  tools_executed: string[];
  changes_count: number;
}

interface ChangesHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  onRestore?: () => void; // Callback when restoration happens
}

export default function ChangesHistory({
  isOpen,
  onClose,
  onRestore,
}: ChangesHistoryProps) {
  const [history, setHistory] = useState<CheckpointHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen]);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/checkpoint/history");
      const data = await response.json();
      if (data.history) {
        setHistory(data.history);
      }
    } catch (error) {
      console.error("Failed to fetch checkpoint history:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async (checkpointId: string) => {
    if (
      !confirm(
        "Are you sure you want to restore to this checkpoint? This will undo all changes made after this point.",
      )
    ) {
      return;
    }

    setIsRestoring(checkpointId);
    try {
      const response = await fetch("/api/checkpoint?action=restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkpointId }),
      });

      if (response.ok) {
        console.log("Successfully restored to checkpoint");
        if (onRestore) {
          onRestore();
        }
        // Refresh the page to show restored state
        window.location.reload();
      } else {
        console.error("Failed to restore checkpoint");
      }
    } catch (error) {
      console.error("Error restoring checkpoint:", error);
    } finally {
      setIsRestoring(null);
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "historical":
        return "text-green-600 dark:text-green-400";
      case "committed":
        return "text-blue-600 dark:text-blue-400";
      case "rolled_back":
        return "text-red-600 dark:text-red-400";
      default:
        return "text-gray-600 dark:text-gray-400";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "historical":
        return <FaCheck className="w-4 h-4" />;
      case "committed":
        return <FaCheck className="w-4 h-4" />;
      case "rolled_back":
        return <FaTimes className="w-4 h-4" />;
      default:
        return <FaExclamationTriangle className="w-4 h-4" />;
    }
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case "LLM":
        return <FaRobot className="w-4 h-4 text-blue-500" title="LLM Chat" />;
      case "MCP":
        return (
          <FaUser className="w-4 h-4 text-purple-500" title="MCP Interface" />
        );
      default:
        return <FaClock className="w-4 h-4 text-gray-500" title="API" />;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-600">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <FaClock className="text-blue-500" />
            Changes History
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <FaTimes className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <span className="ml-2">Loading history...</span>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No checkpoint history available
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((checkpoint, index) => (
                <div
                  key={checkpoint.id}
                  className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  {/* Checkpoint Header */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      {getSourceIcon(checkpoint.source)}
                      <div>
                        <div className="font-medium text-sm">
                          {checkpoint.description}
                        </div>
                        <div className="text-xs text-gray-500 flex items-center gap-2">
                          <span>{formatDateTime(checkpoint.created_at)}</span>
                          <span
                            className={`flex items-center gap-1 ${getStatusColor(
                              checkpoint.status,
                            )}`}
                          >
                            {getStatusIcon(checkpoint.status)}
                            {checkpoint.status}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Restore Button */}
                    {checkpoint.status === "historical" && (
                      <button
                        onClick={() => handleRestore(checkpoint.id)}
                        disabled={isRestoring === checkpoint.id}
                        className="flex items-center gap-2 px-3 py-1 text-sm bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:hover:bg-blue-800 text-blue-700 dark:text-blue-300 rounded-md disabled:opacity-50"
                      >
                        {isRestoring === checkpoint.id ? (
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-500"></div>
                        ) : (
                          <FaUndo className="w-3 h-3" />
                        )}
                        Restore
                      </button>
                    )}
                  </div>

                  {/* User Command */}
                  {checkpoint.user_command && (
                    <div className="mb-2">
                      <div className="text-xs text-gray-500 mb-1">
                        User Command:
                      </div>
                      <div className="text-sm bg-gray-100 dark:bg-gray-600 rounded p-2 font-mono">
                        {checkpoint.user_command.length > 150
                          ? `${checkpoint.user_command.substring(0, 150)}...`
                          : checkpoint.user_command}
                      </div>
                    </div>
                  )}

                  {/* Tools and Changes Summary */}
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    {checkpoint.tools_executed.length > 0 && (
                      <span>Tools: {checkpoint.tools_executed.join(", ")}</span>
                    )}
                    <span>
                      {checkpoint.changes_count} change
                      {checkpoint.changes_count !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* Timeline Connection */}
                  {index < history.length - 1 && (
                    <div className="flex justify-center mt-4">
                      <div className="w-px h-4 bg-gray-300 dark:bg-gray-600"></div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center p-6 border-t border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Showing {history.length} checkpoint{history.length !== 1 ? "s" : ""}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-md"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
