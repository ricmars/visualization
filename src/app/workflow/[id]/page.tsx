"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import WorkflowDiagram from "../../components/WorkflowDiagram";
import ChatInterface, { ChatMessage } from "../../components/ChatInterface";
import { Service } from "../../services/service";
import {
  Stage,
  Field,
  Process,
  Step,
  FieldReference,
  Checkpoint,
  WorkflowModel,
  StepType,
} from "../../types";
import type { View } from "../../types/rules";
import { motion } from "framer-motion";
import { v4 as uuidv4 } from "uuid";
import ViewsPanel from "../../components/ViewsPanel";
import { FaPencilAlt } from "react-icons/fa";
import AddFieldModal from "../../components/AddFieldModal";
import EditFieldModal from "../../components/EditFieldModal";
import { getFieldTypeDisplayName } from "../../utils/fieldTypes";
import ChangesPanel from "../../components/ChangesPanel";
import AddStageModal from "../../components/AddStageModal";
import AddProcessModal from "../../components/AddProcessModal";
import EditWorkflowModal from "../../components/EditWorkflowModal";
import { DB_TABLES, DB_COLUMNS } from "../../types/database";
import { fetchWithBaseUrl } from "../../lib/fetchWithBaseUrl";

const ACTIVE_TAB_STORAGE_KEY = "active_tab";
const ACTIVE_PANEL_TAB_STORAGE_KEY = "active_panel_tab";
const CHECKPOINTS_STORAGE_KEY = "workflow_checkpoints_";
const MAX_CHECKPOINTS = 10;

interface DatabaseCase {
  id: number;
  name: string;
  description: string;
  model: string;
}

interface WorkflowState {
  stages: Stage[];
  fields: Field[];
}

interface ComposedModel {
  name: string;
  description?: string;
  fields: Field[];
  stages: Stage[];
  views: View[];
}

async function fetchCaseData(caseID: string): Promise<ComposedModel> {
  try {
    // Fetch case data
    const caseResponse = await fetchWithBaseUrl(
      `/api/database?table=${DB_TABLES.CASES}&id=${caseID}`,
    );
    if (!caseResponse.ok) {
      throw new Error(`Failed to fetch case: ${caseResponse.status}`);
    }
    const caseData = await caseResponse.json();
    const selectedCase = caseData.data; // Get the case directly, not from an array

    if (!selectedCase) {
      throw new Error("Case not found");
    }

    // Fetch fields for this case
    const fieldsResponse = await fetchWithBaseUrl(
      `/api/database?table=${DB_TABLES.FIELDS}&${DB_COLUMNS.CASE_ID}=${caseID}`,
    );
    if (!fieldsResponse.ok) {
      throw new Error(`Failed to fetch fields: ${fieldsResponse.status}`);
    }
    const fieldsData = await fieldsResponse.json();
    const fields: Field[] = fieldsData.data;

    // Fetch views for this case
    const viewsResponse = await fetchWithBaseUrl(
      `/api/database?table=${DB_TABLES.VIEWS}&${DB_COLUMNS.CASE_ID}=${caseID}`,
    );
    if (!viewsResponse.ok) {
      throw new Error(`Failed to fetch views: ${viewsResponse.status}`);
    }
    const viewsData = await viewsResponse.json();
    const views: View[] = viewsData.data;

    // Parse the model from the case data
    const parsedModel = JSON.parse(selectedCase.model);

    // Link views to steps that reference them
    const stages =
      parsedModel.stages?.map((stage: Stage) => ({
        ...stage,
        processes: stage.processes.map((process: Process) => ({
          ...process,
          steps: process.steps.map((step: Step) => {
            if (step.type === "Collect information" && step.fields) {
              const view = views.find(
                (v: View) => v.id === step.fields?.[0]?.name,
              );
              if (view) {
                return {
                  ...step,
                  fields: view.model.fields.map(
                    (fieldRef: { fieldId: number; required: boolean }) => ({
                      name: fieldRef.fieldId.toString(),
                      required: fieldRef.required,
                    }),
                  ),
                };
              }
            }
            return step;
          }),
        })),
      })) || [];

    // Compose the complete model
    const composedModel: ComposedModel = {
      name: selectedCase.name,
      description: selectedCase.description,
      fields: fields.map((field: Field) => ({
        ...field,
        label: field.name, // Use name as label if not provided
        value: field.value || undefined, // Initialize empty value
      })),
      stages,
      views,
    };

    return composedModel;
  } catch (error) {
    console.error("Error fetching case data:", error);
    throw error;
  }
}

