"use client";

import { useCallback } from "react";
import { Stage, Step } from "../../../types";
import { StepType } from "../../../utils/stepTypes";
import { DB_TABLES, DB_COLUMNS } from "../../../types/database";
import { fetchWithBaseUrl } from "../../../lib/fetchWithBaseUrl";

type MinimalCase = {
  id: number;
  name: string;
  description: string;
  model: any;
};

type UseWorkflowMutationsArgs = {
  selectedCase: MinimalCase | null;
  workflowStages: Stage[];
  setSelectedCaseAction: (next: MinimalCase) => void;
  setModelAction: (next: any) => void;
  setViewsAction: (next: any) => void;
  addCheckpointAction: (description: string, model: any) => void;
  caseId: string;
  eventName?: string; // defaults to 'model-updated'
};

export default function useWorkflowMutations({
  selectedCase,
  workflowStages,
  setSelectedCaseAction,
  setModelAction,
  setViewsAction,
  addCheckpointAction,
  caseId,
  eventName = "model-updated",
}: UseWorkflowMutationsArgs) {
  const handleAddStep = useCallback(
    async (
      stageId: number,
      processId: number,
      stepName: string,
      stepType: StepType,
    ) => {
      if (!selectedCase) return;

      try {
        let createdViewId: number | undefined;
        if (stepType === "Collect information") {
          const createViewResponse = await fetch(
            `/api/database?table=${DB_TABLES.VIEWS}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: stepName,
                caseid: selectedCase.id,
                model: { fields: [], layout: { type: "form", columns: 1 } },
              }),
            },
          );
          if (!createViewResponse.ok) {
            throw new Error(
              `Failed to create view: ${createViewResponse.status}`,
            );
          }
          const { data: createdView } = await createViewResponse.json();
          createdViewId = createdView?.id;
        }

        const newStep: Step = {
          id: Date.now(),
          name: stepName,
          type: stepType,
          fields: [],
          ...(createdViewId ? { viewId: createdViewId } : {}),
        } as any;

        const updatedStages = workflowStages.map((stage) =>
          stage.id === stageId
            ? {
                ...stage,
                processes: stage.processes.map((process) =>
                  process.id === processId
                    ? { ...process, steps: [...process.steps, newStep] }
                    : process,
                ),
              }
            : stage,
        );

        const updatedModel = {
          name: selectedCase.name,
          description: selectedCase.description,
          stages: updatedStages,
        };
        addCheckpointAction(`Added step: ${stepName}`, updatedModel);

        const response = await fetch(
          `/api/database?table=${DB_TABLES.CASES}&id=${selectedCase.id}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: selectedCase.name,
              description: selectedCase.description,
              model: updatedModel,
            }),
          },
        );
        if (!response.ok)
          throw new Error(`Failed to add step: ${response.status}`);
        const { data: updatedCase } = await response.json();
        setSelectedCaseAction(updatedCase);
        setModelAction(updatedModel);

        try {
          const viewsResponse = await fetchWithBaseUrl(
            `/api/database?table=${DB_TABLES.VIEWS}&${DB_COLUMNS.CASE_ID}=${caseId}`,
          );
          if (viewsResponse.ok) {
            const viewsData = await viewsResponse.json();
            setViewsAction(viewsData.data);
          }
        } catch {}

        window.dispatchEvent(new CustomEvent(eventName));
      } catch (error) {
        console.error("Error adding step:", error);
        throw error as Error;
      }
    },
    [
      selectedCase,
      workflowStages,
      setSelectedCaseAction,
      setModelAction,
      setViewsAction,
      addCheckpointAction,
      caseId,
      eventName,
    ],
  );

  const handleDeleteStep = useCallback(
    async (stageId: number, processId: number, stepId: number) => {
      if (!selectedCase) return;

      let viewIdToDelete: number | undefined;
      try {
        const stage = workflowStages.find((s) => s.id === stageId);
        const process = stage?.processes.find((p) => p.id === processId);
        const step = process?.steps.find((st) => st.id === stepId);
        if (step && typeof (step as any).viewId === "number") {
          viewIdToDelete = (step as any).viewId as number;
        }
      } catch {}

      const updatedStages = workflowStages.map((stage) =>
        stage.id === stageId
          ? {
              ...stage,
              processes: stage.processes.map((process) =>
                process.id === processId
                  ? {
                      ...process,
                      steps: process.steps.filter((st) => st.id !== stepId),
                    }
                  : process,
              ),
            }
          : stage,
      );
      const updatedModel = {
        name: selectedCase.name,
        description: selectedCase.description,
        stages: updatedStages,
      };
      addCheckpointAction("Deleted step", updatedModel);

      try {
        if (typeof viewIdToDelete === "number") {
          try {
            const delResp = await fetch(
              `/api/database?table=${DB_TABLES.VIEWS}&id=${viewIdToDelete}`,
              { method: "DELETE" },
            );
            if (!delResp.ok) {
              const errText = await delResp.text();
              console.warn(
                `Failed to delete linked view ${viewIdToDelete}: ${delResp.status} ${errText}`,
              );
            }
          } catch (e) {
            console.warn("Error deleting linked view for step:", e);
          }
        }

        const response = await fetch(
          `/api/database?table=${DB_TABLES.CASES}&id=${selectedCase.id}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: selectedCase.name,
              description: selectedCase.description,
              model: updatedModel,
            }),
          },
        );
        if (!response.ok)
          throw new Error(`Failed to delete step: ${response.status}`);
        const { data: updatedCase } = await response.json();
        setSelectedCaseAction(updatedCase);
        setModelAction(updatedModel);

        try {
          const viewsResponse = await fetchWithBaseUrl(
            `/api/database?table=${DB_TABLES.VIEWS}&${DB_COLUMNS.CASE_ID}=${selectedCase.id}`,
          );
          if (viewsResponse.ok) {
            const viewsData = await viewsResponse.json();
            setViewsAction(viewsData.data);
          }
        } catch {}

        window.dispatchEvent(new CustomEvent(eventName));
      } catch (error) {
        console.error("Error deleting step:", error);
        throw error as Error;
      }
    },
    [
      selectedCase,
      workflowStages,
      setSelectedCaseAction,
      setModelAction,
      setViewsAction,
      addCheckpointAction,
      eventName,
    ],
  );

  const handleDeleteProcess = useCallback(
    async (stageId: number, processId: number) => {
      if (!selectedCase) return;
      let viewIdsToDelete: number[] = [];
      try {
        const stage = workflowStages.find((s) => s.id === stageId);
        const process = stage?.processes.find((p) => p.id === processId);
        if (process) {
          viewIdsToDelete = (process.steps || [])
            .map((st) => (st as any).viewId as number | undefined)
            .filter((vid): vid is number => typeof vid === "number");
        }
      } catch {}

      const updatedStages = workflowStages.map((stage) =>
        stage.id === stageId
          ? {
              ...stage,
              processes: stage.processes.filter((p) => p.id !== processId),
            }
          : stage,
      );
      const updatedModel = {
        name: selectedCase.name,
        description: selectedCase.description,
        stages: updatedStages,
      };
      addCheckpointAction("Deleted process", updatedModel);

      try {
        if (viewIdsToDelete.length > 0) {
          try {
            await Promise.allSettled(
              viewIdsToDelete.map((vid) =>
                fetch(`/api/database?table=${DB_TABLES.VIEWS}&id=${vid}`, {
                  method: "DELETE",
                }),
              ),
            );
          } catch {}
        }

        const response = await fetch(
          `/api/database?table=${DB_TABLES.CASES}&id=${selectedCase.id}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: selectedCase.name,
              description: selectedCase.description,
              model: updatedModel,
            }),
          },
        );
        if (!response.ok)
          throw new Error(`Failed to delete process: ${response.status}`);
        const { data: updatedCase } = await response.json();
        setSelectedCaseAction(updatedCase);
        setModelAction(updatedModel);

        try {
          const viewsResponse = await fetchWithBaseUrl(
            `/api/database?table=${DB_TABLES.VIEWS}&${DB_COLUMNS.CASE_ID}=${selectedCase.id}`,
          );
          if (viewsResponse.ok) {
            const viewsData = await viewsResponse.json();
            setViewsAction(viewsData.data);
          }
        } catch {}

        window.dispatchEvent(new CustomEvent(eventName));
      } catch (error) {
        console.error("Error deleting process:", error);
        throw error as Error;
      }
    },
    [
      selectedCase,
      workflowStages,
      setSelectedCaseAction,
      setModelAction,
      setViewsAction,
      addCheckpointAction,
      eventName,
    ],
  );

  const handleAddProcess = useCallback(
    async (stageId: number, processName: string) => {
      if (!selectedCase) return;
      const updatedStages = workflowStages.map((stage) =>
        stage.id === stageId
          ? {
              ...stage,
              processes: [
                ...stage.processes,
                { id: Date.now(), name: processName, steps: [] },
              ],
            }
          : stage,
      );
      const updatedModel = {
        name: selectedCase.name,
        description: selectedCase.description,
        stages: updatedStages,
      };
      addCheckpointAction(`Added process: ${processName}`, updatedModel);
      const requestUrl = `/api/database?table=${DB_TABLES.CASES}&id=${selectedCase.id}`;
      const requestBody = {
        name: selectedCase.name,
        description: selectedCase.description,
        model: updatedModel,
      };
      const response = await fetch(requestUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to add process: ${response.status} ${errorText}`,
        );
      }
      const { data: updatedCase } = await response.json();
      setSelectedCaseAction(updatedCase);
      setModelAction(updatedModel);
      window.dispatchEvent(new CustomEvent(eventName));
    },
    [
      selectedCase,
      workflowStages,
      setSelectedCaseAction,
      setModelAction,
      addCheckpointAction,
      eventName,
    ],
  );

  const handleDeleteStage = useCallback(
    async (stageId: number) => {
      if (!selectedCase) return;

      let viewIdsToDelete: number[] = [];
      try {
        const stage = workflowStages.find((s) => s.id === stageId);
        if (stage) {
          for (const proc of stage.processes || []) {
            const ids = (proc.steps || [])
              .map((st) => (st as any).viewId as number | undefined)
              .filter((vid): vid is number => typeof vid === "number");
            viewIdsToDelete.push(...ids);
          }
        }
      } catch {}

      const updatedStages = workflowStages.filter((s) => s.id !== stageId);
      const updatedModel = {
        name: selectedCase.name,
        description: selectedCase.description,
        stages: updatedStages,
      };
      addCheckpointAction("Deleted stage", updatedModel);

      try {
        if (viewIdsToDelete.length > 0) {
          try {
            await Promise.allSettled(
              viewIdsToDelete.map((vid) =>
                fetch(`/api/database?table=${DB_TABLES.VIEWS}&id=${vid}`, {
                  method: "DELETE",
                }),
              ),
            );
          } catch {}
        }

        const response = await fetch(
          `/api/database?table=${DB_TABLES.CASES}&id=${selectedCase.id}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: selectedCase.name,
              description: selectedCase.description,
              model: updatedModel,
            }),
          },
        );
        if (!response.ok)
          throw new Error(`Failed to delete stage: ${response.status}`);
        const { data: updatedCase } = await response.json();
        setSelectedCaseAction(updatedCase);
        setModelAction(updatedModel);

        try {
          const viewsResponse = await fetchWithBaseUrl(
            `/api/database?table=${DB_TABLES.VIEWS}&${DB_COLUMNS.CASE_ID}=${selectedCase.id}`,
          );
          if (viewsResponse.ok) {
            const viewsData = await viewsResponse.json();
            setViewsAction(viewsData.data);
          }
        } catch {}

        window.dispatchEvent(new CustomEvent(eventName));
      } catch (error) {
        console.error("Error deleting stage:", error);
        throw error as Error;
      }
    },
    [
      selectedCase,
      workflowStages,
      setSelectedCaseAction,
      setModelAction,
      setViewsAction,
      addCheckpointAction,
      eventName,
    ],
  );

  return {
    handleAddStep,
    handleAddProcess,
    handleDeleteStep,
    handleDeleteProcess,
    handleDeleteStage,
  } as const;
}
