"use client";

import { useMemo } from "react";
import { Stage } from "../../../types";

type Params = {
  stages: Stage[];
  selectedStageIds: number[];
  selectedProcessIds: number[];
  selectedStepIds: number[];
  selectedFieldIds: number[];
  selectedViewIds: number[];
};

export default function useQuickSelectionSummary({
  stages,
  selectedStageIds,
  selectedProcessIds,
  selectedStepIds,
  selectedFieldIds,
  selectedViewIds,
}: Params) {
  return useMemo(() => {
    const stageCount = selectedStageIds.length;
    const processCount = selectedProcessIds.length;
    const stepCount = selectedStepIds.length;
    const fieldCount = selectedFieldIds.length;

    // Collect view IDs implied by selected steps
    const impliedViewIds = new Set<number>();
    for (const stage of stages) {
      for (const process of stage.processes) {
        for (const step of process.steps) {
          const stepIdNum = step.id as number;
          const maybeViewId = (step as any).viewId as number | undefined;
          if (
            selectedStepIds.includes(stepIdNum) &&
            typeof maybeViewId === "number"
          ) {
            impliedViewIds.add(maybeViewId);
          }
        }
      }
    }
    const viewIdsUnion = new Set<number>(selectedViewIds);
    impliedViewIds.forEach((v) => viewIdsUnion.add(v));
    const viewCount = viewIdsUnion.size;

    const parts: string[] = [];
    if (stageCount > 0)
      parts.push(`${stageCount} stage${stageCount === 1 ? "" : "s"}`);
    if (processCount > 0)
      parts.push(`${processCount} process${processCount === 1 ? "" : "es"}`);
    if (stepCount > 0)
      parts.push(`${stepCount} step${stepCount === 1 ? "" : "s"}`);
    if (fieldCount > 0)
      parts.push(`${fieldCount} field${fieldCount === 1 ? "" : "s"}`);

    let suffix = "";
    if (stepCount > 0 && viewCount > 0) {
      suffix = ` including ${viewCount} view${viewCount === 1 ? "" : "s"}`;
    } else if (stepCount === 0 && viewCount > 0) {
      parts.push(`${viewCount} view${viewCount === 1 ? "" : "s"}`);
    }

    if (parts.length === 0) return "No items selected";
    if (parts.length === 1) return `${parts[0]} selected${suffix}`;
    if (parts.length === 2)
      return `${parts[0]} and ${parts[1]} selected${suffix}`;
    return `${parts.slice(0, -1).join(", ")} and ${
      parts[parts.length - 1]
    } selected${suffix}`;
  }, [
    stages,
    selectedStageIds,
    selectedProcessIds,
    selectedStepIds,
    selectedFieldIds,
    selectedViewIds,
  ]);
}
