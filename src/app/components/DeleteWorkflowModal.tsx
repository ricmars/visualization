"use client";

import { useEffect, useState } from "react";

interface DeleteWorkflowModalProps {
  isOpen: boolean;
  caseId?: number;
  caseName?: string;
  onCancel: () => void;
  onConfirm: (caseId: number) => Promise<void>;
}

export default function DeleteWorkflowModal({
  isOpen,
  caseId,
  caseName,
  onCancel,
  onConfirm,
}: DeleteWorkflowModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setIsDeleting(false);
      setProgress("");
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (!caseId) return;
    setIsDeleting(true);
    setError(null);
    setProgress("Deleting checkpoints...");
    try {
      // Step 1: delete checkpoints for this case (if any)
      await fetch(`/api/checkpoint?action=deleteAll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseid: caseId }),
      });

      setProgress("Deleting views and fields...");

      // Step 2: call parent to delete the case (which cascades fields and views)
      await onConfirm(caseId);

      setProgress("Workflow deleted.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete workflow");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center z-[80] modal-overlay p-4">
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md z-[90]"
        role="dialog"
      >
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-2">Delete workflow</h2>
          <p className="text-sm text-gray-600">
            Are you sure you want to delete "{caseName}"? This will permanently
            remove the workflow, all fields, views, and checkpoints for this
            case.
          </p>

          {progress && (
            <div className="mt-4 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded p-2">
              {progress}
            </div>
          )}
          {error && (
            <div className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">
              {error}
            </div>
          )}
        </div>
        <div className="px-6 pb-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
          >
            {isDeleting && (
              <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            )}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
