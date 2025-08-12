"use client";

import React from "react";

export type WorkflowMainTab = "workflow" | "fields" | "views";

type WorkflowTabsProps = {
  active: WorkflowMainTab;
  onChange: (tab: WorkflowMainTab) => void;
};

export default function WorkflowTabs({ active, onChange }: WorkflowTabsProps) {
  return (
    <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-700">
      <div className="flex">
        <button
          onClick={() => onChange("workflow")}
          className={`px-4 py-2 text-sm font-medium ${
            active === "workflow"
              ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
          }`}
        >
          Workflow
        </button>
        <button
          onClick={() => onChange("fields")}
          className={`px-4 py-2 text-sm font-medium ${
            active === "fields"
              ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
          }`}
        >
          Fields
        </button>
        <button
          onClick={() => onChange("views")}
          className={`px-4 py-2 text-sm font-medium ${
            active === "views"
              ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
          }`}
        >
          Views
        </button>
      </div>
    </div>
  );
}
