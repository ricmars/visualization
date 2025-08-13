"use client";

import { useCallback } from "react";
import { Stage } from "../../../types";
import { DB_TABLES } from "../../../types/database";

type MinimalCase = {
  id: number;
  name: string;
  description: string;
  model: any;
};

type ComposedModel = {
  name: string;
  description?: string;
  stages: Stage[];
};

type UseStepsUpdateArgs = {
  selectedCase: MinimalCase | null;
  setSelectedCaseAction: (next: MinimalCase) => void;
  setModelAction: (
    updater: (prev: ComposedModel | null) => ComposedModel | null,
  ) => void;
  eventName?: string; // defaults to 'model-updated'
};

export default function useStepsUpdate({
  selectedCase,
  setSelectedCaseAction,
  setModelAction,
  eventName = "model-updated",
}: UseStepsUpdateArgs) {
  const handleStepsUpdate = useCallback(
    async (updatedStages: Stage[]): Promise<void> => {
      if (!selectedCase) return;

      try {
        const updatedModel = {
          ...(selectedCase.model || {}),
          stages: updatedStages,
          name: selectedCase.name,
        };

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
            `Failed to update case: ${response.status} ${errorText}`,
          );
        }

        await response.json();

        setSelectedCaseAction({
          ...selectedCase,
          model: updatedModel,
        } as MinimalCase);
        setModelAction((prev) =>
          prev ? { ...prev, stages: updatedModel.stages } : null,
        );

        // Notify preview listeners
        window.dispatchEvent(new CustomEvent(eventName));
      } catch (error) {
        console.error("Error updating steps:", error);
        throw error;
      }
    },
    [selectedCase, setSelectedCaseAction, setModelAction, eventName],
  );

  return { handleStepsUpdate } as const;
}
