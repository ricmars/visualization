"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import WorkflowDiagram from "../../components/WorkflowDiagram";
import ChatInterface, { ChatMessage } from "../../components/ChatInterface";
import { Service } from "../../services/service";
import {
  Field,
  FieldReference,
  Stage,
  Process,
  Step,
  WorkflowModel,
  StepType,
  Checkpoint,
} from "../../types";
import { motion } from "framer-motion";
import { v4 as uuidv4 } from "uuid";
import ViewsPanel from "../../components/ViewsPanel";
import FieldsList from "../../components/FieldsList";
import { FaPencilAlt } from "react-icons/fa";
import AddFieldModal from "../../components/AddFieldModal";
import EditFieldModal from "../../components/EditFieldModal";
import { DB_TABLES, DB_COLUMNS } from "../../types/database";
import { fetchWithBaseUrl } from "../../lib/fetchWithBaseUrl";
import ChangesPanel from "../../components/ChangesPanel";
import AddStageModal from "../../components/AddStageModal";
import AddProcessModal from "../../components/AddProcessModal";
import EditWorkflowModal from "../../components/EditWorkflowModal";

// Add ToolResult type for tool result objects
export type ToolResult = {
  id?: number;
  name?: string;
};

// Add FieldWithType type for fields with a 'type' property
export type FieldWithType = {
  type: string;
};

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
}

interface ComposedModel {
  name: string;
  description?: string;
  stages: Stage[];
}

// Local View interface for this component
interface View {
  id: number;
  name: string;
  model: string;
  caseID: number;
}

// Helper function to validate that all stages, processes, and steps have IDs
function validateModelIds(stages: Partial<Stage>[]): Stage[] {
  return stages.map((stage, stageIndex) => {
    if (!stage.id) {
      throw new Error(`Stage at index ${stageIndex} is missing an ID`);
    }

    return {
      ...stage,
      processes: (stage.processes || []).map(
        (process: Partial<Process>, processIndex: number) => {
          if (!process.id) {
            throw new Error(
              `Process at index ${processIndex} in stage "${stage.name}" is missing an ID`,
            );
          }

          return {
            ...process,
            steps: (process.steps || []).map(
              (step: Partial<Step>, stepIndex: number) => {
                if (!step.id) {
                  throw new Error(
                    `Step at index ${stepIndex} in process "${process.name}" of stage "${stage.name}" is missing an ID`,
                  );
                }
                return step as Step;
              },
            ),
          } as Process;
        },
      ),
    } as Stage;
  });
}

