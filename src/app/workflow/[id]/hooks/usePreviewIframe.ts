"use client";

import { useEffect, useRef } from "react";

type GenerateModel = () => any;

type UsePreviewIframeArgs = {
  isPreviewMode: boolean;
  // Named as *Action to satisfy Next/React client component lint about functions in props
  generateModelAction: GenerateModel;
};

export default function usePreviewIframe({
  isPreviewMode,
  generateModelAction,
}: UsePreviewIframeArgs) {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const generateModelRef = useRef<GenerateModel>(generateModelAction);
  const PREVIEW_ORIGIN = "https://blueprint2024-8b147.web.app";
  //const PREVIEW_ORIGIN = "https://127.0.0.1:5173";
  const lastPostAtRef = useRef<number>(0);
  const postCountRef = useRef<number>(0);
  const previewReadyRef = useRef<boolean>(false);
  const _lastReloadAtRef = useRef<number>(0);
  const _reloadInFlightRef = useRef<boolean>(false);
  // No burst dedupe; updates are cheap and deterministic now
  const hasSentInitialRef = useRef<boolean>(false);
  const lastQueuedUpdateRef = useRef<any | null>(null);
  const postQueuedRef = useRef<boolean>(false);
  // Pending selection requests keyed by requestId
  const selectionRequestIdRef = useRef<number>(1);
  const pendingSelectionRequestsRef = useRef(
    new Map<
      number,
      {
        // Resolve only fields (legacy callers)
        resolveFields?: (ids: number[]) => void;
        // Resolve fields and views (new API)
        resolveCombined?: (result: {
          fieldIds: number[];
          viewIds: number[];
        }) => void;
        timeoutId: ReturnType<typeof setTimeout> | null;
      }
    >(),
  );

  // Always keep the latest generateModel without retriggering effects
  useEffect(() => {
    generateModelRef.current = generateModelAction;
  }, [generateModelAction]);

  // Soft reload no longer used (handshake-driven init). Keep for future fallback if needed.
  const _softReloadIframe = () => {};

  // Send model updates when the model is updated
  useEffect(() => {
    const handleModelUpdate = () => {
      console.debug("[preview] model-updated event received (isPreviewMode)", {
        isPreviewMode,
      });
      if (!isPreviewMode) return;
      const now = Date.now();
      if (now - lastPostAtRef.current < 100) return;
      if (postQueuedRef.current) return; // Coalesce multiple events before next frame
      postQueuedRef.current = true;
      const post = () => {
        const iframe =
          iframeRef.current || containerRef.current?.querySelector("iframe");
        if (!iframe) {
          console.debug("[preview] No iframe found to post model update");
          postQueuedRef.current = false;
          return;
        }
        iframeRef.current = iframe;
        const fullModel = generateModelRef.current();
        const updatePayload = { caseTypes: fullModel?.caseTypes };
        console.debug(
          "[preview] Posting model update to iframe",
          updatePayload,
        );
        lastPostAtRef.current = Date.now();
        postCountRef.current += 1;
        if (previewReadyRef.current && hasSentInitialRef.current) {
          iframe.contentWindow?.postMessage(updatePayload, PREVIEW_ORIGIN);
        } else {
          lastQueuedUpdateRef.current = updatePayload;
        }
        postQueuedRef.current = false;
        // No gating; allow immediate subsequent updates
      };
      // Defer to next paint to ensure model state has committed and iframe is ready
      // Single RAF is sufficient; avoid double-queuing which can duplicate
      try {
        requestAnimationFrame(post);
      } catch {
        post();
      }
    };

    window.addEventListener("model-updated", handleModelUpdate as any);
    return () => {
      window.removeEventListener("model-updated", handleModelUpdate as any);
    };
  }, [isPreviewMode]);

  // Manage iframe creation and cleanup
  useEffect(() => {
    const container = containerRef.current;
    if (isPreviewMode && container) {
      let iframe = container.querySelector(
        "iframe",
      ) as HTMLIFrameElement | null;
      if (!iframe) {
        iframe = document.createElement("iframe");
        iframe.src = `${PREVIEW_ORIGIN}/blueprint-preview.html`;
        iframe.className = "w-full h-full border-0";
        iframe.title = "Blueprint Preview";
        // Reset flags; wait for explicit 'blueprint-preview-ready'
        previewReadyRef.current = false;
        hasSentInitialRef.current = false;
        lastQueuedUpdateRef.current = null;
        container.appendChild(iframe);
      }
      iframeRef.current = iframe;
    }
    return () => {
      // Only remove iframe when leaving preview mode or unmounting
      if (!isPreviewMode && container && iframeRef.current) {
        try {
          container.removeChild(iframeRef.current);
        } catch {}
        iframeRef.current = null;
      }
    };
  }, [isPreviewMode]);

  // Listen for messages from the preview for debugging/handshake
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== PREVIEW_ORIGIN) return;
      try {
        console.debug("[preview] Received message from iframe", event.data);
      } catch {}
      try {
        const data =
          typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (data && data.type === "blueprint-preview-ready") {
          previewReadyRef.current = true;
          console.debug("[preview] Handshake acknowledged by iframe", data);
          if (!hasSentInitialRef.current) {
            const initialModel = generateModelRef.current();
            try {
              (initialModel as any).fullUpdate = true;
            } catch {}
            console.debug(
              "[preview] Posting initial model to iframe",
              initialModel,
            );
            iframeRef.current?.contentWindow?.postMessage(
              initialModel,
              PREVIEW_ORIGIN,
            );
            hasSentInitialRef.current = true;
          }
          if (lastQueuedUpdateRef.current) {
            iframeRef.current?.contentWindow?.postMessage(
              lastQueuedUpdateRef.current,
              PREVIEW_ORIGIN,
            );
            lastQueuedUpdateRef.current = null;
          }
        }
        // If the iframe explicitly requests the model/update, respond immediately
        if (data && data.type === "request-model") {
          const iframe =
            iframeRef.current ||
            (containerRef.current?.querySelector(
              "iframe",
            ) as HTMLIFrameElement | null);
          if (iframe) {
            const model = generateModelRef.current();
            const payload = hasSentInitialRef.current
              ? { caseTypes: model?.caseTypes }
              : { ...model, fullUpdate: true };
            iframe.contentWindow?.postMessage(payload, PREVIEW_ORIGIN);
            console.debug("[preview] Responded to model request from iframe");
          }
        }
        // Selection response from preview: { type: 'blueprint-selected-fields', requestId, fieldIds, viewIds? }
        if (
          data &&
          (data.type === "blueprint-selected-fields" ||
            data.type === "selected-fields")
        ) {
          const reqId = Number(data.requestId);
          const pending = pendingSelectionRequestsRef.current.get(reqId);
          if (pending) {
            pendingSelectionRequestsRef.current.delete(reqId);
            if (pending.timeoutId) clearTimeout(pending.timeoutId);
            const rawFieldIds = Array.isArray(data.fieldIds)
              ? data.fieldIds
              : [];
            const numericFieldIds: number[] = [];
            for (const it of rawFieldIds) {
              const n = typeof it === "number" ? it : parseInt(String(it), 10);
              if (Number.isFinite(n)) numericFieldIds.push(n);
            }
            const rawViewIds = Array.isArray(data.viewIds) ? data.viewIds : [];
            const numericViewIds: number[] = [];
            for (const it of rawViewIds) {
              const n = typeof it === "number" ? it : parseInt(String(it), 10);
              if (Number.isFinite(n)) numericViewIds.push(n);
            }
            try {
              if (pending.resolveFields) pending.resolveFields(numericFieldIds);
              if (pending.resolveCombined)
                pending.resolveCombined({
                  fieldIds: numericFieldIds,
                  viewIds: numericViewIds,
                });
            } catch {}
          }
        }
      } catch {}
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const requestSelectedFieldIdsInRect = (rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  }): Promise<number[]> => {
    try {
      const iframe =
        iframeRef.current ||
        (containerRef.current?.querySelector(
          "iframe",
        ) as HTMLIFrameElement | null);
      if (!isPreviewMode || !iframe || !previewReadyRef.current) {
        return Promise.resolve([]);
      }
      // Convert screen-space rect to iframe client-space rect
      const iframeRect = iframe.getBoundingClientRect();
      const relativeRect = {
        x: rect.x - iframeRect.left,
        y: rect.y - iframeRect.top,
        width: rect.width,
        height: rect.height,
      };
      const requestId = selectionRequestIdRef.current++;
      const payload = {
        type: "blueprint-request-selected-fields",
        requestId,
        rect: relativeRect,
      };
      return new Promise<number[]>((resolve) => {
        const timeoutId = setTimeout(() => {
          // Resolve empty on timeout to avoid blocking UX
          pendingSelectionRequestsRef.current.delete(requestId);
          resolve([]);
        }, 500);
        pendingSelectionRequestsRef.current.set(requestId, {
          resolveFields: resolve,
          timeoutId,
        });
        try {
          iframe.contentWindow?.postMessage(payload, PREVIEW_ORIGIN);
        } catch {
          clearTimeout(timeoutId);
          pendingSelectionRequestsRef.current.delete(requestId);
          resolve([]);
        }
      });
    } catch {
      return Promise.resolve([]);
    }
  };

  const requestSelectedIdsInRect = (rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  }): Promise<{ fieldIds: number[]; viewIds: number[] }> => {
    try {
      const iframe =
        iframeRef.current ||
        (containerRef.current?.querySelector(
          "iframe",
        ) as HTMLIFrameElement | null);
      if (!isPreviewMode || !iframe || !previewReadyRef.current) {
        return Promise.resolve({ fieldIds: [], viewIds: [] });
      }
      // Convert screen-space rect to iframe client-space rect
      const iframeRect = iframe.getBoundingClientRect();
      const relativeRect = {
        x: rect.x - iframeRect.left,
        y: rect.y - iframeRect.top,
        width: rect.width,
        height: rect.height,
      };
      const requestId = selectionRequestIdRef.current++;
      const payload = {
        type: "blueprint-request-selected-fields",
        requestId,
        rect: relativeRect,
      };
      return new Promise<{ fieldIds: number[]; viewIds: number[] }>(
        (resolve) => {
          const timeoutId = setTimeout(() => {
            // Resolve empty on timeout to avoid blocking UX
            pendingSelectionRequestsRef.current.delete(requestId);
            resolve({ fieldIds: [], viewIds: [] });
          }, 500);
          pendingSelectionRequestsRef.current.set(requestId, {
            resolveCombined: resolve,
            timeoutId,
          });
          try {
            iframe.contentWindow?.postMessage(payload, PREVIEW_ORIGIN);
          } catch {
            clearTimeout(timeoutId);
            pendingSelectionRequestsRef.current.delete(requestId);
            resolve({ fieldIds: [], viewIds: [] });
          }
        },
      );
    } catch {
      return Promise.resolve({ fieldIds: [], viewIds: [] });
    }
  };

  return {
    containerRef,
    requestSelectedFieldIdsInRect,
    requestSelectedIdsInRect,
  } as const;
}
