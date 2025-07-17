import React, { useState, useEffect } from "react";
import {
  FaUndo,
  FaClock,
  FaUser,
  FaRobot,
  FaCheck,
  FaTimes,
  FaExclamationTriangle,
  FaTrash,
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

interface ChangesPanelProps {
  caseid?: number;
  onRefresh?: () => void; // Callback when restoration happens
}

export default function ChangesPanel({ caseid, onRefresh }: ChangesPanelProps) {
  const [history, setHistory] = useState<CheckpointHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isDeletingAll, setIsDeletingAll] = useState(false);

  useEffect(() => {
    fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const url = caseid
        ? `/api/checkpoint/history?caseid=${caseid}`
        : "/api/checkpoint/history";
      const response = await fetch(url);
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
        if (onRefresh) {
          onRefresh();
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

  const handleDelete = async (checkpointId: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this checkpoint? This action cannot be undone.",
      )
    ) {
      return;
    }

    setIsDeleting(checkpointId);
    try {
      const response = await fetch("/api/checkpoint?action=delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkpointId }),
      });

      if (response.ok) {
        console.log("Successfully deleted checkpoint");
        // Refresh the history list
        await fetchHistory();
        if (onRefresh) {
          onRefresh();
        }
      } else {
        console.error("Failed to delete checkpoint");
      }
    } catch (error) {
      console.error("Error deleting checkpoint:", error);
    } finally {
      setIsDeleting(null);
    }
  };

  const handleDeleteAll = async () => {
    if (
      !confirm(
        "Are you sure you want to delete ALL checkpoints? This action cannot be undone.",
      )
    ) {
      return;
    }

    setIsDeletingAll(true);
    try {
      const response = await fetch("/api/checkpoint?action=deleteAll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (response.ok) {
        console.log("Successfully deleted all checkpoints");
        // Refresh the history list
        await fetchHistory();
        if (onRefresh) {
          onRefresh();
        }
      } else {
        console.error("Failed to delete all checkpoints");
      }
    } catch (error) {
      console.error("Error deleting all checkpoints:", error);
    } finally {
      setIsDeletingAll(false);
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

  return (
    <div className="p-6 h-full overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <FaClock className="text-blue-500" />
          History
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchHistory}
            className="px-3 py-1 text-sm text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg ring-1 ring-gray-200 dark:ring-gray-700 hover:ring-blue-200 dark:hover:ring-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-500 active:bg-blue-50 dark:active:bg-blue-900/20 transition-colors"
          >
            Refresh
          </button>
          {history.length > 0 && (
            <button
              onClick={handleDeleteAll}
              disabled={isDeletingAll}
              className="flex items-center gap-1 px-3 py-1 text-sm text-gray-600 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 rounded-lg ring-1 ring-gray-200 dark:ring-gray-700 hover:ring-red-200 dark:hover:ring-red-800 focus:outline-none focus:ring-2 focus:ring-red-500 dark:focus:ring-red-500 active:bg-red-50 dark:active:bg-red-900/20 transition-colors disabled:opacity-50"
            >
              {isDeletingAll ? (
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-red-500"></div>
              ) : (
                <FaTrash className="w-3 h-3" />
              )}
              Delete All
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
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

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2">
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
                    <button
                      onClick={() => handleDelete(checkpoint.id)}
                      disabled={isDeleting === checkpoint.id}
                      className="flex items-center gap-2 px-3 py-1 text-sm bg-red-100 hover:bg-red-200 dark:bg-red-900 dark:hover:bg-red-800 text-red-700 dark:text-red-300 rounded-md disabled:opacity-50"
                    >
                      {isDeleting === checkpoint.id ? (
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-red-500"></div>
                      ) : (
                        <FaTrash className="w-3 h-3" />
                      )}
                      Delete
                    </button>
                  </div>
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
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Showing {history.length} checkpoint{history.length !== 1 ? "s" : ""}
        </div>
      </div>
    </div>
  );
}