async function fetchCaseData(caseID: string): Promise<ComposedModel> {
  try {
    // Fetch the case data
    const caseResponse = await fetchWithBaseUrl(
      `/api/database?table=${DB_TABLES.CASES}&id=${caseID}`,
    );
    if (!caseResponse.ok) {
      throw new Error(`Failed to fetch case: ${caseResponse.status}`);
    }
    const caseData = await caseResponse.json();
    const selectedCase: DatabaseCase = caseData.data;

    if (!selectedCase) {
      throw new Error("Case not found");
    }

    // Parse the model from the case data
    const parsedModel = JSON.parse(selectedCase.model);

    // Validate that all stages, processes, and steps have IDs
    const stagesWithIds = validateModelIds(parsedModel.stages || []);

    // Compose the complete model
    const composedModel: ComposedModel = {
      name: selectedCase.name,
      description: selectedCase.description,
      stages: stagesWithIds,
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
  const [fields, setFields] = useState<Field[]>([]);
  const [views, setViews] = useState<View[]>([]);
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
  const [newProcessName, setNewProcessName] = useState("");

  // 3. All useRef hooks
  const addFieldButtonRef = useRef<HTMLButtonElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  // 4. useMemo hook
  const workflowModel: WorkflowState = useMemo(() => {
    if (!model) {
      return { stages: [] };
    }

    return {
      stages: model.stages || [],
    };
  }, [model]);

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
  const loadWorkflow = useCallback(async () => {
    try {
      setLoading(true);
      const composedModel = await fetchCaseData(id);
      setModel(composedModel);

      // Load fields separately
      const fieldsResponse = await fetchWithBaseUrl(
        `/api/database?table=${DB_TABLES.FIELDS}&${DB_COLUMNS.CASE_ID}=${id}`,
      );
      let fieldsData: Field[] = [];
      if (fieldsResponse.ok) {
        const fieldsResult = await fieldsResponse.json();
        fieldsData = fieldsResult.data;
        setFields(fieldsData);
      }

      // Load views separately
      const viewsResponse = await fetchWithBaseUrl(
        `/api/database?table=${DB_TABLES.VIEWS}&${DB_COLUMNS.CASE_ID}=${id}`,
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
  }, [id]);

  // Load workflow data
  useEffect(() => {
    fetchCase();
    loadWorkflow();
  }, [id, fetchCase, loadWorkflow]);

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
              stages: updatedModel.stages,
            }
          : null,
      );

      console.log("=== Local State Updated ===");
      console.log("New Model:", {
        name: selectedCase.name,
        description: selectedCase.description,
        stages: updatedModel.stages.length,
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

    // Generate the actual field name
    const fieldName = field.label.toLowerCase().replace(/\s+/g, "_");

    // Start the async operation in the background
    (async () => {
      try {
        const fieldData = {
          name: fieldName,
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

        // Refresh the fields state
        const fieldsResponse = await fetchWithBaseUrl(
          `/api/database?table=${DB_TABLES.FIELDS}&${DB_COLUMNS.CASE_ID}=${selectedCase.id}`,
        );
        if (fieldsResponse.ok) {
          const fieldsData = await fieldsResponse.json();
          setFields(fieldsData.data);
        }

        // Refresh the model
        const composedModel = await fetchCaseData(id);
        setModel(composedModel);
      } catch (error) {
        console.error("Error adding field:", error);
        alert("Failed to add field. Please try again.");
      }
    })();

    return fieldName;
  };

  const handleUpdateField = async (updates: Partial<Field>) => {
    if (!selectedCase || !editingField || !editingField.id) {
      console.error("Missing required data for field update:", {
        selectedCase: selectedCase
          ? { id: selectedCase.id, name: selectedCase.name }
          : null,
        editingField: editingField
          ? {
              id: editingField.id,
              name: editingField.name,
              label: editingField.label,
              type: editingField.type,
            }
          : null,
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
                    (fieldObj) => fieldObj.id === f.fieldId,
                  );
                  return referencedField?.name !== field.name;
                }) || [],
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

      // Update local state immediately
      setSelectedCase({
        ...selectedCase,
        model: JSON.stringify(updatedModel),
      });
      setModel((prev) =>
        prev
          ? {
              ...prev,
              stages: updatedModel.stages,
            }
          : null,
      );

      // Refresh the fields state
      const fieldsResponse = await fetchWithBaseUrl(
        `/api/database?table=${DB_TABLES.FIELDS}&${DB_COLUMNS.CASE_ID}=${selectedCase.id}`,
      );
      if (fieldsResponse.ok) {
        const fieldsData = await fieldsResponse.json();
        setFields(fieldsData.data);
      }
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
    const updatedModel: ComposedModel = {
      name: selectedCase.name,
      description: selectedCase.description,
      stages: updatedStages,
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
      stages: updatedStages,
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
      // Update the model state to reflect the changes
      setModel((prev) =>
        prev
          ? {
              ...prev,
              stages: updatedStages,
            }
          : null,
      );
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
      // Update the model state to reflect the changes
      setModel((prev) =>
        prev
          ? {
              ...prev,
              stages: updatedStages,
            }
          : null,
      );
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
      // Update the model state to reflect the changes
      setModel((prev) =>
        prev
          ? {
              ...prev,
              stages: updatedStages,
            }
          : null,
      );
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
              currentCaseId: selectedCase.id,
              name: selectedCase.name,
              stages: workflowModel.stages,
              instructions:
                "You are working with an EXISTING workflow. Use saveCase with isNew=false for any modifications. The current case ID is: " +
                selectedCase.id,
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
      let shouldReloadWorkflow = false;

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
                  // Check if this is a tool execution message that should be filtered
                  const lowerText = data.text.toLowerCase();
                  const isListTool =
                    lowerText.includes("listviews") ||
                    lowerText.includes("listfields");

                  // Filter out verbose JSON responses from list tools, but keep readable messages
                  // Only filter out raw JSON responses that contain specific field patterns
                  // Allow through valuable content that contains useful information
                  const shouldFilter =
                    isListTool &&
                    (lowerText.includes('"id":') ||
                      lowerText.includes('"name":') ||
                      lowerText.includes('"type":') ||
                      lowerText.includes('"caseid":') ||
                      lowerText.includes('"model":') ||
                      lowerText.includes('"primary":') ||
                      lowerText.includes('"required":') ||
                      lowerText.includes('"label":') ||
                      lowerText.includes('"description":') ||
                      lowerText.includes('"order":') ||
                      lowerText.includes('"options":') ||
                      lowerText.includes('"defaultvalue":')) &&
                    // Don't filter out content that contains valuable information
                    !lowerText.includes("workflow") &&
                    !lowerText.includes("fields created") &&
                    !lowerText.includes("views created") &&
                    !lowerText.includes("stages") &&
                    !lowerText.includes("processes") &&
                    !lowerText.includes("steps") &&
                    !lowerText.includes("breakdown") &&
                    !lowerText.includes("summary");

                  // Also filter out raw JSON tool results that are being displayed to the user
                  const isRawJsonToolResult =
                    data.text.trim().startsWith("{") &&
                    data.text.trim().endsWith("}") &&
                    (lowerText.includes('"id":') ||
                      lowerText.includes('"name":') ||
                      lowerText.includes('"type":') ||
                      lowerText.includes('"caseid":') ||
                      lowerText.includes('"model":') ||
                      lowerText.includes('"primary":') ||
                      lowerText.includes('"required":') ||
                      lowerText.includes('"label":') ||
                      lowerText.includes('"description":') ||
                      lowerText.includes('"order":') ||
                      lowerText.includes('"options":') ||
                      lowerText.includes('"defaultvalue":'));

                  if (!shouldFilter && !isRawJsonToolResult) {
                    // Check if this is a JSON response that should be made more readable
                    let processedText = data.text;

                    // Try to parse as JSON and create a readable message
                    processedText = processToolResponse(data.text);

                    // Add debugging for saveField responses
                    if (
                      data.text.includes('"type"') &&
                      data.text.includes('"name"') &&
                      data.text.includes('"id"')
                    ) {
                      console.log("Processing saveField response:", data.text);
                      console.log("Processed text:", processedText);
                    }

                    // Add each message as a separate message instead of accumulating
                    setMessages((prev) => [
                      ...prev,
                      {
                        id: uuidv4(),
                        content: processedText,
                        sender: "assistant",
                        timestamp: new Date(),
                      },
                    ]);
                  }

                  // Track if we should reload the workflow
                  // Check if this is a tool execution message that indicates a tool was executed
                  if (data.text) {
                    const lowerText = data.text.toLowerCase();
                    // Check for tool execution success messages
                    if (
                      lowerText.includes("created") ||
                      lowerText.includes("saved") ||
                      lowerText.includes("operation completed successfully") ||
                      (lowerText.includes("workflow") &&
                        lowerText.includes("saved successfully"))
                    ) {
                      shouldReloadWorkflow = true;
                    }
                  }
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
                  if (shouldReloadWorkflow) {
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

  // Helper function to process tool response messages into readable format
  // Examples:
  // Input: '{"id":183,"name":"KitchenSize","type":"Text","caseid":1,"primary":false,"required":false,"label":"Kitchen Size","description":"","order":1,"options":"[]","defaultValue":null}'
  // Output: 'Updated field 'KitchenSize' of type Text'
  //
  // Input: '{"id":1,"name":"testView","caseid":1,"model":"{\"fields\":[],\"layout\":{\"type\":\"form\",\"columns\":1}}"}'
  // Output: 'Updated view 'testView''
  //
  // Input: '[{"id":1,"name":"field1"},{"id":2,"name":"field2"}]'
  // Output: 'Found 2 items'
  const processToolResponse = (text: string): string => {
    try {
      const jsonData = JSON.parse(text);
      if (typeof jsonData === "object" && jsonData !== null) {
        // Handle saveFields response format (has both ids and fields arrays)
        if (
          jsonData.ids &&
          Array.isArray(jsonData.ids) &&
          jsonData.fields &&
          Array.isArray(jsonData.fields)
        ) {
          const fieldCount = jsonData.fields.length;
          const fieldTypes = [
            ...new Set((jsonData.fields as FieldWithType[]).map((f) => f.type)),
          ];
          return `Created ${fieldCount} field${
            fieldCount === 1 ? "" : "s"
          } of type${fieldTypes.length === 1 ? "" : "s"}: ${fieldTypes.join(
            ", ",
          )}`;
        }
        // Create readable messages based on the tool result
        if (jsonData.name && jsonData.type && jsonData.id) {
          // This looks like a field result
          // Since we can't determine create vs update from the response alone,
          // use a generic message that works for both cases
          return `Field '${jsonData.name}' of type ${jsonData.type} saved successfully`;
        } else if (jsonData.name && jsonData.caseid && jsonData.model) {
          // This looks like a view result
          return `View '${jsonData.name}' saved successfully`;
        } else if (jsonData.name && jsonData.description && jsonData.model) {
          // This looks like a case result
          return `Workflow '${jsonData.name}' saved successfully`;
        } else if (jsonData.message) {
          // Use the message if available
          return jsonData.message;
        } else if (jsonData.id && jsonData.name) {
          // Generic object with id and name
          return `Saved '${jsonData.name}'`;
        } else if (Array.isArray(jsonData)) {
          // Array response (like from listFields or listViews)
          if (jsonData.length === 0) {
            return "No items found";
          } else {
            return `Found ${jsonData.length} item${
              jsonData.length === 1 ? "" : "s"
            }`;
          }
        } else if (jsonData.error) {
          // Error response
          return `Error: ${jsonData.error}`;
        }
      }
    } catch (_e) {
      // Not JSON, use as is
    }
    return text;
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

  const handleAddFieldsToView = async (
    viewId: number,
    fieldNames: string[],
  ) => {
    if (!selectedCase) return;

    try {
      // Find the view in the views array
      const view = views.find((v) => v.id === viewId);
      if (!view) {
        throw new Error("View not found");
      }

      // Parse the existing view model
      let viewModel;
      try {
        viewModel = JSON.parse(view.model);
      } catch (_error) {
        viewModel = { fields: [] };
      }

      // Get existing field IDs in the view
      const existingFieldIds = new Set(
        viewModel.fields?.map((f: { fieldId: number }) => f.fieldId) || [],
      );

      // Add new fields that aren't already in the view
      const newFields = fieldNames
        .map((fieldName) => {
          const field = fields.find((f) => f.name === fieldName);
          return field ? field.id : null;
        })
        .filter((fieldId) => fieldId && !existingFieldIds.has(fieldId))
        .map((fieldId) => ({
          fieldId,
          required: false,
          order: (viewModel.fields?.length || 0) + 1,
        }));

      // Update the view model
      const updatedViewModel = {
        ...viewModel,
        fields: [...(viewModel.fields || []), ...newFields],
      };

      // Update the view in the database
      const response = await fetch(
        `/api/database?table=${DB_TABLES.VIEWS}&id=${viewId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: view.name,
            caseID: selectedCase.id,
            model: {
              fields: updatedViewModel.fields,
              layout: {
                type: "form",
                columns: 1,
              },
            },
          }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to update view");
      }

      const { data: updatedView } = await response.json();

      // Update the local views state
      setViews((prevViews) =>
        prevViews.map((v) => (v.id === viewId ? updatedView : v)),
      );

      addCheckpoint(`Updated database view: ${view.name}`, workflowModel);
    } catch (error) {
      console.error("Error updating view fields:", error);
      alert("Failed to update view fields. Please try again.");
    }
  };

  const handleAddFieldsToStep = async (
    stepId: number,
    fieldNames: string[],
  ) => {
    if (!selectedCase) return;

    try {
      // Handle workflow step
      const updatedStages = workflowModel.stages.map((stage: Stage) => ({
        ...stage,
        processes: stage.processes.map((process: Process) => ({
          ...process,
          steps: process.steps.map((step: Step) => {
            // Check if this is the step we're looking for
            if (step.id === stepId && step.type === "Collect information") {
              // Get existing fields
              const existingFields = step.fields || [];

              // Create a map of existing fields to preserve their properties
              const existingFieldsMap = new Map(
                existingFields.map((field) => [field.fieldId, field]),
              );

              // Add new fields while preserving existing ones
              fieldNames.forEach((fieldName) => {
                // Find the field by name to get its ID
                const field = fields.find((f) => f.name === fieldName);
                if (field && field.id && !existingFieldsMap.has(field.id)) {
                  existingFieldsMap.set(field.id, {
                    fieldId: field.id,
                    required: false,
                  });
                }
              });

              // Convert map back to array - this will include both existing and new fields
              const updatedFields = Array.from(existingFieldsMap.values());

              return {
                ...step,
                fields: updatedFields,
              };
            }
            return step;
          }),
        })),
      }));

      const updatedModel: ComposedModel = {
        name: selectedCase.name,
        description: selectedCase.description,
        stages: updatedStages,
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

      // Update the local model state to refresh the UI
      setModel((prev) =>
        prev
          ? {
              ...prev,
              stages: updatedStages,
            }
          : null,
      );
    } catch (error) {
      console.error("Error updating step fields:", error);
      alert("Failed to update step fields. Please try again.");
    }
  };

  const handleFieldsReorder = async (stepId: string, fieldIds: number[]) => {
    if (!selectedCase) return;

    try {
      // First, update the workflow model to reflect the new field order
      const updatedStages = workflowModel.stages.map((stage: Stage) => ({
        ...stage,
        processes: stage.processes.map((process: Process) => ({
          ...process,
          steps: process.steps.map((step: Step) => {
            // Extract step name from unique ID format: "StageName-StepName" or "db-{id}"
            let stepName = stepId;
            if (stepId.includes("-") && !stepId.startsWith("db-")) {
              // For step IDs like "StageName-StepName", extract the step name
              stepName = stepId.split("-").slice(1).join("-");
            }

            // Convert stepId to number for proper comparison with step.id
            const stepIdNum = parseInt(stepId, 10);
            const stepMatches =
              step.id === stepIdNum ||
              step.name === stepId ||
              step.name === stepName;

            if (stepMatches && step.type === "Collect information") {
              // Ensure unique field references and preserve existing properties
              const uniqueFieldIds = Array.from(new Set(fieldIds));
              return {
                ...step,
                fields: uniqueFieldIds.map((fieldId) => ({
                  fieldId,
                  required:
                    step.fields?.find(
                      (f: FieldReference) => f.fieldId === fieldId,
                    )?.required ?? false,
                })),
              };
            }
            return step;
          }),
        })),
      }));

      // Update the workflow model
      handleStepsUpdate(updatedStages);

      // Now update the database field order for all fields in this case
      const fieldUpdates = fieldIds
        .map((fieldId, index) => {
          const field = fields.find((f) => f.id === fieldId);
          if (field && field.id) {
            return fetch(
              `/api/database?table=${DB_TABLES.FIELDS}&id=${field.id}`,
              {
                method: "PUT",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  table: DB_TABLES.FIELDS,
                  data: {
                    id: field.id,
                    name: field.name,
                    label: field.label,
                    type: field.type,
                    primary: field.primary,
                    caseID: selectedCase.id,
                    options: field.options,
                    required: field.required,
                    order: index + 1, // Only update the order, preserve all other properties
                    description: field.description,
                  },
                }),
              },
            );
          }
          return null;
        })
        .filter(Boolean);

      // Wait for all field updates to complete
      await Promise.all(fieldUpdates);

      // Refresh the fields state to get updated order
      const fieldsResponse = await fetchWithBaseUrl(
        `/api/database?table=${DB_TABLES.FIELDS}&${DB_COLUMNS.CASE_ID}=${selectedCase.id}`,
      );
      if (fieldsResponse.ok) {
        const fieldsData = await fieldsResponse.json();
        setFields(fieldsData.data);
      }
    } catch (error) {
      console.error("Error reordering fields:", error);
      alert("Failed to reorder fields. Please try again.");
    }
  };

  const handleFieldsListReorder = async (
    startIndex: number,
    endIndex: number,
  ) => {
    if (!selectedCase) return;

    try {
      // Create a copy of the fields array and reorder it
      const reorderedFields = Array.from(fields);
      const [removed] = reorderedFields.splice(startIndex, 1);
      reorderedFields.splice(endIndex, 0, removed);

      // Update the database field order for all fields
      const fieldUpdates = reorderedFields
        .map((field, index) => {
          if (field.id) {
            return fetch(
              `/api/database?table=${DB_TABLES.FIELDS}&id=${field.id}`,
              {
                method: "PUT",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  table: DB_TABLES.FIELDS,
                  data: {
                    id: field.id,
                    name: field.name,
                    label: field.label,
                    type: field.type,
                    primary: field.primary,
                    caseID: selectedCase.id,
                    options: field.options,
                    required: field.required,
                    order: index + 1, // Only update the order, preserve all other properties
                    description: field.description,
                  },
                }),
              },
            );
          }
          return null;
        })
        .filter(Boolean);

      // Wait for all field updates to complete
      await Promise.all(fieldUpdates);

      // Update local state immediately for better UX
      setFields(reorderedFields);
    } catch (error) {
      console.error("Error reordering fields:", error);
      alert("Failed to reorder fields. Please try again.");
    }
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
                      fields={fields}
                      views={views}
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
                  <FieldsList
                    fields={fields}
                    onReorderFields={handleFieldsListReorder}
                    onDeleteField={handleDeleteField}
                    onEditField={handleEditField}
                  />
                </div>
              )}
              {activeTab === "views" && (
                <ViewsPanel
                  stages={workflowModel.stages}
                  fields={fields}
                  views={views}
                  onAddField={handleAddField}
                  onUpdateField={handleUpdateField}
                  onDeleteField={handleDeleteField}
                  onAddFieldsToView={handleAddFieldsToView}
                  onAddFieldsToStep={handleAddFieldsToStep}
                  onFieldsReorder={(stepId: number, fieldIds: string[]) => {
                    // Convert number stepId to string and string fieldIds to numbers for the handler
                    const numericFieldIds = fieldIds
                      .map((id) => parseInt(id, 10))
                      .filter((id) => !isNaN(id));
                    handleFieldsReorder(stepId.toString(), numericFieldIds);
                  }}
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
      />
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