export default function WorkflowPage() {
  // 1. Router and params hooks
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  // 2. All useState hooks
  const [model, setModel] = useState<ComposedModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCase, setSelectedCase] = useState<DatabaseCase | null>(null);
  const [activeStage, setActiveStage] = useState<string>();
  const [activeProcess, setActiveProcess] = useState<string>();
  const [activeStep, setActiveStep] = useState<string>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [chatPanelWidth] = useState(500);
  const [isChatPanelExpanded] = useState(true);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [workflowView, setWorkflowView] = useState<"flat" | "lifecycle">(
    "flat",
  );
  const [activeTab, setActiveTab] = useState<
    "workflow" | "fields" | "views" | "chat" | "changes"
  >("workflow");
  const [activePanelTab, setActivePanelTab] = useState<"chat" | "changes">(
    "chat",
  );
  const [isAddFieldModalOpen, setIsAddFieldModalOpen] = useState(false);
  const [editingField, setEditingField] = useState<Field | null>(null);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [isAddStageModalOpen, setIsAddStageModalOpen] = useState(false);
  const [isAddProcessModalOpen, setIsAddProcessModalOpen] = useState(false);
  const [isEditWorkflowModalOpen, setIsEditWorkflowModalOpen] = useState(false);
  const [selectedStageForProcess, setSelectedStageForProcess] = useState<
    string | null
  >(null);
  const [selectedView, setSelectedView] = useState<string | null>(null);
  const [newStageName, setNewStageName] = useState("");
  const [newProcessName, setNewProcessName] = useState("");

  // 3. All useRef hooks
  const addFieldButtonRef = useRef<HTMLButtonElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  // 4. useMemo hook
  const workflowModel: WorkflowState = useMemo(() => {
    if (!selectedCase || !model) {
      return { stages: [], fields: [] };
    }
    const parsed = JSON.parse(selectedCase.model) as Partial<WorkflowModel>;
    return {
      stages: parsed.stages || [],
      fields: model.fields || [], // Use fields from the composed model instead of parsed model
    };
  }, [selectedCase, model]);

  // 5. All useEffect hooks
  // Load saved tab from localStorage after initial render
  useEffect(() => {
    const savedTab = localStorage.getItem(ACTIVE_TAB_STORAGE_KEY) as
      | "workflow"
      | "fields"
      | "views"
      | "chat"
      | "changes";
    if (savedTab) {
      setActiveTab(savedTab);
    }

    const savedPanelTab = localStorage.getItem(ACTIVE_PANEL_TAB_STORAGE_KEY) as
      | "chat"
      | "changes";
    if (savedPanelTab) {
      setActivePanelTab(savedPanelTab);
    }
  }, []);

  // Save tab to localStorage when it changes
  useEffect(() => {
    localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, activeTab);
  }, [activeTab]);

  // Save panel tab to localStorage when it changes
  useEffect(() => {
    localStorage.setItem(ACTIVE_PANEL_TAB_STORAGE_KEY, activePanelTab);
  }, [activePanelTab]);

  // Load checkpoints from sessionStorage
  useEffect(() => {
    const savedCheckpoints = sessionStorage.getItem(
      CHECKPOINTS_STORAGE_KEY + id,
    );
    if (savedCheckpoints) {
      setCheckpoints(JSON.parse(savedCheckpoints));
    }
  }, [id]);

  // Save checkpoints to sessionStorage
  useEffect(() => {
    if (checkpoints.length > 0) {
      sessionStorage.setItem(
        CHECKPOINTS_STORAGE_KEY + id,
        JSON.stringify(checkpoints),
      );
    }
  }, [checkpoints, id]);

  // Define fetchCase before using it in useEffect
  const fetchCase = useCallback(async () => {
    try {
      const response = await fetchWithBaseUrl(
        `/api/database?table=${DB_TABLES.CASES}&id=${id}`,
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch case: ${response.status}`);
      }
      const data = await response.json();
      setSelectedCase(data.data || null);
    } catch (error) {
      console.error("Error fetching case:", error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Load workflow data function
  const loadWorkflow = async () => {
    try {
      setLoading(true);
      const composedModel = await fetchCaseData(id);
      setModel(composedModel);
      setError(null);
    } catch (err) {
      console.error("Error loading workflow:", err);
      setError(err instanceof Error ? err.message : "Failed to load workflow");
    } finally {
      setLoading(false);
    }
  };

  // Load workflow data
  useEffect(() => {
    loadWorkflow();
  }, [id, fetchCase]);

  // Handle iframe creation
  useEffect(() => {
    const container = previewContainerRef.current;
    if (!container) return;

    const iframe = document.createElement("iframe");
    iframe.src = `/preview/${id}`;
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "none";
    container.appendChild(iframe);

    return () => {
      if (container) {
        container.removeChild(iframe);
      }
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="text-red-500 mb-4">{error}</div>
        <button
          onClick={() => router.push("/")}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
        >
          Back to Home
        </button>
      </div>
    );
  }

  if (!model) {
    return null;
  }

  const handleEditField = (field: Field) => {
    setEditingField(field);
  };

  const handleStepSelect = (
    stageId: string,
    processId: string,
    stepId: string,
  ) => {
    setActiveStage(stageId);
    setActiveProcess(processId);
    setActiveStep(stepId);
  };

  const handleStepsUpdate = async (updatedStages: Stage[]) => {
    if (!selectedCase) return;

    try {
      console.log("=== Starting Steps Update ===");
      console.log("Case ID:", selectedCase.id);
      console.log("Current Model:", {
        name: selectedCase.name,
        description: selectedCase.description,
        stages: model?.stages?.length || 0,
      });
      console.log("Updated Stages:", {
        count: updatedStages.length,
        stages: updatedStages.map((s) => ({
          name: s.name,
          processes: s.processes.length,
          steps: s.processes.reduce((acc, p) => acc + p.steps.length, 0),
        })),
      });

      const updatedModel = {
        ...JSON.parse(selectedCase.model),
        stages: updatedStages,
        name: selectedCase.name,
        views: model?.views || [],
      };

      const requestUrl = `/api/database?table=${DB_TABLES.CASES}&id=${selectedCase.id}`;
      const requestBody = {
        name: selectedCase.name,
        description: selectedCase.description,
        model: JSON.stringify(updatedModel),
      };

      console.log("=== Making Database Update Request ===");
      console.log("Request URL:", requestUrl);
      console.log("Request Method: PUT");
      console.log("Request Body:", {
        ...requestBody,
        model: "Stringified model data (truncated for logging)",
      });

      const response = await fetch(requestUrl, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("=== Database Update Failed ===");
        console.error("Status:", response.status);
        console.error("Status Text:", response.statusText);
        console.error("Error Response:", errorText);
        console.error("Request Details:", {
          url: requestUrl,
          method: "PUT",
          body: requestBody,
        });
        throw new Error(
          `Failed to update case: ${response.status} ${errorText}`,
        );
      }

      const responseData = await response.json();
      console.log("=== Database Update Successful ===");
      console.log("Response Data:", responseData);

      // Update the case and model state
      setSelectedCase({
        ...selectedCase,
        model: JSON.stringify(updatedModel),
      });
      setModel((prev) =>
        prev
          ? {
              ...prev,
              stages: updatedStages,
            }
          : null,
      );

      console.log("=== Local State Updated ===");
      console.log("New Model:", {
        name: selectedCase.name,
        description: selectedCase.description,
        stages: updatedStages.length,
      });
    } catch (error) {
      console.error("=== Error in Steps Update ===");
      console.error("Error:", error);
      console.error(
        "Stack:",
        error instanceof Error ? error.stack : "No stack trace",
      );
      throw error;
    }
  };

  const handleAddField = (field: {
    label: string;
    type: Field["type"];
    options?: string[];
    required?: boolean;
    primary?: boolean;
  }): string => {
    if (!selectedCase) return "";

    // Generate a temporary field ID
    const tempFieldId = `temp-${Date.now()}`;

    // Start the async operation in the background
    (async () => {
      try {
        const fieldData = {
          name: field.label.toLowerCase().replace(/\s+/g, "_"),
          type: field.type,
          label: field.label,
          required: field.required ?? false,
          primary: field.primary ?? false,
          caseID: selectedCase.id,
          description: field.label,
          order: 0,
          options: [],
        };

        console.log("Creating field with data:", fieldData);

        const response = await fetch(
          `/api/database?table=${DB_TABLES.FIELDS}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              table: DB_TABLES.FIELDS,
              data: {
                name: fieldData.name,
                type: fieldData.type,
                primary: fieldData.primary,
                caseID: fieldData.caseID,
                label: fieldData.label,
                description: fieldData.description,
                order: fieldData.order,
                options: fieldData.options,
                required: fieldData.required,
              },
            }),
          },
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error("=== Field Creation Failed ===");
          console.error("Status:", response.status);
          console.error("Status Text:", response.statusText);
          console.error("Error Response:", errorText);
          console.error("Request Data:", {
            table: DB_TABLES.FIELDS,
            data: fieldData,
          });
          throw new Error("Failed to add field");
        }

        const { data } = await response.json();

        // Update the model with the real field ID
        const currentModel = JSON.parse(selectedCase.model);
        const updatedFields = (currentModel.fields || []).map((f: Field) =>
          f.name === tempFieldId ? { ...f, name: data.id } : f,
        );

        const updatedModel = {
          ...currentModel,
          fields: updatedFields,
        };

        // Update the case with the modified model
        const updateResponse = await fetch(
          `/api/database?table=${DB_TABLES.CASES}&id=${selectedCase.id}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              table: DB_TABLES.CASES,
              data: {
                id: selectedCase.id,
                name: selectedCase.name,
                description: selectedCase.description,
                model: JSON.stringify(updatedModel),
              },
            }),
          },
        );

        if (!updateResponse.ok) {
          const errorText = await updateResponse.text();
          console.error("=== Case Update Failed ===");
          console.error("Status:", updateResponse.status);
          console.error("Status Text:", updateResponse.statusText);
          console.error("Error Response:", errorText);
          console.error("Request Data:", {
            table: DB_TABLES.CASES,
            data: {
              id: selectedCase.id,
              name: selectedCase.name,
              description: selectedCase.description,
              model: JSON.stringify(updatedModel),
            },
          });
          throw new Error(
            `Failed to update case: ${updateResponse.status} ${errorText}`,
          );
        }

        // Refresh the model
        const composedModel = await fetchCaseData(id);
        setModel(composedModel);
      } catch (error) {
        console.error("Error adding field:", error);
        alert("Failed to add field. Please try again.");
      }
    })();

    return tempFieldId;
  };

  const handleUpdateField = async (updates: Partial<Field>) => {
    if (!selectedCase || !editingField || !editingField.id) {
      console.error("Missing required data for field update:", {
        selectedCase,
        editingField,
      });
      return;
    }

    try {
      // First update the field in the fields table
      const response = await fetch(
        `/api/database?table=${DB_TABLES.FIELDS}&id=${editingField.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            table: DB_TABLES.FIELDS,
            data: {
              id: editingField.id,
              name: editingField.name,
              label: updates.label || editingField.label,
              type: updates.type || editingField.type,
              primary: updates.primary ?? editingField.primary,
              caseID: selectedCase.id,
              options: updates.options || editingField.options || [],
              required: updates.required ?? editingField.required,
              order: updates.order ?? editingField.order ?? 0,
              description:
                updates.description ||
                editingField.description ||
                "Field description",
            },
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("=== Field Update Failed ===");
        console.error("Status:", response.status);
        console.error("Status Text:", response.statusText);
        console.error("Error Response:", errorText);
        throw new Error(
          `Failed to update field: ${response.status} ${errorText}`,
        );
      }

      // Refresh the model to get updated fields
      const composedModel = await fetchCaseData(id);
      setModel(composedModel);
      setEditingField(null);
    } catch (error) {
      console.error("Error updating field:", error);
      alert("Failed to update field. Please try again.");
    }
  };

  const handleDeleteField = async (field: Field) => {
    if (!selectedCase || !field.id) return;

    try {
      // First delete the field from the fields table
      const response = await fetch(
        `/api/database?table=${DB_TABLES.FIELDS}&id=${field.id}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("=== Field Deletion Failed ===");
        console.error("Status:", response.status);
        console.error("Status Text:", response.statusText);
        console.error("Error Response:", errorText);
        throw new Error(
          `Failed to delete field: ${response.status} ${errorText}`,
        );
      }

      // Update the case model to remove the field from all steps and views
      const currentModel = JSON.parse(selectedCase.model);
      const updatedModel = {
        ...currentModel,
        fields: currentModel.fields.filter((f: Field) => f.id !== field.id),
        stages: currentModel.stages.map((stage: Stage) => ({
          ...stage,
          processes: stage.processes.map((process: Process) => ({
            ...process,
            steps: process.steps.map((step: Step) => ({
              ...step,
              fields:
                step.fields?.filter((f: FieldReference) => f.id !== field.id) ||
                [],
            })),
          })),
        })),
      };

      // Update the case with the modified model
      const updateResponse = await fetch(
        `/api/database?table=${DB_TABLES.CASES}&id=${selectedCase.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            table: DB_TABLES.CASES,
            data: {
              id: selectedCase.id,
              name: selectedCase.name,
              description: selectedCase.description,
              model: JSON.stringify(updatedModel),
            },
          }),
        },
      );

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        console.error("=== Case Update Failed ===");
        console.error("Status:", updateResponse.status);
        console.error("Status Text:", updateResponse.statusText);
        console.error("Error Response:", errorText);
        console.error("Request Data:", {
          table: DB_TABLES.CASES,
          data: {
            id: selectedCase.id,
            name: selectedCase.name,
            description: selectedCase.description,
            model: JSON.stringify(updatedModel),
          },
        });
        throw new Error(
          `Failed to update case: ${updateResponse.status} ${errorText}`,
        );
      }

      // Refresh the model
      const composedModel = await fetchCaseData(id);
      setModel(composedModel);
    } catch (error) {
      console.error("Error deleting field:", error);
      alert("Failed to delete field. Please try again.");
    }
  };

  const handleAddStage = async (stageData: { name: string }) => {
    if (!selectedCase) return;

    const newStage: Stage = {
      id: Date.now(),
      name: stageData.name,
      processes: [],
    };

    const updatedStages = [...workflowModel.stages, newStage];
    const updatedModel = {
      ...workflowModel,
      stages: updatedStages,
      name: selectedCase.name,
      views: model?.views || [],
    };

    addCheckpoint(`Added stage: ${stageData.name}`, updatedModel);

    try {
      const requestUrl = `/api/database?table=${DB_TABLES.CASES}&id=${selectedCase.id}`;
      const requestBody = {
        name: selectedCase.name,
        description: selectedCase.description,
        model: JSON.stringify(updatedModel),
      };

      console.log("=== Making Database Update Request ===");
      console.log("Request URL:", requestUrl);
      console.log("Request Method: PUT");
      console.log("Request Body:", {
        ...requestBody,
        model: "Stringified model data (truncated for logging)",
      });

      const response = await fetch(requestUrl, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("=== Database Update Failed ===");
        console.error("Status:", response.status);
        console.error("Status Text:", response.statusText);
        console.error("Error Response:", errorText);
        console.error("Request Details:", {
          url: requestUrl,
          method: "PUT",
          body: requestBody,
        });
        throw new Error(`Failed to add stage: ${response.status} ${errorText}`);
      }

      const { data: updatedCase } = await response.json();
      setSelectedCase(updatedCase);
      setIsAddStageModalOpen(false);
    } catch (error) {
      console.error("Error adding stage:", error);
      throw new Error("Failed to add stage");
    }
  };

  const handleAddProcess = async (stageId: number, processName: string) => {
    if (!selectedCase || !model) return;

    const updatedStages = workflowModel.stages.map((stage) =>
      stage.id === stageId
        ? {
            ...stage,
            processes: [
              ...stage.processes,
              {
                id: Date.now(),
                name: processName,
                steps: [],
              },
            ],
          }
        : stage,
    );
    const updatedModel: ComposedModel = {
      name: selectedCase.name,
      description: selectedCase.description,
      fields: model.fields,
      stages: updatedStages,
      views: model.views,
    };
    addCheckpoint(`Added process: ${processName}`, updatedModel);

    try {
      const requestUrl = `/api/database?table=${DB_TABLES.CASES}&id=${selectedCase.id}`;
      const requestBody = {
        name: selectedCase.name,
        description: selectedCase.description,
        model: JSON.stringify(updatedModel),
      };

      console.log("=== Making Database Update Request ===");
      console.log("Request URL:", requestUrl);
      console.log("Request Method: PUT");
      console.log("Request Body:", {
        ...requestBody,
        model: "Stringified model data (truncated for logging)",
      });

      const response = await fetch(requestUrl, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("=== Database Update Failed ===");
        console.error("Status:", response.status);
        console.error("Status Text:", response.statusText);
        console.error("Error Response:", errorText);
        console.error("Request Details:", {
          url: requestUrl,
          method: "PUT",
          body: requestBody,
        });
        throw new Error(
          `Failed to add process: ${response.status} ${errorText}`,
        );
      }

      const { data: updatedCase } = await response.json();
      setSelectedCase(updatedCase);
      setModel(updatedModel);
    } catch (error) {
      console.error("Error adding process:", error);
      throw new Error("Failed to add process");
    }
  };

  const handleAddStep = async (
    stageId: number,
    processId: number,
    stepName: string,
    stepType: StepType,
  ) => {
    if (!selectedCase) return;

    const newStep: Step = {
      id: Date.now(),
      name: stepName,
      type: stepType,
      fields: [],
    };

    const updatedStages = workflowModel.stages.map((stage) =>
      stage.id === stageId
        ? {
            ...stage,
            processes: stage.processes.map((process) =>
              process.id === processId
                ? {
                    ...process,
                    steps: [...process.steps, newStep],
                  }
                : process,
            ),
          }
        : stage,
    );

    const updatedModel = {
      ...workflowModel,
      stages: updatedStages,
    };

    addCheckpoint(`Added step: ${stepName}`, updatedModel);

    try {
      const response = await fetch(
        `/api/database?table=${DB_TABLES.CASES}&id=${selectedCase.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: selectedCase.name,
            description: selectedCase.description,
            model: JSON.stringify(updatedModel),
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to add step: ${response.status}`);
      }

      const { data: updatedCase } = await response.json();
      setSelectedCase(updatedCase);
    } catch (error) {
      console.error("Error adding step:", error);
      throw error;
    }
  };

  const handleDeleteStep = async (
    stageId: number,
    processId: number,
    stepId: number,
  ) => {
    if (!selectedCase) return;

    const updatedStages = workflowModel.stages.map((stage) =>
      stage.id === stageId
        ? {
            ...stage,
            processes: stage.processes.map((process) =>
              process.id === processId
                ? {
                    ...process,
                    steps: process.steps.filter((step) => step.id !== stepId),
                  }
                : process,
            ),
          }
        : stage,
    );

    const updatedModel = {
      ...workflowModel,
      stages: updatedStages,
    };

    addCheckpoint("Deleted step", updatedModel);

    try {
      const response = await fetch(
        `/api/database?table=${DB_TABLES.CASES}&id=${selectedCase.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: selectedCase.name,
            description: selectedCase.description,
            model: JSON.stringify(updatedModel),
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to delete step: ${response.status}`);
      }

      const { data: updatedCase } = await response.json();
      setSelectedCase(updatedCase);
    } catch (error) {
      console.error("Error deleting step:", error);
      throw error;
    }
  };

  const handleDeleteProcess = async (stageId: number, processId: number) => {
    if (!selectedCase) return;

    const updatedStages = workflowModel.stages.map((stage) =>
      stage.id === stageId
        ? {
            ...stage,
            processes: stage.processes.filter(
              (process) => process.id !== processId,
            ),
          }
        : stage,
    );

    const updatedModel = {
      ...workflowModel,
      stages: updatedStages,
    };

    addCheckpoint("Deleted process", updatedModel);

    try {
      const response = await fetch(
        `/api/database?table=${DB_TABLES.CASES}&id=${selectedCase.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: selectedCase.name,
            description: selectedCase.description,
            model: JSON.stringify(updatedModel),
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to delete process: ${response.status}`);
      }

      const { data: updatedCase } = await response.json();
      setSelectedCase(updatedCase);
    } catch (error) {
      console.error("Error deleting process:", error);
      throw error;
    }
  };

  const handleDeleteStage = async (stageId: number) => {
    if (!selectedCase) return;

    const updatedStages = workflowModel.stages.filter(
      (stage) => stage.id !== stageId,
    );

    const updatedModel = {
      ...workflowModel,
      stages: updatedStages,
    };

    addCheckpoint("Deleted stage", updatedModel);

    try {
      const response = await fetch(
        `/api/database?table=${DB_TABLES.CASES}&id=${selectedCase.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: selectedCase.name,
            description: selectedCase.description,
            model: JSON.stringify(updatedModel),
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to delete stage: ${response.status}`);
      }

      const { data: updatedCase } = await response.json();
      setSelectedCase(updatedCase);
    } catch (error) {
      console.error("Error deleting stage:", error);
      throw error;
    }
  };

  const handleSendMessage = async (message: string) => {
    try {
      setIsProcessing(true);

      // Add user message immediately
      setMessages((prev) => [
        ...prev,
        {
          id: uuidv4(),
          content: message,
          sender: "user",
          timestamp: new Date(),
        },
      ]);

      // Add a placeholder AI message that will be updated with the response
      const aiMessageId = uuidv4();
      setMessages((prev) => [
        ...prev,
        {
          id: aiMessageId,
          content: "",
          sender: "assistant",
          timestamp: new Date(),
        },
      ]);

      const response = await Service.generateResponse(
        message,
        selectedCase
          ? JSON.stringify({
              name: selectedCase.name,
              stages: workflowModel.stages,
              fields: workflowModel.fields,
            })
          : "",
      );

      if (!response.ok) {
        throw new Error(`Failed to generate response: ${response.statusText}`);
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body available");
      }

      const decoder = new TextDecoder();
      let accumulatedContent = "";

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
                  accumulatedContent += data.text;
                  // Update the AI message with accumulated content
                  setMessages((prev) => {
                    const newMessages = [...prev];
                    const aiMessageIndex = newMessages.findIndex(
                      (msg) => msg.id === aiMessageId,
                    );
                    if (aiMessageIndex !== -1) {
                      newMessages[aiMessageIndex] = {
                        ...newMessages[aiMessageIndex],
                        content: accumulatedContent,
                      };
                    }
                    return newMessages;
                  });
                }

                if (data.error) {
                  console.error("Streaming error:", data.error);
                  setMessages((prev) => [
                    ...prev,
                    {
                      id: uuidv4(),
                      content: `Error: ${data.error}`,
                      sender: "assistant",
                      timestamp: new Date(),
                    },
                  ]);
                }

                if (data.done) {
                  // Reload the workflow data if tools were executed
                  if (accumulatedContent.includes("Successfully executed")) {
                    await loadWorkflow();
                  }
                  break;
                }
              } catch (_parseError) {
                console.warn("Failed to parse SSE data:", line);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: uuidv4(),
          content: "Sorry, there was an error processing your request.",
          sender: "assistant",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClearChat = () => {
    setMessages([]);
  };

  const handleClearCheckpoints = () => {
    if (
      confirm(
        "Are you sure you want to clear all changes history? This cannot be undone.",
      )
    ) {
      setCheckpoints([]);
      sessionStorage.removeItem(CHECKPOINTS_STORAGE_KEY + id);
    }
  };

  const addCheckpoint = (description: string, model: WorkflowModel) => {
    const newCheckpoint: Checkpoint = {
      id: parseInt(uuidv4().replace(/-/g, ""), 16),
      timestamp: new Date().toISOString(),
      description,
      model,
    };

    setCheckpoints((prev) => {
      const updated = [newCheckpoint, ...prev].slice(0, MAX_CHECKPOINTS);
      return updated;
    });
  };

  const handleRestoreCheckpoint = (checkpoint: Checkpoint) => {
    if (
      confirm(
        "Are you sure you want to restore this checkpoint? All changes after this point will be lost.",
      )
    ) {
      setSelectedCase((prev) =>
        prev
          ? {
              ...prev,
              model: JSON.stringify(checkpoint.model),
            }
          : null,
      );

      // Remove all checkpoints after the restored one
      const checkpointIndex = checkpoints.findIndex(
        (c) => c.id === checkpoint.id,
      );
      setCheckpoints((prev) => prev.slice(checkpointIndex));
    }
  };

  const handleEditWorkflow = async (data: {
    name: string;
    description: string;
  }) => {
    if (!selectedCase) return;

    // Parse the model string into an object
    const model = JSON.parse(selectedCase.model);

    const requestBody = {
      name: data.name,
      description: data.description,
      model: JSON.stringify(model),
    };

    try {
      console.log("[DEBUG] Sending request to /api/database:", requestBody);

      const response = await fetch(
        `/api/database?table=${DB_TABLES.CASES}&id=${selectedCase.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        },
      );

      console.log("[DEBUG] Response status:", response.status);
      console.log(
        "[DEBUG] Response headers:",
        Object.fromEntries(response.headers.entries()),
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.log("[DEBUG] Response body:", errorText);
        throw new Error(
          `Failed to update workflow: ${response.status} ${errorText}`,
        );
      }

      const responseData = await response.json();
      console.log("[DEBUG] Response data:", responseData);

      // Update the workflow in the list
      setSelectedCase(responseData.data);

      // Close the modal
      setIsEditWorkflowModalOpen(false);
    } catch (error) {
      console.error("[ERROR] Failed to update workflow. Full details:", {
        status: error instanceof Error ? error.message : "Unknown error",
        requestBody,
        headers: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  };

  const handleStageReorder = (startIndex: number, endIndex: number) => {
    const stages = [...workflowModel.stages];
    const [removed] = stages.splice(startIndex, 1);
    stages.splice(endIndex, 0, removed);
    const updatedModel = { ...workflowModel, stages };
    addCheckpoint("Reordered stages", updatedModel);
    handleStepsUpdate(stages);
  };

  const handleProcessReorder = (
    stageId: number,
    startIndex: number,
    endIndex: number,
  ) => {
    const updatedStages = workflowModel.stages.map((stage) => {
      if (stage.id === stageId) {
        const processes = [...stage.processes];
        const [removed] = processes.splice(startIndex, 1);
        processes.splice(endIndex, 0, removed);
        return { ...stage, processes };
      }
      return stage;
    });
    handleStepsUpdate(updatedStages);
  };

  const handleStepReorder = (
    stageId: number,
    processId: number,
    startIndex: number,
    endIndex: number,
  ) => {
    const updatedStages = workflowModel.stages.map((stage) => {
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
    handleStepsUpdate(updatedStages);
  };

  const handleAddExistingFieldToStep = async (
    stepId: string,
    fieldIds: string[],
  ) => {
    if (!selectedCase) return;

    try {
      // Find the step in the stages and add the field reference
      const updatedStages = workflowModel.stages.map((stage: Stage) => ({
        ...stage,
        processes: stage.processes.map((process: Process) => ({
          ...process,
          steps: process.steps.map((step: Step) => {
            if (step.name === stepId && step.type === "Collect information") {
              // Get existing fields
              const existingFields = step.fields || [];

              // Create a map of existing fields to preserve their properties
              const existingFieldsMap = new Map(
                existingFields.map((field) => [field.name, field]),
              );

              // Add new fields while preserving existing ones
              fieldIds.forEach((fieldId) => {
                if (!existingFieldsMap.has(fieldId)) {
                  existingFieldsMap.set(fieldId, {
                    name: fieldId,
                    required: false,
                  });
                }
              });

              // Convert map back to array, maintaining order of fieldIds
              return {
                ...step,
                fields: fieldIds.map(
                  (fieldId) => existingFieldsMap.get(fieldId)!,
                ),
              };
            }
            return step;
          }),
        })),
      }));

      const updatedModel = {
        ...workflowModel,
        stages: updatedStages,
        name: selectedCase.name,
        views: model?.views || [],
      };

      addCheckpoint(`Updated step fields: ${stepId}`, updatedModel);

      const response = await fetch(
        `/api/database?table=${DB_TABLES.CASES}&id=${selectedCase.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            table: DB_TABLES.CASES,
            data: {
              id: selectedCase.id,
              name: selectedCase.name,
              description: selectedCase.description,
              model: JSON.stringify(updatedModel),
            },
          }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to update step fields");
      }

      const { data: updatedCase } = await response.json();
      setSelectedCase(updatedCase);
    } catch (error) {
      console.error("Error updating step fields:", error);
      alert("Failed to update step fields. Please try again.");
    }
  };

  const handleFieldsReorder = (stepId: string, fieldIds: string[]) => {
    if (!selectedCase) return;

    const updatedStages = workflowModel.stages.map((stage: Stage) => ({
      ...stage,
      processes: stage.processes.map((process: Process) => ({
        ...process,
        steps: process.steps.map((step: Step) => {
          if (step.name === stepId && step.type === "Collect information") {
            // Ensure unique field references
            const uniqueFieldIds = Array.from(new Set(fieldIds));
            return {
              ...step,
              fields: uniqueFieldIds.map((fieldId) => ({
                name: fieldId,
                required:
                  step.fields?.find((f: FieldReference) => f.name === fieldId)
                    ?.required ?? false,
              })),
            };
          }
          return step;
        }),
      })),
    }));

    handleStepsUpdate(updatedStages);
  };

  return (
    <div className="flex h-screen bg-white dark:bg-gray-900">
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header row with title and preview switch */}
        <div className="flex justify-between items-center p-6 pb-3 pr-[200px]">
          <div className="flex items-center">
            <button
              onClick={() => router.push("/")}
              className="flex items-center text-gray-600 hover:text-gray-900 mr-4"
            >
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              Back to Cases
            </button>
            <div className="flex items-center">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                {selectedCase?.name || "Loading..."}
              </h1>
              {selectedCase && (
                <button
                  onClick={() => setIsEditWorkflowModalOpen(true)}
                  className="ml-3 p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                  aria-label="Edit workflow"
                >
                  <FaPencilAlt className="w-4 h-4 text-gray-500" />
                </button>
              )}
            </div>
          </div>
          <label className="flex items-center cursor-pointer group">
            <div className="relative">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={isPreviewMode}
                onChange={() => setIsPreviewMode(!isPreviewMode)}
              />
              <div className="block bg-gray-200 dark:bg-gray-700 w-14 h-8 rounded-full transition-colors duration-200 ease-in-out peer-checked:bg-blue-600 dark:peer-checked:bg-blue-500 group-hover:bg-gray-300 dark:group-hover:bg-gray-600 peer-checked:group-hover:bg-blue-700 dark:peer-checked:group-hover:bg-blue-600 peer-focus:ring-2 peer-focus:ring-blue-500 peer-focus:ring-offset-2 dark:peer-focus:ring-offset-gray-900"></div>
              <div
                className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-all duration-200 ease-in-out shadow-sm peer-checked:translate-x-6 peer-checked:bg-white group-hover:scale-95`}
              ></div>
            </div>
            <div
              className={`ml-3 text-sm font-medium transition-colors duration-200 ${
                isPreviewMode
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-gray-700 dark:text-gray-300"
              }`}
            >
              Preview
            </div>
          </label>
        </div>

        {/* Tabs - Only show when not in preview mode */}
        {!isPreviewMode && (
          <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-700">
            <div className="flex">
              <button
                onClick={() => setActiveTab("workflow")}
                className={`px-4 py-2 text-sm font-medium ${
                  activeTab === "workflow"
                    ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                }`}
              >
                Workflow
              </button>
              <button
                onClick={() => setActiveTab("fields")}
                className={`px-4 py-2 text-sm font-medium ${
                  activeTab === "fields"
                    ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                }`}
              >
                Fields
              </button>
              <button
                onClick={() => setActiveTab("views")}
                className={`px-4 py-2 text-sm font-medium ${
                  activeTab === "views"
                    ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                }`}
              >
                Views
              </button>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 overflow-auto">
          {isPreviewMode ? (
            <div className="w-full h-full" ref={previewContainerRef} />
          ) : (
            <>
              {activeTab === "workflow" && (
                <>
                  <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                        <button
                          onClick={() => setWorkflowView("flat")}
                          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                            workflowView === "flat"
                              ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                          }`}
                        >
                          Flat View
                        </button>
                        <button
                          onClick={() => setWorkflowView("lifecycle")}
                          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                            workflowView === "lifecycle"
                              ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                          }`}
                        >
                          Lifecycle View
                        </button>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsAddStageModalOpen(true)}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                    >
                      Add Stage
                    </button>
                  </div>
                  {workflowView === "flat" ? (
                    <WorkflowDiagram
                      stages={workflowModel.stages}
                      fields={workflowModel.fields}
                      onStepSelect={(stageId, processId, stepId) =>
                        handleStepSelect(
                          String(stageId),
                          String(processId),
                          String(stepId),
                        )
                      }
                      activeStage={
                        activeStage ? Number(activeStage) : undefined
                      }
                      activeProcess={
                        activeProcess ? Number(activeProcess) : undefined
                      }
                      activeStep={activeStep ? Number(activeStep) : undefined}
                      onStepsUpdate={handleStepsUpdate}
                      onDeleteStage={handleDeleteStage}
                      onDeleteProcess={(stageId, processId) =>
                        handleDeleteProcess(Number(stageId), Number(processId))
                      }
                      onDeleteStep={(stageId, processId, stepId) =>
                        handleDeleteStep(
                          Number(stageId),
                          Number(processId),
                          Number(stepId),
                        )
                      }
                      onAddField={handleAddField}
                      onUpdateField={handleUpdateField}
                      onDeleteField={handleDeleteField}
                      onAddProcess={(stageId, processName) =>
                        handleAddProcess(Number(stageId), processName)
                      }
                      onAddStep={(stageId, processId, stepName, stepType) =>
                        handleAddStep(
                          Number(stageId),
                          Number(processId),
                          stepName,
                          stepType,
                        )
                      }
                      onStageReorder={handleStageReorder}
                      onProcessReorder={handleProcessReorder}
                      onStepReorder={handleStepReorder}
                    />
                  ) : (
                    <div className="p-6">
                      <div className="text-center text-gray-500">
                        Lifecycle view is currently under development
                      </div>
                    </div>
                  )}
                </>
              )}
              {activeTab === "fields" && (
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                      Fields
                    </h2>
                    <button
                      ref={addFieldButtonRef}
                      onClick={() => setIsAddFieldModalOpen(true)}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                    >
                      Add Field
                    </button>
                  </div>
                  <div className="grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-4">
                    {workflowModel.fields
                      .sort((a, b) => a.label.localeCompare(b.label))
                      .map((field) => (
                        <div
                          key={field.name}
                          className="p-4 rounded-lg border border-gray-200 dark:border-gray-700"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium text-gray-900 dark:text-gray-100">
                                {field.label}
                              </h3>
                              {field.primary && (
                                <span className="px-1.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 rounded">
                                  Primary
                                </span>
                              )}
                            </div>
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => handleEditField(field)}
                                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                              >
                                <FaPencilAlt className="w-4 h-4 text-gray-500" />
                              </button>
                              <button
                                onClick={() => handleDeleteField(field)}
                                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                              >
                                <svg
                                  className="w-4 h-4 text-gray-500"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                  />
                                </svg>
                              </button>
                            </div>
                          </div>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Type: {getFieldTypeDisplayName(field.type)}
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              )}
              {activeTab === "views" && (
                <ViewsPanel
                  stages={workflowModel.stages}
                  fields={workflowModel.fields}
                  onAddField={handleAddField}
                  onUpdateField={handleUpdateField}
                  onDeleteField={handleDeleteField}
                  onAddExistingFieldToStep={handleAddExistingFieldToStep}
                  onFieldsReorder={handleFieldsReorder}
                  onViewSelect={setSelectedView}
                  selectedView={selectedView}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Chat Panel */}
      <motion.div
        className="border-l dark:border-gray-700 flex flex-col h-screen overflow-hidden"
        animate={{
          width: isChatPanelExpanded ? `${chatPanelWidth}px` : "0px",
          opacity: isChatPanelExpanded ? 1 : 0,
        }}
        transition={{ duration: 0.3 }}
        style={{
          minWidth: isChatPanelExpanded ? "300px" : "0px",
          maxWidth: "800px",
        }}
      >
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Chat Panel Tabs */}
          <div className="border-b border-gray-200 dark:border-gray-700">
            <div className="flex">
              <button
                onClick={() => setActivePanelTab("chat")}
                className={`flex-1 px-4 py-2 text-sm font-medium ${
                  activePanelTab === "chat"
                    ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                }`}
              >
                Chat
              </button>
              <button
                onClick={() => setActivePanelTab("changes")}
                className={`flex-1 px-4 py-2 text-sm font-medium ${
                  activePanelTab === "changes"
                    ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                }`}
              >
                Changes
              </button>
            </div>
          </div>

          {/* Chat Panel Content */}
          <div className="flex-1 overflow-hidden">
            {activePanelTab === "chat" ? (
              <ChatInterface
                messages={messages}
                onSendMessage={handleSendMessage}
                onClear={handleClearChat}
                isProcessing={isProcessing}
                isLoading={false}
              />
            ) : (
              <ChangesPanel
                checkpoints={checkpoints}
                onRestoreCheckpoint={handleRestoreCheckpoint}
                onClearCheckpoints={handleClearCheckpoints}
              />
            )}
          </div>
        </div>
      </motion.div>

      {/* Modals */}
      <AddFieldModal
        isOpen={isAddFieldModalOpen}
        onClose={() => setIsAddFieldModalOpen(false)}
        onAddField={handleAddField}
        buttonRef={addFieldButtonRef as React.RefObject<HTMLButtonElement>}
        allowExistingFields={false}
      />
      {editingField && (
        <EditFieldModal
          isOpen={!!editingField}
          onClose={() => setEditingField(null)}
          onSubmit={handleUpdateField}
          field={editingField}
        />
      )}
      <AddStageModal
        isOpen={isAddStageModalOpen}
        onClose={() => setIsAddStageModalOpen(false)}
        onAddStage={handleAddStage}
      >
        <input
          type="text"
          value={newStageName}
          onChange={(e) => setNewStageName(e.target.value)}
          placeholder="Enter stage name"
          className="w-full px-3 py-2 border rounded-lg"
          data-testid="stage-name-input"
        />
      </AddStageModal>
      <AddProcessModal
        isOpen={isAddProcessModalOpen}
        onClose={() => {
          setIsAddProcessModalOpen(false);
          setSelectedStageForProcess(null);
        }}
        onAddProcess={(processData: { name: string }) => {
          if (selectedStageForProcess) {
            handleAddProcess(Number(selectedStageForProcess), processData.name);
          }
        }}
      >
        <input
          type="text"
          value={newProcessName}
          onChange={(e) => setNewProcessName(e.target.value)}
          placeholder="Enter process name"
          className="w-full px-3 py-2 border rounded-lg"
          data-testid="process-name-input"
        />
      </AddProcessModal>
      <EditWorkflowModal
        isOpen={isEditWorkflowModalOpen}
        onClose={() => setIsEditWorkflowModalOpen(false)}
        onSubmit={handleEditWorkflow}
        initialData={{
          name: selectedCase?.name || "",
          description: selectedCase?.description || "",
        }}
      />
    </div>
  );
}
