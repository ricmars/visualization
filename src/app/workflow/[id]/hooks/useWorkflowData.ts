"use client";

import { useCallback, useEffect, useState } from "react";
import { Field } from "../../../types";
import { DB_COLUMNS, DB_TABLES } from "../../../types/database";
import { fetchWithBaseUrl } from "../../../lib/fetchWithBaseUrl";
import { validateModelIds } from "../utils/validateModelIds";

type DatabaseCase = {
  id: number;
  name: string;
  description: string;
  model: any;
};

type ComposedModel = {
  name: string;
  description?: string;
  stages: any[];
};

type View = {
  id: number;
  name: string;
  model: any;
  caseid: number;
};

const MODEL_UPDATED_EVENT = "model-updated";

export function useWorkflowData(caseId: string) {
  const [model, setModel] = useState<ComposedModel | null>(null);
  const [fields, setFields] = useState<Field[]>([]);
  const [views, setViews] = useState<View[]>([]);
  const [selectedCase, setSelectedCase] = useState<DatabaseCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const setModelAction = useCallback(
    (updater: (prev: ComposedModel | null) => ComposedModel | null) => {
      setModel(updater);
    },
    [],
  );

  const setSelectedCaseAction = useCallback((next: DatabaseCase) => {
    setSelectedCase(next);
  }, []);

  const fetchCaseData = useCallback(
    async (caseid: string): Promise<ComposedModel> => {
      const caseResponse = await fetchWithBaseUrl(
        `/api/database?table=${DB_TABLES.CASES}&id=${caseid}`,
      );
      if (!caseResponse.ok) {
        throw new Error(`Failed to fetch case: ${caseResponse.status}`);
      }
      const caseData = await caseResponse.json();
      const dbCase: DatabaseCase = caseData.data;

      if (!dbCase) {
        throw new Error("Case not found");
      }

      const parsedModel = dbCase.model;
      const stagesWithIds = validateModelIds(parsedModel.stages || []);
      return {
        name: dbCase.name,
        description: dbCase.description,
        stages: stagesWithIds,
      };
    },
    [],
  );

  const fetchCase = useCallback(async () => {
    try {
      const response = await fetchWithBaseUrl(
        `/api/database?table=${DB_TABLES.CASES}&id=${caseId}`,
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch case: ${response.status}`);
      }
      const data = await response.json();
      setSelectedCase(data.data || null);
    } catch (err) {
      console.error("Error fetching case:", err);
    }
  }, [caseId]);

  const loadWorkflow = useCallback(async () => {
    try {
      setLoading(true);
      const composedModel = await fetchCaseData(caseId);
      setModel(composedModel);

      const fieldsResponse = await fetchWithBaseUrl(
        `/api/database?table=${DB_TABLES.FIELDS}&${DB_COLUMNS.CASE_ID}=${caseId}`,
      );
      if (fieldsResponse.ok) {
        const fieldsResult = await fieldsResponse.json();
        setFields(fieldsResult.data);
      }

      const viewsResponse = await fetchWithBaseUrl(
        `/api/database?table=${DB_TABLES.VIEWS}&${DB_COLUMNS.CASE_ID}=${caseId}`,
      );
      if (viewsResponse.ok) {
        const viewsData = await viewsResponse.json();
        setViews(viewsData.data);
      }

      setError(null);
    } catch (err) {
      console.error("Error loading workflow:", err);
      setError(err instanceof Error ? err.message : "Failed to load workflow");
    } finally {
      setLoading(false);
    }
  }, [caseId, fetchCaseData]);

  const refreshWorkflowData = useCallback(async () => {
    try {
      const caseResponse = await fetchWithBaseUrl(
        `/api/database?table=${DB_TABLES.CASES}&id=${caseId}`,
      );
      if (caseResponse.ok) {
        const caseData = await caseResponse.json();
        setSelectedCase(caseData.data);
      }

      const composedModel = await fetchCaseData(caseId);
      setModel(composedModel);

      const fieldsResponse = await fetchWithBaseUrl(
        `/api/database?table=${DB_TABLES.FIELDS}&${DB_COLUMNS.CASE_ID}=${caseId}`,
      );
      if (fieldsResponse.ok) {
        const fieldsResult = await fieldsResponse.json();
        setFields(fieldsResult.data);
      }

      const viewsResponse = await fetchWithBaseUrl(
        `/api/database?table=${DB_TABLES.VIEWS}&${DB_COLUMNS.CASE_ID}=${caseId}`,
      );
      if (viewsResponse.ok) {
        const viewsData = await viewsResponse.json();
        setViews(viewsData.data);
      }

      // Fire after state commits so listeners (iframe) receive the latest model
      try {
        console.debug(
          "[data] refreshWorkflowData completed; dispatching model-updated via raf",
        );
      } catch {}
      try {
        requestAnimationFrame(() => {
          try {
            console.debug("[data] dispatch model-updated now");
            window.dispatchEvent(new CustomEvent(MODEL_UPDATED_EVENT));
          } catch {}
        });
      } catch {
        try {
          console.debug("[data] dispatch model-updated (no raf)");
          window.dispatchEvent(new CustomEvent(MODEL_UPDATED_EVENT));
        } catch {}
      }
    } catch (err) {
      console.error("Error refreshing workflow data:", err);
    }
  }, [caseId, fetchCaseData]);

  useEffect(() => {
    fetchCase();
    void loadWorkflow();
  }, [fetchCase, loadWorkflow]);

  return {
    model,
    setModelAction,
    fields,
    setFields,
    views,
    setViews,
    selectedCase,
    setSelectedCaseAction,
    loading,
    error,
    loadWorkflow,
    refreshWorkflowData,
    fetchCaseData,
  } as const;
}
