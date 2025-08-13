"use client";

import { useCallback } from "react";
import { Stage } from "../../../types";

type UseReorderHandlersArgs = {
  stages: Stage[];
  setModelAction: (updater: (prev: any) => any) => void;
  setSelectedCaseAction: (next: any) => void;
  handleStepsUpdate: (updatedStages: Stage[]) => Promise<void> | void;
  selectedCase: { id: number; model: any } | null;
};

export function useReorderHandlers({
  stages,
  setModelAction,
  setSelectedCaseAction,
  handleStepsUpdate,
  selectedCase,
}: UseReorderHandlersArgs) {
  const handleStageReorder = useCallback(
    (startIndex: number, endIndex: number) => {
      const nextStages = [...stages];
      const [removed] = nextStages.splice(startIndex, 1);
      nextStages.splice(endIndex, 0, removed);
      setModelAction((prev) => (prev ? { ...prev, stages: nextStages } : prev));
      if (selectedCase) {
        setSelectedCaseAction({
          ...selectedCase,
          model: { ...(selectedCase.model || {}), stages: nextStages },
        } as any);
      }
      handleStepsUpdate(nextStages);
    },
    [
      stages,
      setModelAction,
      setSelectedCaseAction,
      selectedCase,
      handleStepsUpdate,
    ],
  );

  const handleProcessReorder = useCallback(
    (stageId: number, startIndex: number, endIndex: number) => {
      const nextStages = stages.map((stage) => {
        if (stage.id === stageId) {
          const processes = [...stage.processes];
          const [removed] = processes.splice(startIndex, 1);
          processes.splice(endIndex, 0, removed);
          return { ...stage, processes };
        }
        return stage;
      });
      setModelAction((prev) => (prev ? { ...prev, stages: nextStages } : prev));
      if (selectedCase) {
        setSelectedCaseAction({
          ...selectedCase,
          model: { ...(selectedCase.model || {}), stages: nextStages },
        } as any);
      }
      handleStepsUpdate(nextStages);
    },
    [
      stages,
      setModelAction,
      setSelectedCaseAction,
      selectedCase,
      handleStepsUpdate,
    ],
  );

  const handleStepReorder = useCallback(
    (
      stageId: number,
      processId: number,
      startIndex: number,
      endIndex: number,
    ) => {
      const nextStages = stages.map((stage) => {
        if (stage.id === stageId) {
          return {
            ...stage,
            processes: stage.processes.map((process) => {
              if (process.id === processId) {
                const steps = [...process.steps];
                const [removed] = steps.splice(startIndex, 1);
                steps.splice(endIndex, 0, removed);
                return { ...process, steps };
              }
              return process;
            }),
          };
        }
        return stage;
      });
      setModelAction((prev) => (prev ? { ...prev, stages: nextStages } : prev));
      if (selectedCase) {
        setSelectedCaseAction({
          ...selectedCase,
          model: { ...(selectedCase.model || {}), stages: nextStages },
        } as any);
      }
      handleStepsUpdate(nextStages);
    },
    [
      stages,
      setModelAction,
      setSelectedCaseAction,
      selectedCase,
      handleStepsUpdate,
    ],
  );

  return {
    handleStageReorder,
    handleProcessReorder,
    handleStepReorder,
  } as const;
}
