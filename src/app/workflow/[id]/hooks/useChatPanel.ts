"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type UseChatPanelOptions = {
  minWidth: number;
  maxWidth: number;
  widthStorageKey: string;
  expandedStorageKey: string;
  initialWidth?: number;
  initialExpanded?: boolean;
};

export function useChatPanel({
  minWidth,
  maxWidth,
  widthStorageKey,
  expandedStorageKey,
  initialWidth = 500,
  initialExpanded = true,
}: UseChatPanelOptions) {
  const [chatPanelWidth, setChatPanelWidth] = useState(initialWidth);
  const [isChatPanelExpanded, setIsChatPanelExpanded] =
    useState(initialExpanded);

  const isResizingRef = useRef(false);
  const resizeStartXRef = useRef(0);
  const resizeStartWidthRef = useRef(0);
  const lastExpandedWidthRef = useRef<number>(initialWidth);

  // Load persisted settings on mount
  useEffect(() => {
    try {
      const savedWidthRaw = localStorage.getItem(widthStorageKey);
      const savedExpandedRaw = localStorage.getItem(expandedStorageKey);
      if (savedWidthRaw) {
        const parsed = parseInt(savedWidthRaw, 10);
        if (!Number.isNaN(parsed)) {
          const clamped = Math.min(Math.max(parsed, minWidth), maxWidth);
          setChatPanelWidth(clamped);
          lastExpandedWidthRef.current = clamped;
        }
      }
      if (savedExpandedRaw !== null) {
        setIsChatPanelExpanded(savedExpandedRaw === "true");
      }
    } catch {
      // ignore
    }
  }, [widthStorageKey, expandedStorageKey, minWidth, maxWidth]);

  // Persist on change
  useEffect(() => {
    try {
      localStorage.setItem(widthStorageKey, String(chatPanelWidth));
    } catch {}
  }, [widthStorageKey, chatPanelWidth]);
  useEffect(() => {
    try {
      localStorage.setItem(expandedStorageKey, String(isChatPanelExpanded));
    } catch {}
  }, [expandedStorageKey, isChatPanelExpanded]);

  const handleToggleChatPanel = useCallback(() => {
    if (isChatPanelExpanded) {
      lastExpandedWidthRef.current = chatPanelWidth;
      setIsChatPanelExpanded(false);
    } else {
      const restore = lastExpandedWidthRef.current || minWidth;
      setChatPanelWidth(Math.min(Math.max(restore, minWidth), maxWidth));
      setIsChatPanelExpanded(true);
    }
  }, [isChatPanelExpanded, chatPanelWidth, minWidth, maxWidth]);

  const onResizeMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      isResizingRef.current = true;
      resizeStartXRef.current = e.clientX;
      resizeStartWidthRef.current = chatPanelWidth;
      document.body.style.userSelect = "none";
    },
    [chatPanelWidth],
  );

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      const dx = e.clientX - resizeStartXRef.current;
      const nextWidth = resizeStartWidthRef.current - dx;
      const clamped = Math.min(Math.max(nextWidth, minWidth), maxWidth);
      setChatPanelWidth(clamped);
      lastExpandedWidthRef.current = clamped;
      if (!isChatPanelExpanded) {
        setIsChatPanelExpanded(true);
      }
    };
    const onMouseUp = () => {
      if (isResizingRef.current) {
        isResizingRef.current = false;
        document.body.style.userSelect = "";
      }
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [
    setChatPanelWidth,
    setIsChatPanelExpanded,
    isChatPanelExpanded,
    minWidth,
    maxWidth,
  ]);

  return {
    chatPanelWidth,
    isChatPanelExpanded,
    setChatPanelWidth,
    setIsChatPanelExpanded,
    onResizeMouseDown,
    handleToggleChatPanel,
    minWidth,
    maxWidth,
  } as const;
}
