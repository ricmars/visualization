"use client";

import React from "react";
import { FaMagic } from "react-icons/fa";

type ChatPanelHeaderProps = {
  onQuickAction: () => void;
  onClearChat: () => void;
};

export default function ChatPanelHeader({
  onQuickAction,
  onClearChat,
}: ChatPanelHeaderProps) {
  return (
    <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
      <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
        Chat
      </h3>
      <div className="flex items-center gap-2">
        <button
          onClick={onQuickAction}
          className="flex items-center gap-1 px-3 py-1 text-xs rounded-lg border bg-purple-50 border-purple-300 text-purple-700 hover:bg-purple-100 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-purple-900/20 dark:border-purple-700 dark:text-purple-300"
          title="AI quick action"
        >
          <FaMagic className="w-3.5 h-3.5" />
          AI quick action
        </button>
        <button
          onClick={onClearChat}
          className="px-3 py-1 text-xs text-gray-600 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-red-200 dark:hover:border-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 active:bg-red-50 dark:active:bg-red-900/20 transition-all duration-200 ease-in-out bg-white dark:bg-gray-900"
          title="Clear chat history"
        >
          Clear All
        </button>
      </div>
    </div>
  );
}
