"use client";

import React from "react";

type SelectionRect = {
  x: number;
  y: number;
  width: number;
  height: number;
} | null;

type FreeFormSelectionOverlayProps = {
  selectionRect: SelectionRect;
  onMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseMove: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseUp: (e: React.MouseEvent<HTMLDivElement>) => void;
};

export default function FreeFormSelectionOverlay({
  selectionRect,
  onMouseDown,
  onMouseMove,
  onMouseUp,
}: FreeFormSelectionOverlayProps) {
  return (
    <div
      className="fixed inset-0 z-[120] cursor-crosshair"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
    >
      {/* Dim background to indicate selection mode */}
      <div className="absolute inset-0 bg-black/10 dark:bg-white/10 pointer-events-none" />
      {selectionRect && (
        <div
          className="absolute border-2 border-blue-500 bg-blue-500/10"
          style={{
            left: selectionRect.x,
            top: selectionRect.y,
            width: selectionRect.width,
            height: selectionRect.height,
          }}
        />
      )}
    </div>
  );
}
