"use client";

import { useEffect, useRef } from "react";

type GenerateModel = () => any;

type UsePreviewIframeArgs = {
  isPreviewMode: boolean;
  generateModel: GenerateModel;
};

export default function usePreviewIframe({
  isPreviewMode,
  generateModel,
}: UsePreviewIframeArgs) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Send model updates when the model is updated
  useEffect(() => {
    const handleModelUpdate = () => {
      if (isPreviewMode && containerRef.current) {
        const iframe = containerRef.current.querySelector("iframe");
        if (iframe) {
          const model = generateModel();
          iframe.contentWindow?.postMessage(model, "*");
        }
      }
    };

    window.addEventListener("model-updated", handleModelUpdate as any);
    return () => {
      window.removeEventListener("model-updated", handleModelUpdate as any);
    };
  }, [isPreviewMode, generateModel]);

  // Manage iframe creation and cleanup
  useEffect(() => {
    let iframe: HTMLIFrameElement | null = null;
    const container = containerRef.current;
    if (isPreviewMode && container) {
      iframe = container.querySelector("iframe");
      if (!iframe) {
        iframe = document.createElement("iframe");
        iframe.src =
          "https://blueprint2024-8b147.web.app/blueprint-preview.html";
        iframe.className = "w-full h-full border-0";
        iframe.title = "Blueprint Preview";
        iframe.onload = () => {
          if (iframe) {
            const model = generateModel();
            iframe.contentWindow?.postMessage(model, "*");
          }
        };
        container.appendChild(iframe);
      }
    }
    return () => {
      if (container && iframe) {
        container.removeChild(iframe);
      }
    };
  }, [isPreviewMode, generateModel]);

  return { containerRef } as const;
}
