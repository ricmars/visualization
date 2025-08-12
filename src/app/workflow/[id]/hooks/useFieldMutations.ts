"use client";

import { useCallback } from "react";
import { Field, FieldReference, Stage, Process, Step } from "../../../types";
import { DB_COLUMNS, DB_TABLES } from "../../../types/database";
import { fetchWithBaseUrl } from "../../../lib/fetchWithBaseUrl";

type MinimalCase = {
  id: number;
  name: string;
  description: string;
  model: any;
};

type UseFieldMutationsArgs = {
  selectedCase: MinimalCase | null;
  fields: Field[];
  setFields: (next: Field[] | ((prev: Field[]) => Field[])) => void;
  setModel: (next: any) => void;
  setSelectedCase: (next: MinimalCase) => void;
  caseId: string; // route param id
  eventName?: string; // defaults to 'model-updated'
  fetchCaseData: (id: string) => Promise<any>;
};

export default function useFieldMutations({
  selectedCase,
  fields,
  setFields,
  setModel,
  setSelectedCase,
  caseId,
  eventName = "model-updated",
  fetchCaseData,
}: UseFieldMutationsArgs) {
  const handleAddField = useCallback(
    async (field: {
      label: string;
      type: Field["type"];
      options?: string[];
      required?: boolean;
      primary?: boolean;
      sampleValue?: string;
    }): Promise<string> => {
      if (!selectedCase) return "";

      const fieldName = field.label.toLowerCase().replace(/\s+/g, "_");
      try {
        const fieldData = {
          name: fieldName,
          type: field.type,
          label: field.label,
          required: field.required ?? false,
          primary: field.primary ?? false,
          caseid: selectedCase.id,
          description: field.label,
          order: 0,
          options: field.options ?? [],
          sampleValue: field.sampleValue,
        };

        const response = await fetch(
          `/api/database?table=${DB_TABLES.FIELDS}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              table: DB_TABLES.FIELDS,
              data: {
                name: fieldData.name,
                type: fieldData.type,
                primary: fieldData.primary,
                caseid: fieldData.caseid,
                label: fieldData.label,
                description: fieldData.description,
                order: fieldData.order,
                options: fieldData.options,
                required: fieldData.required,
                sampleValue: fieldData.sampleValue,
              },
            }),
          },
        );
        if (!response.ok) throw new Error("Failed to add field");

        const createResult = await response.json();
        const createdField = createResult?.data;
        if (createdField) setFields((prev) => [...prev, createdField]);

        // Refresh fields to ensure consistency
        const fieldsResponse = await fetchWithBaseUrl(
          `/api/database?table=${DB_TABLES.FIELDS}&${DB_COLUMNS.CASE_ID}=${selectedCase.id}`,
        );
        if (fieldsResponse.ok) {
          const fieldsData = await fieldsResponse.json();
          setFields(fieldsData.data);
        }

        // Refresh model
        const composedModel = await fetchCaseData(caseId);
        setModel(composedModel);

        // Notify preview listeners
        window.dispatchEvent(new CustomEvent(eventName));
        return fieldName;
      } catch (error) {
        console.error("Error adding field:", error);
        alert("Failed to add field. Please try again.");
        throw error as Error;
      }
    },
    [selectedCase, setFields, setModel, caseId, eventName, fetchCaseData],
  );

  const handleUpdateField = useCallback(
    async (updates: Partial<Field>) => {
      if (!selectedCase) {
        console.error("Missing required data for field update:", {
          selectedCase: null,
        });
        return;
      }

      const targetFieldId = updates.id;
      const targetField = fields.find((f) => f.id === targetFieldId) || null;
      if (!targetField || !targetField.id) {
        console.error("Missing target field for update");
        return;
      }

      try {
        const requestBody = {
          table: DB_TABLES.FIELDS,
          data: {
            id: targetField.id,
            name: targetField.name,
            label: updates.label || targetField.label,
            type: updates.type || targetField.type,
            primary: updates.primary ?? targetField.primary,
            caseid: selectedCase.id,
            options: (() => {
              if (updates.options !== undefined) return updates.options as any;
              if (targetField.options) {
                if (Array.isArray(targetField.options))
                  return targetField.options as any;
                try {
                  const parsed = JSON.parse(targetField.options as any);
                  return parsed;
                } catch (error) {
                  console.error("Failed to parse options:", error);
                  return [] as any[];
                }
              }
              return [] as any[];
            })(),
            required: updates.required ?? targetField.required,
            order: updates.order ?? targetField.order ?? 0,
            description:
              updates.description ||
              targetField.description ||
              "Field description",
            sampleValue:
              (updates as any).sampleValue !== undefined
                ? (updates as any).sampleValue
                : (targetField as any).sampleValue ?? null,
          },
        };

        const response = await fetch(
          `/api/database?table=${DB_TABLES.FIELDS}&id=${targetField.id}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
          },
        );
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `Failed to update field: ${response.status} ${errorText}`,
          );
        }

        // Refresh model
        const composedModel = await fetchCaseData(caseId);
        setModel(composedModel);

        // Refresh fields
        const fieldsResponse = await fetchWithBaseUrl(
          `/api/database?table=${DB_TABLES.FIELDS}&${DB_COLUMNS.CASE_ID}=${selectedCase.id}`,
        );
        if (fieldsResponse.ok) {
          const fieldsData = await fieldsResponse.json();
          setFields(fieldsData.data);
        }

        // Notify preview listeners
        window.dispatchEvent(new CustomEvent(eventName));
      } catch (error) {
        console.error("Error updating field:", error);
        alert("Failed to update field. Please try again.");
      }
    },
    [
      selectedCase,
      fields,
      setFields,
      setModel,
      caseId,
      eventName,
      fetchCaseData,
    ],
  );

  const handleDeleteField = useCallback(
    async (field: Field) => {
      if (!selectedCase || !field.id) return;

      try {
        const response = await fetch(
          `/api/database?table=${DB_TABLES.FIELDS}&id=${field.id}`,
          {
            method: "DELETE",
          },
        );
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `Failed to delete field: ${response.status} ${errorText}`,
          );
        }

        // Update the case model to remove the field from all steps
        const currentModel = selectedCase.model || {};
        const updatedModel = {
          ...currentModel,
          fields: (currentModel.fields || []).filter(
            (f: Field) => f.id !== field.id,
          ),
          stages: currentModel.stages.map((stage: Stage) => ({
            ...stage,
            processes: stage.processes.map((process: Process) => ({
              ...process,
              steps: process.steps.map((step: Step) => ({
                ...step,
                fields:
                  step.fields?.filter((f: FieldReference) => {
                    const referencedField = fields.find(
                      (fo) => fo.id === f.fieldId,
                    );
                    return referencedField?.name !== field.name;
                  }) || [],
              })),
            })),
          })),
        };

        const updateResponse = await fetch(
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
        if (!updateResponse.ok) {
          throw new Error(`Failed to update case: ${updateResponse.status}`);
        }

        const { data: updatedCase } = await updateResponse.json();
        setSelectedCase(updatedCase);
        setModel(updatedModel);

        // Refresh fields and views after deletion
        const fieldsResponse = await fetchWithBaseUrl(
          `/api/database?table=${DB_TABLES.FIELDS}&${DB_COLUMNS.CASE_ID}=${selectedCase.id}`,
        );
        if (fieldsResponse.ok) {
          const fieldsData = await fieldsResponse.json();
          setFields(fieldsData.data);
        }
        const viewsResponse = await fetchWithBaseUrl(
          `/api/database?table=${DB_TABLES.VIEWS}&${DB_COLUMNS.CASE_ID}=${selectedCase.id}`,
        );
        if (viewsResponse.ok) {
          await viewsResponse.json();
        }

        window.dispatchEvent(new CustomEvent(eventName));
      } catch (error) {
        console.error("Error deleting field:", error);
        alert("Failed to delete field. Please try again.");
      }
    },
    [selectedCase, fields, setFields, setModel, setSelectedCase, eventName],
  );

  return { handleAddField, handleUpdateField, handleDeleteField } as const;
}
