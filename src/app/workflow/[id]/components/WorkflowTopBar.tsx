"use client";

import React from "react";
import Link from "next/link";
import { FaPencilAlt } from "react-icons/fa";

type WorkflowTopBarProps = {
  selectedCaseName?: string;
  canEdit: boolean;
  onEditWorkflow: () => void;
  isPreviewMode: boolean;
  onTogglePreview: () => void;
};

export default function WorkflowTopBar({
  selectedCaseName,
  canEdit,
  onEditWorkflow,
  isPreviewMode,
  onTogglePreview,
}: WorkflowTopBarProps) {
  return (
    <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center">
        <Link
          href="/"
          className="flex items-center mr-4 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
        >
          <svg
            className="w-5 h-5 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          Back
        </Link>
        <div className="flex items-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            {selectedCaseName || "Loading..."}
          </h1>
          {canEdit && (
            <button
              onClick={onEditWorkflow}
              className="ml-3 p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              aria-label="Edit workflow"
            >
              <FaPencilAlt className="w-4 h-4 text-gray-500" />
            </button>
          )}
        </div>
      </div>

      <label className="flex items-center cursor-pointer group">
        <div className="relative">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={isPreviewMode}
            onChange={onTogglePreview}
          />
          <div className="block bg-gray-200 dark:bg-gray-700 w-14 h-8 rounded-full transition-colors duration-200 ease-in-out peer-checked:bg-blue-600 dark:peer-checked:bg-blue-500 group-hover:bg-gray-300 dark:group-hover:bg-gray-600 peer-checked:group-hover:bg-blue-700 dark:peer-checked:group-hover:bg-blue-600 peer-focus:ring-2 peer-focus:ring-blue-500 peer-focus:ring-offset-2 dark:peer-focus:ring-offset-gray-900"></div>
          <div
            className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-all duration-200 ease-in-out shadow-sm peer-checked:translate-x-6 peer-checked:bg-white group-hover:scale-95`}
          ></div>
        </div>
        <div
          className={`ml-3 text-sm font-medium transition-colors duration-200 ${
            isPreviewMode
              ? "text-blue-600 dark:text-blue-400"
              : "text-gray-700 dark:text-gray-300"
          }`}
        >
          Preview
        </div>
      </label>
    </div>
  );
}
