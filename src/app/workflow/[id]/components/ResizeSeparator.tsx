"use client";

import React from "react";
import { FaChevronLeft, FaChevronRight, FaGripVertical } from "react-icons/fa";

type ResizeSeparatorProps = {
  onMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  onToggle: (e: React.MouseEvent<HTMLButtonElement>) => void;
  isExpanded: boolean;
};

export default function ResizeSeparator({
  onMouseDown,
  onToggle,
  isExpanded,
}: ResizeSeparatorProps) {
  return (
    <div
      className="relative w-[6px] bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 cursor-col-resize"
      onMouseDown={onMouseDown}
      aria-label="Resize chat panel"
      title="Drag to resize"
    >
      <button
        type="button"
        onClick={onToggle}
        className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 h-7 w-7 rounded-full bg-white dark:bg-gray-900 shadow ring-1 ring-gray-300 dark:ring-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
        aria-label={isExpanded ? "Collapse chat panel" : "Expand chat panel"}
        title={isExpanded ? "Collapse" : "Expand"}
      >
        {isExpanded ? (
          <FaChevronRight className="h-4 w-4" />
        ) : (
          <FaChevronLeft className="h-4 w-4" />
        )}
      </button>
      <div className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 text-gray-400 dark:text-gray-500 pointer-events-none">
        <FaGripVertical className="h-3 w-3" />
      </div>
    </div>
  );
}
