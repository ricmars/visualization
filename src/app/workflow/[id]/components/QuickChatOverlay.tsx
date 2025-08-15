"use client";

import React, { MutableRefObject, RefObject } from "react";
import { FaMagic } from "react-icons/fa";

type Point = { x: number; y: number };

type QuickChatOverlayProps = {
  position: Point;
  selectionSummary: string;
  inputRef:
    | RefObject<HTMLInputElement | null>
    | MutableRefObject<HTMLInputElement | null>;
  value: string;
  onChange: (value: string) => void;
  onEnter: () => void;
  onEscape: () => void;
};

export default function QuickChatOverlay({
  position,
  selectionSummary,
  inputRef,
  value,
  onChange,
  onEnter,
  onEscape,
}: QuickChatOverlayProps) {
  return (
    <div
      className="fixed z-[110]"
      style={{ left: position.x, top: position.y }}
    >
      <div className="w-[360px] rounded-xl shadow-2xl ring-1 ring-purple-400/40 border border-purple-300/60 dark:border-purple-700/60 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm p-3">
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-purple-600 text-white shadow">
            <FaMagic className="w-3.5 h-3.5" />
          </div>
          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {selectionSummary}
          </div>
        </div>
        <div className="mt-1 text-xs text-purple-800 dark:text-purple-300">
          AI quick action — type and press Enter. Esc to close.
        </div>
        <input
          ref={inputRef}
          className="mt-2 w-full rounded-md border border-purple-300/70 dark:border-purple-700/60 bg-white dark:bg-gray-900 px-2 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
          placeholder="Quick edit..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onEnter();
            }
            if (e.key === "Escape") {
              onEscape();
            }
          }}
          autoFocus
        />
      </div>
    </div>
  );
}
