"use client";

import React from "react";

type ChatPanelTabsProps = {
  active: "chat" | "history";
  onChange: (tab: "chat" | "history") => void;
};

export default function ChatPanelTabs({
  active,
  onChange,
}: ChatPanelTabsProps) {
  return (
    <div className="border-b border-gray-200 dark:border-gray-700">
      <div className="flex">
        <button
          onClick={() => onChange("chat")}
          className={`flex-1 px-4 py-2 text-sm font-medium ${
            active === "chat"
              ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
          }`}
        >
          Chat
        </button>
        <button
          onClick={() => onChange("history")}
          className={`flex-1 px-4 py-2 text-sm font-medium ${
            active === "history"
              ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
          }`}
        >
          History
        </button>
      </div>
    </div>
  );
}
