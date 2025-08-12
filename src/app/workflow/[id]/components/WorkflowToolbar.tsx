"use client";

import React from "react";

type WorkflowToolbarProps = {
  workflowView: "flat" | "lifecycle";
  onSetView: (view: "flat" | "lifecycle") => void;
  onAddStage: () => void;
};

export default function WorkflowToolbar({
  workflowView,
  onSetView,
  onAddStage,
}: WorkflowToolbarProps) {
  return (
    <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-4">
        <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => onSetView("flat")}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              workflowView === "flat"
                ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            Flat View
          </button>
          <button
            onClick={() => onSetView("lifecycle")}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              workflowView === "lifecycle"
                ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            Lifecycle View
          </button>
        </div>
      </div>
      <button
        onClick={onAddStage}
        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
      >
        Add Stage
      </button>
    </div>
  );
}
