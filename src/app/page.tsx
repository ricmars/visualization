"use client";

import { useState, useEffect } from "react";
import { CreateWorkflowModal } from "./components/CreateWorkflowModal";
import { Case } from "./types";
import { useRouter } from "next/navigation";
import { fetchWithBaseUrl } from "./lib/fetchWithBaseUrl";
import { Service } from "./services/service";
import { databaseSystemPrompt } from "./lib/databasePrompt";
import { registerRuleTypes } from "./types/ruleTypeDefinitions";

// Initialize rule types on module load
registerRuleTypes();

/**
 * Main page component for the workflow application
 * Handles workflow listing, creation, and deletion
 */
export default function Home() {
  const [cases, setCases] = useState<Case[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreatingWorkflow, setIsCreatingWorkflow] = useState(false);
  const [creationProgress, setCreationProgress] = useState<string>("");
  const router = useRouter();

  const refreshCases = async () => {
    try {
      const response = await fetchWithBaseUrl(`/api/dynamic?ruleType=case`);
      if (!response.ok) {
        throw new Error(`Failed to fetch cases: ${response.status}`);
      }
      const data = await response.json();
      setCases(data.data);
    } catch (error) {
      console.error("Error fetching cases:", error);
      setError(
        error instanceof Error ? error.message : "Failed to fetch cases",
      );
    }
  };

  useEffect(() => {
    refreshCases();
  }, []);

  const handleCreateWorkflow = async (name: string, description: string) => {
    try {
      setIsCreatingWorkflow(true);
      setError(null);
      setCreationProgress("Initializing workflow creation...");

      console.log("=== Creating New Workflow ===");
      console.log("Input:", { name, description });

      // Use the AI service to create the workflow
      const response = await Service.generateResponse(
        `Create a new workflow with name "${name}" and description "${description}".`,
        databaseSystemPrompt,
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Error Response:", {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
        });
        throw new Error(
          `Failed to create workflow: ${response.status} ${errorText}`,
        );
      }

      // Process the streaming response
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body available");
      }

      const decoder = new TextDecoder();
      let createdCaseId: number | null = null;
      let isComplete = false;

      setCreationProgress("Creating workflow...");

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.text) {
                  setCreationProgress((prev) => prev + "\n" + data.text);
                }

                // Tool results are now sent as text messages, not as toolResult objects
                // The case creation success is handled in the text messages above

                if (data.done) {
                  isComplete = true;
                  setCreationProgress(
                    (prev) => prev + "\n✅ Workflow creation completed!",
                  );
                }

                // Check for timeout or other errors in the text content
                if (data.text && data.text.includes("timeout")) {
                  throw new Error(
                    "Workflow creation timed out. Please try again.",
                  );
                }

                // Check for incomplete workflow warnings
                if (
                  data.text &&
                  data.text.includes("WARNING: Workflow creation incomplete")
                ) {
                  throw new Error(
                    "Workflow creation was incomplete. Please try again.",
                  );
                }

                if (data.error) {
                  console.error("Streaming error received:", data.error);
                  throw new Error(data.error);
                }
              } catch (parseError) {
                console.warn("Failed to parse SSE data:", parseError);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      if (!isComplete) {
        throw new Error("Workflow creation did not complete properly");
      }

      // Refresh cases to get the latest data
      await refreshCases();

      // Find the newly created case
      const newCase = cases.find((c) => c.name === name);
      if (newCase) {
        setSuccessMessage("Workflow created successfully!");
        // Close the modal and navigate to the workflow page
        setIsCreateModalOpen(false);
        router.push(`/workflow/${newCase.id}`);
      } else if (createdCaseId) {
        // If we have the case ID but it's not in the cases list yet, navigate directly
        setIsCreateModalOpen(false);
        router.push(`/workflow/${createdCaseId}`);
      } else {
        setSuccessMessage("Workflow created successfully!");
        setIsCreateModalOpen(false);
      }
    } catch (error) {
      console.error("Error creating workflow:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to create workflow";
      setError(errorMessage);
      setCreationProgress((prev) => prev + "\n❌ " + errorMessage);
      // Don't close modal on error - let the user see the error in the modal
    } finally {
      setIsCreatingWorkflow(false);
    }
  };

  const _handleDeleteWorkflow = async (name: string) => {
    try {
      const caseToDelete = cases?.find((c) => c.name === name);
      if (!caseToDelete) {
        throw new Error("Workflow not found");
      }

      const response = await fetchWithBaseUrl(
        `/api/dynamic?ruleType=case&id=${caseToDelete.id}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to delete workflow: ${response.status}`);
      }

      setCases((prevCases) => prevCases.filter((c) => c.name !== name));
    } catch (error) {
      console.error("Error deleting workflow:", error);
      throw error;
    }
  };

  return (
    <div className="container mx-auto p-4">
      {successMessage && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {successMessage}
        </div>
      )}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Workflows</h1>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Create New Workflow
        </button>
      </div>
      {cases.length === 0 ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cases.map((case_) => (
            <div
              key={case_.id}
              className="border rounded p-4 hover:shadow-lg transition-shadow"
            >
              <h2 className="text-xl font-semibold mb-2">{case_.name}</h2>
              <p className="text-gray-600 mb-4">{case_.description}</p>
              <button
                onClick={() => router.push(`/workflow/${case_.id}`)}
                className="text-blue-500 hover:text-blue-700"
              >
                Open Workflow
              </button>
            </div>
          ))}
        </div>
      )}
      <CreateWorkflowModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setError(null); // Clear error when modal is closed
          setCreationProgress(""); // Clear progress when modal is closed
        }}
        onCreate={handleCreateWorkflow}
        isCreating={isCreatingWorkflow}
        creationProgress={creationProgress}
        creationError={error}
      />
    </div>
  );
}
