"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import WorkflowDiagram from "../../components/WorkflowDiagram";
import WorkflowLifecycleView from "../../components/WorkflowLifecycleView";
import { ChatMessage } from "../../components/ChatInterface";
import FreeFormSelectionOverlay from "./components/FreeFormSelectionOverlay";
import QuickChatOverlay from "./components/QuickChatOverlay";
import ResizeSeparator from "./components/ResizeSeparator";
import ChatPanelTabs from "./components/ChatPanelTabs";
import ChatPanelContent from "./components/ChatPanelContent";
import usePersistentTab from "./hooks/usePersistentTab";
import { useChatPanel } from "./hooks/useChatPanel";
import { useFreeFormSelection } from "./hooks/useFreeFormSelection";
import useQuickSelectionSummary from "./hooks/useQuickSelectionSummary";
import usePreviewIframe from "./hooks/usePreviewIframe";
import { Service } from "../../services/service";
import {
  Field,
  FieldReference,
  Stage,
  Process,
  Step,
  WorkflowModel,
} from "../../types";
import { StepType } from "../../utils/stepTypes";
import { registerRuleTypes } from "../../types/ruleTypeDefinitions";

// Initialize rule types on module load
registerRuleTypes();

// Local checkpoint interface for workflow change tracking
interface WorkflowCheckpoint {
  id: number;
  timestamp: string;
  description: string;
  model: WorkflowModel;
}
import { motion } from "framer-motion";
import { v4 as uuidv4 } from "uuid";
import ViewsPanel from "../../components/ViewsPanel";
import FieldsList from "../../components/FieldsList";
import { FaPencilAlt } from "react-icons/fa";
import AddFieldModal from "../../components/AddFieldModal";
import EditFieldModal from "../../components/EditFieldModal";
import { DB_TABLES, DB_COLUMNS } from "../../types/database";
import {
  removeFieldFromViewModel,
  addFieldToViewModel,
} from "../../lib/modelUtils";
import { fetchWithBaseUrl } from "../../lib/fetchWithBaseUrl";
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
  name: string;
  type: string;
};

const ACTIVE_TAB_STORAGE_KEY = "active_tab";
const ACTIVE_PANEL_TAB_STORAGE_KEY = "active_panel_tab";
const CHECKPOINTS_STORAGE_KEY = "workflow_checkpoints_";
const MAX_CHECKPOINTS = 10;
const MODEL_UPDATED_EVENT = "model-updated";
const CHAT_PANEL_WIDTH_STORAGE_KEY = "chat_panel_width";
const CHAT_PANEL_EXPANDED_STORAGE_KEY = "chat_panel_expanded";
const CHAT_MIN_WIDTH = 300;
const CHAT_MAX_WIDTH = 800;

