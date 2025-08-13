"use client";

import { useCallback } from "react";
import { Field, Process, Stage, Step } from "../../../types";
import { DB_COLUMNS, DB_TABLES } from "../../../types/database";
import { fetchWithBaseUrl } from "../../../lib/fetchWithBaseUrl";
import {
  addFieldToViewModel,
  removeFieldFromViewModel,
} from "../../../lib/modelUtils";

type MinimalCase = {
  id: number;
  name: string;
  description: string;
  model: any;
};

type UseViewMutationsArgs = {
  selectedCase: MinimalCase | null;
  fields: Field[];
  views: any[];
  setViewsAction: (next: any) => void;
  setModelAction: (updater: (prev: any) => any) => void;
  setSelectedCaseAction: (next: MinimalCase) => void;
  eventName?: string;
};

export function useViewMutations({
  selectedCase,
  fields,
  views,
  setViewsAction,
  setModelAction,
  setSelectedCaseAction,
  eventName = "model-updated",
}: UseViewMutationsArgs) {
  const handleRemoveFieldFromView = useCallback(
    async (field: Field, selectedView: string | null) => {
      if (!selectedCase || !field.id || !selectedView) return;
      let viewId: number | undefined;
      if (selectedView.startsWith("db-")) {
        viewId = parseInt(selectedView.substring(3), 10);
      } else {
        return;
      }
      if (!viewId || isNaN(viewId)) throw new Error("Invalid view ID");
      const view = views.find((v) => v.id === viewId);
      if (!view) throw new Error("View not found");
      let viewModel;
      try {
        viewModel =
          typeof view.model === "string" ? JSON.parse(view.model) : view.model;
      } catch {
        viewModel = { fields: [] };
      }
      const { viewModel: updatedModel, removed } = removeFieldFromViewModel(
        viewModel,
        field.id,
      );
      if (removed) {
        const response = await fetch(
          `/api/database?table=${DB_TABLES.VIEWS}&id=${view.id}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: view.name,
              caseid: selectedCase.id,
              model: {
                fields: updatedModel.fields,
                layout: { type: "form", columns: 1 },
              },
            }),
          },
        );
        if (!response.ok) throw new Error("Failed to update view");
        const viewsResponse = await fetchWithBaseUrl(
          `/api/database?table=${DB_TABLES.VIEWS}&${DB_COLUMNS.CASE_ID}=${selectedCase.id}`,
        );
        if (viewsResponse.ok) {
          const viewsData = await viewsResponse.json();
          setViewsAction(viewsData.data);
        }
      }
    },
    [selectedCase, views, setViewsAction],
  );

  const handleAddFieldsToView = useCallback(
    async (viewId: number, fieldNames: string[]) => {
      if (!selectedCase) return;
      const view = views.find((v) => v.id === viewId);
      if (!view) throw new Error("View not found");
      let viewModel: any = {};
      try {
        viewModel = JSON.parse(view.model || "{}");
      } catch {
        viewModel = { fields: [] };
      }
      const resolvedFieldIds: number[] = [];
      const unresolved: string[] = [];
      for (const name of fieldNames) {
        const local = fields.find((f) => f.name === name);
        if (local && typeof local.id === "number")
          resolvedFieldIds.push(local.id);
        else unresolved.push(name);
      }
      if (unresolved.length > 0) {
        const lookups = await Promise.all(
          unresolved.map(async (fname) => {
            try {
              const resp = await fetchWithBaseUrl(
                `/api/database?table=${DB_TABLES.FIELDS}&${
                  DB_COLUMNS.CASE_ID
                }=${selectedCase.id}&name=${encodeURIComponent(fname)}`,
              );
              if (resp.ok) {
                const data = await resp.json();
                const rec = Array.isArray(data.data)
                  ? data.data.find((r: any) => r.name === fname)
                  : data.data?.name === fname
                  ? data.data
                  : null;
                return rec?.id as number | undefined;
              }
            } catch {}
            return undefined;
          }),
        );
        for (const id of lookups)
          if (typeof id === "number") resolvedFieldIds.push(id);
      }
      let updatedViewModel = { ...viewModel };
      for (const fid of resolvedFieldIds) {
        const res = addFieldToViewModel(updatedViewModel, fid, {
          required: false,
        });
        updatedViewModel = res.viewModel;
      }
      const response = await fetch(
        `/api/database?table=${DB_TABLES.VIEWS}&id=${viewId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: view.name,
            caseid: selectedCase.id,
            model: {
              fields: updatedViewModel.fields,
              layout: { type: "form", columns: 1 },
            },
          }),
        },
      );
      if (!response.ok) throw new Error("Failed to update view");
      const { data: updatedView } = await response.json();
      const normalizedUpdatedView = {
        ...updatedView,
        model:
          typeof updatedView.model === "string"
            ? updatedView.model
            : JSON.stringify(updatedView.model ?? {}),
      };
      setViewsAction((prev: any[]) =>
        prev.map((v) => (v.id === viewId ? normalizedUpdatedView : v)),
      );
      window.dispatchEvent(new CustomEvent(eventName));
    },
    [selectedCase, fields, views, setViewsAction, eventName],
  );

  const handleAddFieldsToStep = useCallback(
    async (stepId: number, fieldNames: string[], modelStages: Stage[]) => {
      if (!selectedCase) return;
      const updatedStages = modelStages.map((stage: Stage) => ({
        ...stage,
        processes: stage.processes.map((process: Process) => ({
          ...process,
          steps: process.steps.map((step: Step) => {
            if (step.id === stepId && step.type === "Collect information") {
              const existing = step.fields || [];
              const existingMap = new Map(existing.map((f) => [f.fieldId, f]));
              fieldNames.forEach((name) => {
                const found = fields.find((f) => f.name === name);
                if (found && found.id && !existingMap.has(found.id)) {
                  existingMap.set(found.id, {
                    fieldId: found.id,
                    required: false,
                  });
                }
              });
              return {
                ...step,
                fields: Array.from(existingMap.values()),
              } as any;
            }
            return step;
          }),
        })),
      }));
      const updatedModel = {
        name: selectedCase.name,
        description: selectedCase.description,
        stages: updatedStages,
      };
      const response = await fetch(
        `/api/database?table=${DB_TABLES.CASES}&id=${selectedCase.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            table: DB_TABLES.CASES,
            data: {
              id: selectedCase.id,
              name: selectedCase.name,
              description: selectedCase.description,
              model: updatedModel,
            },
          }),
        },
      );
      if (!response.ok) throw new Error("Failed to update step fields");
      const { data: updatedCase } = await response.json();
      setSelectedCaseAction(updatedCase);
      setModelAction((prev) =>
        prev ? { ...prev, stages: updatedStages } : prev,
      );
      window.dispatchEvent(new CustomEvent(eventName));
    },
    [selectedCase, fields, setSelectedCaseAction, setModelAction, eventName],
  );

  return {
    handleAddFieldsToView,
    handleRemoveFieldFromView,
    handleAddFieldsToStep,
  } as const;
}
