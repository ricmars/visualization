"use client";

import { useCallback, useState } from "react";

type Point = { x: number; y: number } | null;
type Rect = { x: number; y: number; width: number; height: number } | null;

export type FreeFormSelectionState = {
  isFreeFormSelecting: boolean;
  selectionRect: Rect;
  selectedFieldIds: number[];
  selectedViewIds: number[];
  selectedStageIds: number[];
  selectedProcessIds: number[];
  selectedStepIds: number[];
  quickOverlayPosition: { x: number; y: number } | null;
};

type UseFreeFormSelectionArgs = {
  activeTab: "workflow" | "fields" | "views" | "chat" | "history";
  selectedView: string | null;
  onOpenQuickChat: () => void;
  resolveExternalFieldIds?: (rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => Promise<number[]>;
  resolveExternalIds?: (rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => Promise<{ fieldIds: number[]; viewIds: number[] }>;
};

export function useFreeFormSelection({
  activeTab,
  selectedView,
  onOpenQuickChat,
  resolveExternalFieldIds,
  resolveExternalIds,
}: UseFreeFormSelectionArgs) {
  const [isFreeFormSelecting, setIsFreeFormSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<Point>(null);
  const [selectionRect, setSelectionRect] = useState<Rect>(null);
  const [selectedFieldIds, setSelectedFieldIds] = useState<number[]>([]);
  const [selectedViewIds, setSelectedViewIds] = useState<number[]>([]);
  const [selectedStageIds, setSelectedStageIds] = useState<number[]>([]);
  const [selectedProcessIds, setSelectedProcessIds] = useState<number[]>([]);
  const [selectedStepIds, setSelectedStepIds] = useState<number[]>([]);
  const [quickOverlayPosition, setQuickOverlayPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const beginFreeFormSelection = useCallback(() => {
    setSelectedFieldIds([]);
    setSelectedViewIds([]);
    setSelectedStageIds([]);
    setSelectedProcessIds([]);
    setSelectionStart(null);
    setSelectionRect(null);
    setIsFreeFormSelecting(true);
  }, []);

  const onSelectionMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      setSelectionStart({ x: e.clientX, y: e.clientY });
      setSelectionRect({ x: e.clientX, y: e.clientY, width: 0, height: 0 });
    },
    [],
  );

  const onSelectionMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!selectionStart) return;
      const x1 = Math.min(selectionStart.x, e.clientX);
      const y1 = Math.min(selectionStart.y, e.clientY);
      const x2 = Math.max(selectionStart.x, e.clientX);
      const y2 = Math.max(selectionStart.y, e.clientY);
      setSelectionRect({ x: x1, y: y1, width: x2 - x1, height: y2 - y1 });
    },
    [selectionStart],
  );

  const rectsIntersect = (
    a: { x: number; y: number; width: number; height: number },
    b: { x: number; y: number; width: number; height: number },
  ) => {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
  };

  const onSelectionMouseUp = useCallback(async () => {
    if (!selectionRect) {
      setIsFreeFormSelecting(false);
      return;
    }
    // Collect roots: document + open shadow roots (Lifecycle renders in Shadow DOM)
    const collectShadowRoots = (root: Node): ShadowRoot[] => {
      const found: ShadowRoot[] = [];
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
      let current = walker.nextNode();
      while (current) {
        const asEl = current as Element;
        const sr = (asEl as any).shadowRoot as ShadowRoot | undefined;
        if (sr) {
          found.push(sr);
          found.push(...collectShadowRoots(sr));
        }
        current = walker.nextNode();
      }
      return found;
    };

    const roots: Array<Document | ShadowRoot> = [
      document,
      ...collectShadowRoots(document.documentElement),
    ];

    const selectors =
      "[data-fieldid], [data-viewid], [data-stageid], [data-processid], [data-stepid], [data-testid$=':stage:'], [data-testid$=':process:'], [data-testid$=':step:']";

    // If any container explicitly opts-in to freeform selection (e.g. a modal
    // with data-allow-freeform-select="true"), then we should restrict the
    // selection to only elements inside those containers. This ensures that
    // when a modal is open with a backdrop, background elements are NOT
    // selectable by the quick action tool.
    const allowContainers = roots.flatMap((r) =>
      Array.from(
        (r as Document | ShadowRoot).querySelectorAll(
          '[data-allow-freeform-select="true"]',
        ),
      ),
    );

    const nodes = roots
      .flatMap((r) =>
        Array.from(
          (r as Document | ShadowRoot).querySelectorAll<HTMLElement>(selectors),
        ),
      )
      .filter((el) => {
        if (allowContainers.length > 0) {
          // Only allow if the element is within one of the allowed containers
          return allowContainers.some((container) => container.contains(el));
        }

        // Otherwise (no explicit allowed containers), exclude elements that are
        // inside modal portals or overlays so regular page content can be
        // selected while ignoring modal internals.
        const modalPortal = el.closest('[data-modal-portal="true"]');
        const modalOverlay = el.closest(
          '.modal-overlay, [class*="z-40"], [class*="z-50"], [class*="z-60"]',
        );
        const withinModal = el.closest(
          '[role="dialog"], .modal, [class*="backdrop-blur"]',
        );
        return !modalPortal && !modalOverlay && !withinModal;
      });
    const pickedFieldIds = new Set<number>();
    const pickedViewIds = new Set<number>();
    const pickedStageIds = new Set<number>();
    const pickedProcessIds = new Set<number>();
    const pickedStepIds = new Set<number>();
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    nodes.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const r = {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
      };
      if (rectsIntersect(selectionRect, r)) {
        const idStr = (el as any).dataset.fieldid;
        const idNum = idStr ? parseInt(idStr, 10) : NaN;
        if (!Number.isNaN(idNum)) pickedFieldIds.add(idNum);
        const vStr = (el as any).dataset.viewid;
        const vNum = vStr ? parseInt(vStr, 10) : NaN;
        if (!Number.isNaN(vNum)) pickedViewIds.add(vNum);
        const sStr = (el as any).dataset.stageid;
        const sNum = sStr ? parseInt(sStr, 10) : NaN;
        if (!Number.isNaN(sNum)) pickedStageIds.add(sNum);
        const pStr = (el as any).dataset.processid;
        const pNum = pStr ? parseInt(pStr, 10) : NaN;
        if (!Number.isNaN(pNum)) pickedProcessIds.add(pNum);
        const stpStr = (el as any).dataset.stepid;
        const stpNum = stpStr ? parseInt(stpStr, 10) : NaN;
        if (!Number.isNaN(stpNum)) pickedStepIds.add(stpNum);

        // Lifecycle data-testid fallback: intake:stage:, foo_bar:process:, baz:step:
        const testId = (el as HTMLElement).getAttribute("data-testid") || "";
        if (
          testId.endsWith(":stage:") ||
          testId.endsWith(":process:") ||
          testId.endsWith(":step:")
        ) {
          const containerWithId = (el as HTMLElement).closest(
            "[id],[data-id]",
          ) as HTMLElement | null;
          const idAttr =
            containerWithId?.getAttribute("id") ||
            containerWithId?.getAttribute("data-id") ||
            "";
          const numericId = parseInt(idAttr, 10);
          if (Number.isFinite(numericId)) {
            if (testId.endsWith(":stage:")) {
              pickedStageIds.add(numericId);
            } else if (testId.endsWith(":process:")) {
              pickedProcessIds.add(numericId);
            } else if (testId.endsWith(":step:")) {
              pickedStepIds.add(numericId);
            }
          }
        }
        minX = Math.min(minX, r.x);
        minY = Math.min(minY, r.y);
        maxX = Math.max(maxX, r.x + r.width);
        maxY = Math.max(maxY, r.y + r.height);
      }
    });
    // If an external resolver is provided (e.g., live preview iframe), query it too
    if (typeof resolveExternalIds === "function") {
      try {
        const ext = await resolveExternalIds({
          x: selectionRect.x,
          y: selectionRect.y,
          width: selectionRect.width,
          height: selectionRect.height,
        });
        const extFieldIds = Array.isArray(ext?.fieldIds) ? ext.fieldIds : [];
        const extViewIds = Array.isArray(ext?.viewIds) ? ext.viewIds : [];
        for (const fid of extFieldIds) {
          if (Number.isFinite(fid)) pickedFieldIds.add(fid as number);
        }
        for (const vid of extViewIds) {
          if (Number.isFinite(vid)) pickedViewIds.add(vid as number);
        }
      } catch {}
    } else if (typeof resolveExternalFieldIds === "function") {
      // Backward-compat: older API that only returns field IDs
      try {
        const extIds = await resolveExternalFieldIds({
          x: selectionRect.x,
          y: selectionRect.y,
          width: selectionRect.width,
          height: selectionRect.height,
        });
        for (const fid of Array.isArray(extIds) ? extIds : []) {
          if (Number.isFinite(fid)) pickedFieldIds.add(fid as number);
        }
      } catch {}
    }
    const ids = Array.from(pickedFieldIds.values());
    const vIds = Array.from(pickedViewIds.values());
    const stIds = Array.from(pickedStageIds.values());
    const prIds = Array.from(pickedProcessIds.values());
    const stepIds = Array.from(pickedStepIds.values());

    let augmentedVIds = vIds;
    if (activeTab === "views" && selectedView) {
      let currentViewId: number | null = null;
      if (selectedView.startsWith("db-")) {
        const parsed = parseInt(selectedView.substring(3), 10);
        if (!Number.isNaN(parsed)) currentViewId = parsed;
      } else {
        const parsed = parseInt(selectedView, 10);
        if (!Number.isNaN(parsed)) currentViewId = parsed;
      }
      if (currentViewId !== null && !augmentedVIds.includes(currentViewId)) {
        augmentedVIds = [...augmentedVIds, currentViewId];
      }
    }
    setSelectedFieldIds(ids);
    setSelectedViewIds(augmentedVIds);
    setSelectedStageIds(stIds);
    setSelectedProcessIds(prIds);
    setSelectedStepIds(stepIds);

    let overlayX = selectionRect.x + selectionRect.width + 8;
    let overlayY = selectionRect.y - 8;
    if (
      (ids.length > 0 ||
        vIds.length > 0 ||
        stIds.length > 0 ||
        prIds.length > 0 ||
        stepIds.length > 0) &&
      isFinite(minX) &&
      isFinite(minY) &&
      isFinite(maxX)
    ) {
      overlayX = maxX + 8;
      overlayY = minY - 8;
    }
    const assumedWidth = 320;
    const margin = 8;
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    if (overlayX + assumedWidth > viewportW - margin) {
      const leftCandidate =
        ids.length > 0 && isFinite(minX)
          ? minX - assumedWidth - 8
          : selectionRect.x - assumedWidth - 8;
      overlayX = Math.max(margin, leftCandidate);
    }
    overlayY = Math.max(margin, Math.min(overlayY, viewportH - margin - 120));
    setQuickOverlayPosition({ x: overlayX, y: overlayY });
    setIsFreeFormSelecting(false);
    setSelectionStart(null);
    setSelectionRect(null);
    onOpenQuickChat();
  }, [
    activeTab,
    selectedView,
    selectionRect,
    onOpenQuickChat,
    resolveExternalFieldIds,
    resolveExternalIds,
  ]);

  return {
    isFreeFormSelecting,
    selectionRect,
    selectedFieldIds,
    selectedViewIds,
    selectedStageIds,
    selectedProcessIds,
    selectedStepIds,
    quickOverlayPosition,
    beginFreeFormSelection,
    onSelectionMouseDown,
    onSelectionMouseMove,
    onSelectionMouseUp,
  } as const;
}
