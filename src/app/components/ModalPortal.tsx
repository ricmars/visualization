"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface ModalPortalProps {
  children: React.ReactNode;
  isOpen: boolean;
  containerId?: string;
}

export default function ModalPortal({
  children,
  isOpen,
  containerId = "main-content-area",
}: ModalPortalProps) {
  const [mounted, setMounted] = useState(false);
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setMounted(true);
    // Find the main content container or create one if it doesn't exist
    let targetContainer = document.getElementById(containerId);
    if (!targetContainer) {
      // Fallback to finding the main content area by class or creating a container
      targetContainer = document.querySelector(
        "[data-main-content]",
      ) as HTMLElement;
      if (!targetContainer) {
        // Create a temporary container in the body if none exists
        targetContainer = document.body;
      }
    }
    setContainer(targetContainer);
    return () => setMounted(false);
  }, [containerId]);

  if (!mounted || !isOpen || !container) return null;

  // Create portal to main content area to keep modals within the correct bounds
  return createPortal(
    <div data-modal-portal="true">{children}</div>,
    container,
  );
}