interface DatabaseCase {
  id: number;
  name: string;
  description: string;
  model: any;
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
  model: any;
  caseid: number;
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

async function fetchCaseData(caseid: string): Promise<ComposedModel> {
  try {
    // Fetch the case data
    const caseResponse = await fetchWithBaseUrl(
      `/api/database?table=${DB_TABLES.CASES}&id=${caseid}`,
    );
    if (!caseResponse.ok) {
      throw new Error(`Failed to fetch case: ${caseResponse.status}`);
    }
    const caseData = await caseResponse.json();
    const selectedCase: DatabaseCase = caseData.data;

    if (!selectedCase) {
      throw new Error("Case not found");
    }

    // Use jsonb model directly
    const parsedModel = selectedCase.model;

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
  const {
    chatPanelWidth,
    isChatPanelExpanded,
    onResizeMouseDown,
    handleToggleChatPanel,
  } = useChatPanel({
    minWidth: CHAT_MIN_WIDTH,
    maxWidth: CHAT_MAX_WIDTH,
    widthStorageKey: CHAT_PANEL_WIDTH_STORAGE_KEY,
    expandedStorageKey: CHAT_PANEL_EXPANDED_STORAGE_KEY,
    initialWidth: 500,
    initialExpanded: true,
  });
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [workflowView, setWorkflowView] = useState<"flat" | "lifecycle">(
    "flat",
  );
  const [activeTab, setActiveTab] = usePersistentTab<
    "workflow" | "fields" | "views" | "chat" | "history"
  >(ACTIVE_TAB_STORAGE_KEY, "workflow");
  const [activePanelTab, setActivePanelTab] = usePersistentTab<
    "chat" | "history"
  >(ACTIVE_PANEL_TAB_STORAGE_KEY, "chat");
  const [isAddFieldModalOpen, setIsAddFieldModalOpen] = useState(false);
  const [editingField, setEditingField] = useState<Field | null>(null);
  const [checkpoints, setCheckpoints] = useState<WorkflowCheckpoint[]>([]);
  const [isAddStageModalOpen, setIsAddStageModalOpen] = useState(false);
  const [isAddProcessModalOpen, setIsAddProcessModalOpen] = useState(false);
  const [isEditWorkflowModalOpen, setIsEditWorkflowModalOpen] = useState(false);
  const [selectedStageForProcess, setSelectedStageForProcess] = useState<
    string | null
  >(null);
  const [selectedView, setSelectedView] = useState<string | null>(null);
  const [newProcessName, setNewProcessName] = useState("");

  // Free Form selection & quick chat state
  const [isQuickChatOpen, setIsQuickChatOpen] = useState(false);
  const [quickChatText, setQuickChatText] = useState("");
  const {
    isFreeFormSelecting,
    selectionRect,
    selectedFieldIds,
    selectedViewIds,
    selectedStageIds,
    selectedProcessIds,
    selectedStepIds,
    quickOverlayPosition,
    beginFreeFormSelection,
    onSelectionMouseDown,
    onSelectionMouseMove,
    onSelectionMouseUp,
  } = useFreeFormSelection({
    activeTab,
    selectedView,
    onOpenQuickChat: () => setIsQuickChatOpen(true),
  });
  // Workflow model memo used across UI
  const workflowModel: WorkflowState = useMemo(() => {
    if (!model) {
      return { stages: [] };
    }

    return {
      stages: model.stages || [],
    };
  }, [model]);

  // Function to generate the model data structure for preview
  const generateModelData = useCallback(
    (currentFields: Field[], currentStages: Stage[]) => {
      const tmpStages = [] as any[];
      for (const stage of currentStages) {
        const tmpSteps = [] as any[];
        for (const process of stage.processes) {
          for (const step of process.steps) {
            if (
              step.type === "Collect information" &&
              typeof (step as any).viewId === "number"
            ) {
              const view = views.find((v) => v.id === (step as any).viewId);
              if (view) {
                try {
                  const viewModel =
                    typeof view.model === "string"
                      ? JSON.parse(view.model)
                      : view.model;
                  if (Array.isArray(viewModel.fields)) {
                    const stepFields = viewModel.fields
                      .map((ref: { fieldId: number; required?: boolean }) => {
                        const field = currentFields.find(
                          (cf) => cf.id === ref.fieldId,
                        );
                        if (!field) return null;
                        return {
                          name: field.name,
                          required: Boolean(ref.required),
                        };
                      })
                      .filter((f: any) => f !== null);
                    tmpSteps.push({
                      ...step,
                      fields: stepFields as Array<{
                        name: string;
                        required: boolean;
                      }>,
                    });
                    continue;
                  }
                } catch {
                  // ignore JSON errors
                }
              }
            }
            tmpSteps.push(step);
          }
        }
        tmpStages.push({ ...stage, steps: tmpSteps });
      }
      const fieldsWithValues: Field[] = currentFields.map((f: any) => {
        const dv = f?.sampleValue;
        let value: any = undefined;
        if (dv !== undefined && dv !== null) {
          if (typeof dv === "string") {
            try {
              value = JSON.parse(dv);
            } catch {
              value = dv;
            }
          } else {
            value = dv;
          }
        }
        return { ...f, value } as Field;
      });

      return {
        fullUpdate: true,
        appName: selectedCase?.name || "Workflow",
        channel: "WorkPortal",
        industry: "Banking",
        userName: "John Smith",
        userLocale: "en-EN",
        caseName: selectedCase?.name || "Workflow",
        caseTypes: [
          {
            name: selectedCase?.name || "Workflow",
            fields: fieldsWithValues,
            creationFields: [],
            stages: tmpStages,
          },
        ],
      };
    },
    [selectedCase?.name, views],
  );

  // Quick selection summary string for QuickChat overlay
  const quickSelectionSummary = useQuickSelectionSummary({
    stages: workflowModel.stages,
    selectedStageIds,
    selectedProcessIds,
    selectedStepIds,
    selectedFieldIds,
    selectedViewIds,
  });
  const quickInputRef = useRef<HTMLInputElement>(null);

  // 3. All useRef hooks
  const addFieldButtonRef = useRef<HTMLButtonElement>(null);
  const { containerRef: previewContainerRef } = usePreviewIframe({
    isPreviewMode,
    generateModel: () => generateModelData(fields, workflowModel.stages),
  });
  // Resizing refs handled by useChatPanel

  // 5. All useEffect hooks
  // (Replaced by usePersistentTab and useChatPanel)

  // Resize handlers are provided by useChatPanel

  const sendQuickChat = useCallback(async () => {
    if (!quickChatText.trim()) return;
    const chosenFields = fields.filter((f) =>
      selectedFieldIds.includes(f.id as number),
    );
    const fieldNames = chosenFields.map((f) => f.name);
    const chosenViews = views.filter((v) =>
      selectedViewIds.includes(v.id as number),
    );
    const viewNames = chosenViews.map((v) => v.name);
    // Map selected stage and process ids to names from current workflow model
    const chosenStages = workflowModel.stages.filter((s) =>
      selectedStageIds.includes(s.id as number),
    );
    const stageNames = chosenStages.map((s) => s.name);
    const processMap: { ids: number[]; names: string[] } = {
      ids: [],
      names: [],
    };
    for (const stage of workflowModel.stages) {
      for (const process of stage.processes) {
        if (selectedProcessIds.includes(process.id as number)) {
          processMap.ids.push(process.id as number);
          processMap.names.push(process.name);
        }
      }
    }
    // Map selected step ids to names
    const stepMap: { ids: number[]; names: string[] } = { ids: [], names: [] };
    for (const stage of workflowModel.stages) {
      for (const process of stage.processes) {
        for (const step of process.steps) {
          if (selectedStepIds.includes(step.id as number)) {
            stepMap.ids.push(step.id as number);
            stepMap.names.push(step.name);
          }
        }
      }
    }
    const contextPrefix = `Context:\nSelected fieldIds=${JSON.stringify(
      selectedFieldIds,
    )}\nSelected fieldNames=${JSON.stringify(
      fieldNames,
    )}\nSelected viewIds=${JSON.stringify(
      selectedViewIds,
    )}\nSelected viewNames=${JSON.stringify(
      viewNames,
    )}\nSelected stageIds=${JSON.stringify(
      selectedStageIds,
    )}\nSelected stageNames=${JSON.stringify(
      stageNames,
    )}\nSelected processIds=${JSON.stringify(
      processMap.ids,
    )}\nSelected processNames=${JSON.stringify(
      processMap.names,
    )}\nSelected stepIds=${JSON.stringify(
      stepMap.ids,
    )}\nSelected stepNames=${JSON.stringify(stepMap.names)}\n`;
    const composedMessage = `${contextPrefix}\nInstruction: ${quickChatText.trim()}`;
    // Close modal immediately before sending to avoid waiting for LLM stream
    setIsQuickChatOpen(false);
    setQuickChatText("");
    // Fire-and-forget so UI is responsive; errors are logged in handler
    void handleSendMessage(composedMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields, views, selectedFieldIds, selectedViewIds, quickChatText]);

  // Resizing mouse handlers are provided by useChatPanel

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

  // Iframe lifecycle handled by usePreviewIframe

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

  // Light refresh function for chat completion - updates data without showing loading state
  const refreshWorkflowData = useCallback(async () => {
    try {
      // Refresh the case data
      const caseResponse = await fetchWithBaseUrl(
        `/api/database?table=${DB_TABLES.CASES}&id=${id}`,
      );
      if (caseResponse.ok) {
        const caseData = await caseResponse.json();
        setSelectedCase(caseData.data);
      }

      // Refresh the model
      const composedModel = await fetchCaseData(id);
      setModel(composedModel);

      // Refresh fields
      const fieldsResponse = await fetchWithBaseUrl(
        `/api/database?table=${DB_TABLES.FIELDS}&${DB_COLUMNS.CASE_ID}=${id}`,
      );
      if (fieldsResponse.ok) {
        const fieldsResult = await fieldsResponse.json();
        setFields(fieldsResult.data);
      }

      // Refresh views
      const viewsResponse = await fetchWithBaseUrl(
        `/api/database?table=${DB_TABLES.VIEWS}&${DB_COLUMNS.CASE_ID}=${id}`,
      );
      if (viewsResponse.ok) {
        const viewsData = await viewsResponse.json();
        setViews(viewsData.data);
      }

      // Dispatch model updated event for preview
      window.dispatchEvent(new CustomEvent(MODEL_UPDATED_EVENT));
    } catch (err) {
      console.error("Error refreshing workflow data:", err);
      // Don't set error state for refresh failures - just log them
    }
  }, [id]);

  // Load workflow data
  useEffect(() => {
    fetchCase();
    loadWorkflow();
  }, [id, fetchCase, loadWorkflow]);

  // Legacy preview iframe creation handled by usePreviewIframe

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
        <a
          href="/"
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
        >
          Back to Home
        </a>
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
      console.log("Updated Stages:", {
        count: updatedStages.length,
        stages: updatedStages.map((s) => ({
          name: s.name,
          processes: s.processes.length,
          steps: s.processes.reduce((acc, p) => acc + p.steps.length, 0),
        })),
      });

      const updatedModel = {
        ...(selectedCase.model || {}),
        stages: updatedStages,
        name: selectedCase.name,
      };

      // Direct database call - database layer will handle checkpoints
      const requestUrl = `/api/database?table=${DB_TABLES.CASES}&id=${selectedCase.id}`;
      const requestBody = {
        name: selectedCase.name,
        description: selectedCase.description,
        model: updatedModel,
      };

      const response = await fetch(requestUrl, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to update case: ${response.status} ${errorText}`,
        );
      }

      const _responseData = await response.json();

      // Update the case and model state
      setSelectedCase({
        ...selectedCase,
        model: updatedModel,
      });
      setModel((prev) =>
        prev
          ? {
              ...prev,
              stages: updatedModel.stages,
            }
          : null,
      );

      // Dispatch model updated event for preview
      window.dispatchEvent(new CustomEvent(MODEL_UPDATED_EVENT));
    } catch (error) {
      console.error("=== Error in Steps Update ===");
      console.error("Error:", error);
      throw error;
    }
  };

  const handleAddField = async (field: {
    label: string;
    type: Field["type"];
    options?: string[];
    required?: boolean;
    primary?: boolean;
    sampleValue?: string;
  }): Promise<string> => {
    if (!selectedCase) return "";

    // Generate the actual field name
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

      console.log("Creating field with data:", fieldData);

      const response = await fetch(`/api/database?table=${DB_TABLES.FIELDS}`, {
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
            caseid: fieldData.caseid,
            label: fieldData.label,
            description: fieldData.description,
            order: fieldData.order,
            options: fieldData.options,
            required: fieldData.required,
            sampleValue: fieldData.sampleValue,
          },
        }),
      });

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

      // Optimistically insert the created field into local state so UI updates immediately
      const createResult = await response.json();
      const createdField = createResult?.data;
      if (createdField) {
        setFields((prev) => [...prev, createdField]);
      }

      // Refresh the fields state from server to ensure consistency
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

      // Dispatch model updated event for preview
      window.dispatchEvent(new CustomEvent(MODEL_UPDATED_EVENT));

      return fieldName;
    } catch (error) {
      console.error("Error adding field:", error);
      alert("Failed to add field. Please try again.");
      throw error;
    }
  };

  const handleUpdateField = async (updates: Partial<Field>) => {
    if (!selectedCase) {
      console.error("Missing required data for field update:", {
        selectedCase: null,
      });
      return;
    }

    // Prefer an explicit id from updates; otherwise, fallback to current editingField
    const targetFieldId = updates.id ?? editingField?.id;
    const targetField =
      fields.find((f) => f.id === targetFieldId) || editingField || null;

    if (!targetField || !targetField.id) {
      console.error("Missing required data for field update:", {
        selectedCase: selectedCase
          ? { id: selectedCase.id, name: selectedCase.name }
          : null,
        editingField: targetField
          ? {
              id: targetField.id,
              name: targetField.name,
              label: targetField.label,
              type: targetField.type,
            }
          : null,
      });
      return;
    }

    try {
      // Prepare the request body
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
            // If updates.options is provided, use it directly
            if (updates.options !== undefined) {
              console.log("Using updates.options:", updates.options);
              return updates.options;
            }

            // Otherwise, process the existing options
            if (targetField.options) {
              if (Array.isArray(targetField.options)) {
                console.log(
                  "Using existing array options:",
                  targetField.options,
                );
                return targetField.options;
              } else {
                try {
                  const parsed = JSON.parse(targetField.options);
                  console.log("Parsed existing options:", parsed);
                  return parsed;
                } catch (error) {
                  console.error("Failed to parse options:", error);
                  return [];
                }
              }
            }

            console.log("No options found, using empty array");
            return [];
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

      // Debug logging for field updates
      console.log("=== Field Update Request Body ===");
      console.log("Options type:", typeof requestBody.data.options);
      console.log("Options is array:", Array.isArray(requestBody.data.options));

      // First update the field in the fields table
      const response = await fetch(
        `/api/database?table=${DB_TABLES.FIELDS}&id=${targetField.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
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

      // Refresh the fields state to update the UI
      const fieldsResponse = await fetchWithBaseUrl(
        `/api/database?table=${DB_TABLES.FIELDS}&${DB_COLUMNS.CASE_ID}=${selectedCase.id}`,
      );
      if (fieldsResponse.ok) {
        const fieldsData = await fieldsResponse.json();
        setFields(fieldsData.data);
      }

      setEditingField(null);

      // Dispatch model updated event for preview
      window.dispatchEvent(new CustomEvent(MODEL_UPDATED_EVENT));
    } catch (error) {
      console.error("Error updating field:", error);
      alert("Failed to update field. Please try again.");
    }
  };

  const handleDeleteField = async (field: Field) => {
    if (!selectedCase || !field.id) return;

    try {
      // Delete the field from the fields table
      // The deleteField tool will automatically remove the field from all views
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
                    (fieldObj) => fieldObj.id === f.fieldId,
                  );
                  return referencedField?.name !== field.name;
                }) || [],
            })),
          })),
        })),
      };

      // Update the case in the database
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

      // Refresh the fields state to get updated fields
      const fieldsResponse = await fetchWithBaseUrl(
        `/api/database?table=${DB_TABLES.FIELDS}&${DB_COLUMNS.CASE_ID}=${selectedCase.id}`,
      );
      if (fieldsResponse.ok) {
        const fieldsData = await fieldsResponse.json();
        setFields(fieldsData.data);
      }

      // Refresh the views state to get updated views
      const viewsResponse = await fetchWithBaseUrl(
        `/api/database?table=${DB_TABLES.VIEWS}&${DB_COLUMNS.CASE_ID}=${selectedCase.id}`,
      );
      if (viewsResponse.ok) {
        const viewsData = await viewsResponse.json();
        setViews(viewsData.data);
      }

      // Dispatch model updated event for preview
      window.dispatchEvent(new CustomEvent(MODEL_UPDATED_EVENT));
    } catch (error) {
      console.error("Error deleting field:", error);
      alert("Failed to delete field. Please try again.");
    }
  };

  const handleRemoveFieldFromView = async (field: Field) => {
    if (!selectedCase || !field.id || !selectedView) return;

    try {
      // Extract the actual view ID from the selectedView
      // selectedView can be "db-123" for database views or a step ID for workflow steps
      let viewId: number | undefined;

      if (selectedView.startsWith("db-")) {
        // It's a database view, extract the ID
        viewId = parseInt(selectedView.substring(3), 10);
      } else {
        // It's a workflow step, we don't need to handle this case here
        // as workflow steps don't use this function
        return;
      }

      if (!viewId || isNaN(viewId)) {
        throw new Error("Invalid view ID");
      }

      // Find the view in the views array
      const view = views.find((v) => v.id === viewId);
      if (!view) {
        throw new Error("View not found");
      }

      // Parse the existing view model
      let viewModel;
      try {
        viewModel =
          typeof view.model === "string" ? JSON.parse(view.model) : view.model;
      } catch (_error) {
        viewModel = { fields: [] };
      }

      // Remove the field using shared util
      const { viewModel: updatedModel, removed } = removeFieldFromViewModel(
        viewModel,
        field.id,
      );

      // Only update if the field was actually removed
      if (removed) {
        // Update the view in the database
        const response = await fetch(
          `/api/database?table=${DB_TABLES.VIEWS}&id=${view.id}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: view.name,
              caseid: selectedCase.id,
              model: {
                fields: updatedModel.fields,
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

        // Refresh the views state to get updated views
        const viewsResponse = await fetchWithBaseUrl(
          `/api/database?table=${DB_TABLES.VIEWS}&${DB_COLUMNS.CASE_ID}=${selectedCase.id}`,
        );
        if (viewsResponse.ok) {
          const viewsData = await viewsResponse.json();
          setViews(viewsData.data);
        }

        console.log(`Removed field ${field.name} from view ${view.name}`);
      }
    } catch (error) {
      console.error("Error removing field from view:", error);
      alert("Failed to remove field from view. Please try again.");
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

    try {
      // Direct database call - database layer will handle checkpoints
      const requestUrl = `/api/database?table=${DB_TABLES.CASES}&id=${selectedCase.id}`;
      const requestBody = {
        name: selectedCase.name,
        description: selectedCase.description,
        model: updatedModel,
      };

      const response = await fetch(requestUrl, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to add stage: ${response.status} ${errorText}`);
      }

      const _responseData = await response.json();
      setSelectedCase({
        ...selectedCase,
        model: updatedModel,
      });
      setModel((prev) =>
        prev
          ? {
              ...prev,
              stages: updatedModel.stages,
            }
          : null,
      );
      setIsAddStageModalOpen(false);

      // Dispatch model updated event for preview
      window.dispatchEvent(new CustomEvent(MODEL_UPDATED_EVENT));
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
        model: updatedModel,
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

      // Dispatch model updated event for preview
      window.dispatchEvent(new CustomEvent(MODEL_UPDATED_EVENT));
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

    try {
      // 1) If the step collects information, create a corresponding view first
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
              model: {
                fields: [],
                layout: { type: "form", columns: 1 },
              },
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

      // 2) Create the step, linking the new viewId when applicable
      const newStep: Step = {
        id: Date.now(),
        name: stepName,
        type: stepType,
        fields: [],
        ...(createdViewId ? { viewId: createdViewId } : {}),
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

      const updatedModel: ComposedModel = {
        name: selectedCase.name,
        description: selectedCase.description,
        stages: updatedStages,
      };

      addCheckpoint(`Added step: ${stepName}`, updatedModel);

      // 3) Persist the updated case with the new step (containing viewId if created)
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

      if (!response.ok) {
        throw new Error(`Failed to add step: ${response.status}`);
      }

      const { data: updatedCase } = await response.json();
      setSelectedCase(updatedCase);
      setModel(updatedModel);

      // 4) Refresh views so the Views tab reflects the newly created view
      try {
        const viewsResponse = await fetchWithBaseUrl(
          `/api/database?table=${DB_TABLES.VIEWS}&${DB_COLUMNS.CASE_ID}=${id}`,
        );
        if (viewsResponse.ok) {
          const viewsData = await viewsResponse.json();
          setViews(viewsData.data);
        }
      } catch (_e) {
        // Best-effort refresh; ignore failures here
      }

      // Dispatch model updated event for preview
      window.dispatchEvent(new CustomEvent(MODEL_UPDATED_EVENT));
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

    // Find the step being deleted to cascade delete its associated view (if any)
    let viewIdToDelete: number | undefined;
    try {
      const stage = workflowModel.stages.find((s) => s.id === stageId);
      const process = stage?.processes.find((p) => p.id === processId);
      const step = process?.steps.find((st) => st.id === stepId);
      if (step && typeof (step as any).viewId === "number") {
        viewIdToDelete = (step as any).viewId as number;
      }
    } catch (_e) {
      // Best-effort discovery; proceed regardless
    }

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

    const updatedModel: ComposedModel = {
      name: selectedCase.name,
      description: selectedCase.description,
      stages: updatedStages,
    };

    addCheckpoint("Deleted step", updatedModel);

    try {
      // If the step had a linked view, delete it from the database first
      if (typeof viewIdToDelete === "number") {
        try {
          const deleteResp = await fetch(
            `/api/database?table=${DB_TABLES.VIEWS}&id=${viewIdToDelete}`,
            { method: "DELETE" },
          );
          if (!deleteResp.ok) {
            const errText = await deleteResp.text();
            console.warn(
              `Failed to delete linked view ${viewIdToDelete}: ${deleteResp.status} ${errText}`,
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

      if (!response.ok) {
        throw new Error(`Failed to delete step: ${response.status}`);
      }

      const { data: updatedCase } = await response.json();
      setSelectedCase(updatedCase);
      setModel(updatedModel);

      // Refresh views to reflect any deleted linked views
      try {
        const viewsResponse = await fetchWithBaseUrl(
          `/api/database?table=${DB_TABLES.VIEWS}&${DB_COLUMNS.CASE_ID}=${selectedCase.id}`,
        );
        if (viewsResponse.ok) {
          const viewsData = await viewsResponse.json();
          setViews(viewsData.data);
        }
      } catch (_e) {
        // ignore
      }

      // Dispatch model updated event for preview
      window.dispatchEvent(new CustomEvent(MODEL_UPDATED_EVENT));
    } catch (error) {
      console.error("Error deleting step:", error);
      throw error;
    }
  };

  const handleDeleteProcess = async (stageId: number, processId: number) => {
    if (!selectedCase) return;

    // Gather all view IDs linked to steps within this process for cascade deletion
    let viewIdsToDelete: number[] = [];
    try {
      const stage = workflowModel.stages.find((s) => s.id === stageId);
      const process = stage?.processes.find((p) => p.id === processId);
      if (process) {
        viewIdsToDelete = (process.steps || [])
          .map((st) => (st as any).viewId as number | undefined)
          .filter((vid): vid is number => typeof vid === "number");
      }
    } catch (_e) {
      // Best-effort
    }

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

    const updatedModel: ComposedModel = {
      name: selectedCase.name,
      description: selectedCase.description,
      stages: updatedStages,
    };

    addCheckpoint("Deleted process", updatedModel);

    try {
      // Best-effort delete of any linked views in parallel
      if (viewIdsToDelete.length > 0) {
        try {
          await Promise.allSettled(
            viewIdsToDelete.map((vid) =>
              fetch(`/api/database?table=${DB_TABLES.VIEWS}&id=${vid}`, {
                method: "DELETE",
              }),
            ),
          );
        } catch (_e) {
          // ignore
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

      if (!response.ok) {
        throw new Error(`Failed to delete process: ${response.status}`);
      }

      const { data: updatedCase } = await response.json();
      setSelectedCase(updatedCase);
      setModel(updatedModel);

      // Refresh views after cascade deletions
      try {
        const viewsResponse = await fetchWithBaseUrl(
          `/api/database?table=${DB_TABLES.VIEWS}&${DB_COLUMNS.CASE_ID}=${selectedCase.id}`,
        );
        if (viewsResponse.ok) {
          const viewsData = await viewsResponse.json();
          setViews(viewsData.data);
        }
      } catch (_e) {}

      // Dispatch model updated event for preview
      window.dispatchEvent(new CustomEvent(MODEL_UPDATED_EVENT));
    } catch (error) {
      console.error("Error deleting process:", error);
      throw error;
    }
  };

  const handleDeleteStage = async (stageId: number) => {
    if (!selectedCase) return;

    // Gather all view IDs from all steps within this stage for cascade deletion
    let viewIdsToDelete: number[] = [];
    try {
      const stage = workflowModel.stages.find((s) => s.id === stageId);
      if (stage) {
        for (const proc of stage.processes || []) {
          const ids = (proc.steps || [])
            .map((st) => (st as any).viewId as number | undefined)
            .filter((vid): vid is number => typeof vid === "number");
          viewIdsToDelete.push(...ids);
        }
      }
    } catch (_e) {
      // ignore
    }

    const updatedStages = workflowModel.stages.filter(
      (stage) => stage.id !== stageId,
    );

    const updatedModel: ComposedModel = {
      name: selectedCase.name,
      description: selectedCase.description,
      stages: updatedStages,
    };

    addCheckpoint("Deleted stage", updatedModel);

    try {
      // Best-effort delete of any linked views in parallel
      if (viewIdsToDelete.length > 0) {
        try {
          await Promise.allSettled(
            viewIdsToDelete.map((vid) =>
              fetch(`/api/database?table=${DB_TABLES.VIEWS}&id=${vid}`, {
                method: "DELETE",
              }),
            ),
          );
        } catch (_e) {}
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

      if (!response.ok) {
        throw new Error(`Failed to delete stage: ${response.status}`);
      }

      const { data: updatedCase } = await response.json();
      setSelectedCase(updatedCase);
      setModel(updatedModel);

      // Refresh views after cascade deletions
      try {
        const viewsResponse = await fetchWithBaseUrl(
          `/api/database?table=${DB_TABLES.VIEWS}&${DB_COLUMNS.CASE_ID}=${selectedCase.id}`,
        );
        if (viewsResponse.ok) {
          const viewsData = await viewsResponse.json();
          setViews(viewsData.data);
        }
      } catch (_e) {}

      // Dispatch model updated event for preview
      window.dispatchEvent(new CustomEvent(MODEL_UPDATED_EVENT));
    } catch (error) {
      console.error("Error deleting stage:", error);
      throw error;
    }
  };

  const handleSendMessage = async (message: string) => {
    let aiMessageId: string; // Declare at function scope

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
      aiMessageId = uuidv4();
      setMessages((prev) => [
        ...prev,
        {
          id: aiMessageId,
          content: "",
          sender: "assistant",
          timestamp: new Date(),
          isThinking: true, // Start with thinking indicator
        },
      ]);

      // Build conversation history (excluding the just-typed message which we add separately)
      const history = messages
        .filter((m) => typeof m.content === "string" && m.content.trim())
        .map((m) => ({
          role:
            m.sender === "user" ? ("user" as const) : ("assistant" as const),
          content: m.content,
        }));

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
        history,
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
      let currentThinkingContent = "";

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
                  // Debug logging for all responses
                  console.log("Received data.text:", data.text);

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
                  // But allow saveFields responses through (they have both ids and fields arrays)
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
                      lowerText.includes('"defaultvalue":')) &&
                    // Don't filter out saveFields responses (they have both ids and fields arrays)
                    !(
                      lowerText.includes('"ids":') &&
                      lowerText.includes('"fields":')
                    );

                  if (!shouldFilter && !isRawJsonToolResult) {
                    console.log(
                      "Processing response (not filtered):",
                      data.text,
                    );

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

                    // Accumulate thinking content in the current AI message
                    currentThinkingContent += processedText;

                    // Update the current AI message with accumulated content
                    setMessages((prev) =>
                      prev.map((msg) =>
                        msg.id === aiMessageId
                          ? {
                              ...msg,
                              content: currentThinkingContent,
                              isThinking: true,
                            }
                          : msg,
                      ),
                    );
                  } else {
                    console.log("Response filtered out:", data.text);
                    console.log(
                      "shouldFilter:",
                      shouldFilter,
                      "isRawJsonToolResult:",
                      isRawJsonToolResult,
                    );
                  }

                  // Track if we should reload the workflow
                  // Check if this is a tool execution message that indicates a tool was executed
                  if (data.text) {
                    const lowerText = data.text.toLowerCase();
                    // Check for tool execution success messages
                    if (
                      lowerText.includes("created") ||
                      lowerText.includes("saved") ||
                      lowerText.includes("deleted") ||
                      lowerText.includes("removed") ||
                      lowerText.includes("operation completed successfully") ||
                      lowerText.includes("updated") ||
                      lowerText.includes("all constraints satisfied") ||
                      lowerText.includes("task completed successfully") ||
                      lowerText.includes("[[completed]]") ||
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
                  // Clear the thinking indicator when done
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === aiMessageId
                        ? { ...msg, isThinking: false }
                        : msg,
                    ),
                  );

                  // Refresh the workflow data if tools were executed
                  if (shouldReloadWorkflow) {
                    await refreshWorkflowData();
                    // Clear selection caches that can cause stale UI
                    setSelectedView(null);
                    setActiveStage(undefined);
                    setActiveProcess(undefined);
                    setActiveStep(undefined);
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

      // Clear the thinking indicator on error
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === aiMessageId ? { ...msg, isThinking: false } : msg,
        ),
      );

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

  const _handleClearCheckpoints = () => {
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
    const newCheckpoint: WorkflowCheckpoint = {
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
  // Input: '{"id":183,"name":"KitchenSize","type":"Text","caseid":1,"primary":false,"required":false,"label":"Kitchen Size","description":"","order":1,"options":"[]","sampleValue":null}'
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
        // Debug logging for saveFields responses
        if (
          jsonData.ids &&
          Array.isArray(jsonData.ids) &&
          jsonData.fields &&
          Array.isArray(jsonData.fields)
        ) {
          console.log("Processing saveFields response:", jsonData);
          console.log(
            "Field names:",
            jsonData.fields.map((f: { name: string }) => f.name),
          );
        }

        // Handle saveFields response format (has both ids and fields arrays)
        if (
          jsonData.ids &&
          Array.isArray(jsonData.ids) &&
          jsonData.fields &&
          Array.isArray(jsonData.fields)
        ) {
          const fieldCount = jsonData.fields.length;
          const fieldNames = (jsonData.fields as FieldWithType[]).map(
            (f) => f.name,
          );
          console.log("Extracted field names:", fieldNames);
          // Neutral wording on UI fallback; server will already send precise Created/Updated message
          return `Saved ${fieldCount} field${
            fieldCount === 1 ? "" : "s"
          }: ${fieldNames.join(", ")}`;
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
        } else if (
          jsonData.success &&
          jsonData.deletedId &&
          jsonData.deletedName &&
          jsonData.type
        ) {
          // Delete operation response with name and type
          const itemType =
            jsonData.type === "field"
              ? "field"
              : jsonData.type === "view"
              ? "view"
              : "item";

          if (jsonData.type === "field" && jsonData.updatedViewsCount) {
            return `Deleted ${itemType} '${
              jsonData.deletedName
            }' (removed from ${jsonData.updatedViewsCount} view${
              jsonData.updatedViewsCount === 1 ? "" : "s"
            })`;
          } else {
            return `Deleted ${itemType} '${jsonData.deletedName}'`;
          }
        } else if (jsonData.success && jsonData.deletedId) {
          // Fallback for delete operations without name
          return `Item with ID ${jsonData.deletedId} deleted successfully`;
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

  const _handleRestoreCheckpoint = (checkpoint: WorkflowCheckpoint) => {
    if (
      confirm(
        "Are you sure you want to restore this checkpoint? All changes after this point will be lost.",
      )
    ) {
      setSelectedCase((prev) =>
        prev
          ? {
              ...prev,
              model: checkpoint.model,
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
    const model = selectedCase.model;

    const requestBody = {
      name: data.name,
      description: data.description,
      model,
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

      // Dispatch model updated event for preview
      window.dispatchEvent(new CustomEvent(MODEL_UPDATED_EVENT));
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
        viewModel =
          typeof view.model === "string" ? JSON.parse(view.model) : view.model;
      } catch (_error) {
        viewModel = { fields: [] };
      }

      // Resolve field IDs for the provided names, using local cache first, then DB fallback
      const resolvedFieldIds: number[] = [];
      const unresolvedNames: string[] = [];
      for (const fieldName of fieldNames) {
        const localField = fields.find((f) => f.name === fieldName);
        if (localField && typeof localField.id === "number") {
          resolvedFieldIds.push(localField.id);
        } else {
          unresolvedNames.push(fieldName);
        }
      }

      // DB fallback for unresolved names
      if (unresolvedNames.length > 0) {
        const lookups = await Promise.all(
          unresolvedNames.map(async (fname) => {
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
            } catch (_e) {
              // ignore
            }
            return undefined;
          }),
        );
        for (const id of lookups) {
          if (typeof id === "number") resolvedFieldIds.push(id);
        }
      }

      // Add new fields that aren't already in the view using shared util
      let updatedViewModel = { ...viewModel };
      for (const fid of resolvedFieldIds) {
        const res = addFieldToViewModel(updatedViewModel, fid, {
          required: false,
        });
        updatedViewModel = res.viewModel;
      }

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
            caseid: selectedCase.id,
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

      // Normalize model shape to always be a string for downstream JSON.parse usage
      const normalizedUpdatedView = {
        ...updatedView,
        model:
          typeof updatedView.model === "string"
            ? updatedView.model
            : JSON.stringify(updatedView.model ?? {}),
      };

      // Update the local views state
      setViews((prevViews) =>
        prevViews.map((v) => (v.id === viewId ? normalizedUpdatedView : v)),
      );

      addCheckpoint(`Updated database view: ${view.name}`, workflowModel);

      // Dispatch model updated event for preview
      window.dispatchEvent(new CustomEvent(MODEL_UPDATED_EVENT));
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
              model: updatedModel,
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

      // Dispatch model updated event for preview
      window.dispatchEvent(new CustomEvent(MODEL_UPDATED_EVENT));
    } catch (error) {
      console.error("Error updating step fields:", error);
      alert("Failed to update step fields. Please try again.");
    }
  };

  const handleFieldsReorder = async (
    selectedViewId: string,
    fieldIds: number[],
  ) => {
    if (!selectedCase) return;

    try {
      // If this is a database view (format: "db-<id>"), only update the view model
      if (selectedViewId.startsWith("db-")) {
        const viewId = parseInt(selectedViewId.substring(3), 10);
        if (!viewId || isNaN(viewId)) {
          throw new Error("Invalid database view ID");
        }

        const view = views.find((v) => v.id === viewId);
        if (!view) {
          throw new Error("View not found");
        }

        // Parse existing view model
        let viewModel: {
          fields?: Array<{
            fieldId: number;
            required?: boolean;
            order?: number;
          }>;
          layout?: any;
        } = {};
        try {
          viewModel = JSON.parse(view.model || "{}");
        } catch (_err) {
          viewModel = { fields: [] };
        }

        const existingFieldRefs: Array<{
          fieldId: number;
          required?: boolean;
          order?: number;
        }> = Array.isArray(viewModel.fields) ? viewModel.fields : [];
        const fieldRefById = new Map(
          existingFieldRefs.map((ref) => [ref.fieldId, { ...ref }]),
        );

        // Reorder: apply provided sequence and preserve properties; set new order index
        const reorderedRefs: Array<{
          fieldId: number;
          required?: boolean;
          order?: number;
        }> = [];
        fieldIds.forEach((fid, index) => {
          const existing = fieldRefById.get(fid) || { fieldId: fid };
          reorderedRefs.push({ ...existing, order: index + 1 });
          fieldRefById.delete(fid);
        });
        // Append any refs that weren't included (safety), preserving relative order
        existingFieldRefs
          .filter((ref) => fieldRefById.has(ref.fieldId))
          .forEach((ref) => {
            reorderedRefs.push({ ...ref, order: reorderedRefs.length + 1 });
          });

        const updatedViewModel = {
          ...viewModel,
          fields: reorderedRefs,
          layout: viewModel.layout || { type: "form", columns: 1 },
        };

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
                layout: updatedViewModel.layout,
              },
            }),
          },
        );

        if (!response.ok) {
          throw new Error("Failed to update view order");
        }

        const { data: updatedView } = await response.json();
        setViews((prev) =>
          prev.map((v) => (v.id === viewId ? updatedView : v)),
        );

        // Dispatch for preview
        window.dispatchEvent(new CustomEvent(MODEL_UPDATED_EVENT));
        return;
      }

      // Otherwise, treat as workflow step reorder (update case model only)
      const stepId = selectedViewId;
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

      // Update the workflow model in the case (no field table updates here)
      handleStepsUpdate(updatedStages);

      // Dispatch model updated event for preview
      window.dispatchEvent(new CustomEvent(MODEL_UPDATED_EVENT));
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

    // Build a map of original orders based on current rendered order
    const originalOrderById = new Map<number, number>();
    fields.forEach((f, idx) => {
      if (typeof f.id === "number") originalOrderById.set(f.id, idx + 1);
    });

    // Create a copy of the fields array and reorder it
    const reorderedFields = Array.from(fields);
    const [removed] = reorderedFields.splice(startIndex, 1);
    reorderedFields.splice(endIndex, 0, removed);

    // Optimistically update local state immediately so the item stays where dropped
    // Also update the order property on affected items for consistency
    const minIndex = Math.min(startIndex, endIndex);
    const maxIndex = Math.max(startIndex, endIndex);
    for (let i = minIndex; i <= maxIndex; i += 1) {
      const field = reorderedFields[i];
      if (field) (field as any).order = i + 1;
    }
    setFields(reorderedFields);

    try {
      // Only update the fields whose order actually changed, bounded to the affected range
      const updates = [] as Promise<Response>[];
      for (let i = minIndex; i <= maxIndex; i += 1) {
        const field = reorderedFields[i];
        if (!field || typeof field.id !== "number") continue;
        const previousOrder = originalOrderById.get(field.id);
        const nextOrder = i + 1;
        if (previousOrder === nextOrder) continue; // skip unchanged

        updates.push(
          fetch(`/api/database?table=${DB_TABLES.FIELDS}&id=${field.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              table: DB_TABLES.FIELDS,
              data: {
                id: field.id,
                name: field.name,
                label: field.label,
                type: field.type,
                primary: field.primary,
                caseid: selectedCase.id,
                options: field.options,
                required: field.required,
                order: nextOrder,
                description: field.description,
              },
            }),
          }),
        );
      }

      if (updates.length > 0) {
        await Promise.all(updates);
      }

      // Notify preview that model changed
      window.dispatchEvent(new CustomEvent(MODEL_UPDATED_EVENT));
    } catch (error) {
      console.error("Error reordering fields:", error);
      alert("Failed to reorder fields. Please try again.");
      // Optional: revert to original order on failure
      // setFields(fields);
    }
  };

  return (
    <div className="flex h-screen bg-white dark:bg-gray-900">
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header row with title and preview switch */}
        <div className="flex justify-between items-center p-6 pb-3 pr-[200px]">
          <div className="flex items-center">
            <a
              href="/"
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
              Back
            </a>
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
                      onAddFieldsToView={handleAddFieldsToView}
                      onViewFieldsReorder={handleFieldsReorder}
                    />
                  ) : (
                    <WorkflowLifecycleView
                      stages={workflowModel.stages}
                      onStepSelect={(stageId, processId, stepId) =>
                        handleStepSelect(stageId, processId, stepId)
                      }
                      activeStage={activeStage}
                      activeProcess={activeProcess}
                      activeStep={activeStep}
                    />
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
                  onRemoveFieldFromView={handleRemoveFieldFromView}
                  onAddFieldsToView={handleAddFieldsToView}
                  onAddFieldsToStep={handleAddFieldsToStep}
                  onFieldsReorder={(
                    selectedViewId: string,
                    fieldIds: number[],
                  ) => {
                    handleFieldsReorder(selectedViewId, fieldIds);
                  }}
                  onViewSelect={setSelectedView}
                  selectedView={selectedView}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Separator & Chat Panel */}
      <ResizeSeparator
        onMouseDown={onResizeMouseDown}
        onToggle={(e) => {
          e.stopPropagation();
          handleToggleChatPanel();
        }}
        isExpanded={isChatPanelExpanded}
      />

      {/* Chat Panel */}
      <motion.div
        className="border-l dark:border-gray-700 flex flex-col h-screen overflow-hidden text-sm"
        animate={{
          width: isChatPanelExpanded ? `${chatPanelWidth}px` : "0px",
          opacity: isChatPanelExpanded ? 1 : 0,
        }}
        transition={{ duration: 0.3 }}
        style={{
          minWidth: isChatPanelExpanded ? `${CHAT_MIN_WIDTH}px` : "0px",
          maxWidth: `${CHAT_MAX_WIDTH}px`,
          fontSize: "14px",
        }}
      >
        <div className="flex-1 overflow-hidden flex flex-col">
          <ChatPanelTabs
            active={activePanelTab}
            onChange={(tab) => setActivePanelTab(tab)}
          />

          <ChatPanelContent
            activeTab={activePanelTab}
            messages={messages}
            onSendMessage={handleSendMessage}
            isProcessing={isProcessing}
            caseId={parseInt(id)}
            onQuickAction={beginFreeFormSelection}
            onClearChat={handleClearChat}
          />
        </div>
      </motion.div>

      {/* Modals */}
      <AddFieldModal
        isOpen={isAddFieldModalOpen}
        onClose={() => setIsAddFieldModalOpen(false)}
        onAddField={async (field) => {
          await handleAddField(field);
        }}
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

      {/* Free Form selection overlay */}
      {isFreeFormSelecting && (
        <FreeFormSelectionOverlay
          selectionRect={selectionRect}
          onMouseDown={onSelectionMouseDown}
          onMouseMove={onSelectionMouseMove}
          onMouseUp={onSelectionMouseUp}
        />
      )}

      {/* Quick Chat floating overlay (non-blocking) */}
      {isQuickChatOpen && quickOverlayPosition && (
        <QuickChatOverlay
          position={quickOverlayPosition}
          selectionSummary={quickSelectionSummary}
          inputRef={quickInputRef as React.RefObject<HTMLInputElement | null>}
          value={quickChatText}
          onChange={setQuickChatText}
          onEnter={() => void sendQuickChat()}
          onEscape={() => setIsQuickChatOpen(false)}
        />
      )}
    </div>
  );
}
