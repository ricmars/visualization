"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";

// Dynamic imports to prevent SSR issues with Pega components
const WorkflowDiagram = dynamic(
  () => import("../../components/WorkflowDiagram"),
  { ssr: false },
);
const WorkflowLifecycleView = dynamic(
  () => import("../../components/WorkflowLifecycleView"),
  { ssr: false },
);
import { ChatMessage } from "../../components/ChatInterface";
import FreeFormSelectionOverlay from "./components/FreeFormSelectionOverlay";
import QuickChatOverlay from "./components/QuickChatOverlay";
import ResizeSeparator from "./components/ResizeSeparator";
import ChatPanelTabs from "./components/ChatPanelTabs";
import ChatPanelContent from "./components/ChatPanelContent";
import usePersistentTab from "./hooks/usePersistentTab";
import { useChatPanel } from "./hooks/useChatPanel";
import { useFreeFormSelection } from "./hooks/useFreeFormSelection";
import usePreviewIframe from "./hooks/usePreviewIframe";
import useStepsUpdate from "./hooks/useStepsUpdate";
import useFieldMutations from "./hooks/useFieldMutations";
import useWorkflowMutations from "./hooks/useWorkflowMutations";
import { useReorderHandlers } from "./hooks/useReorderHandlers";
import useChatMessaging from "./hooks/useChatMessaging";
import { useQuickChat } from "./hooks/useQuickChat";
import { useViewMutations } from "./hooks/useViewMutations";
import {
  ACTIVE_TAB_STORAGE_KEY,
  ACTIVE_PANEL_TAB_STORAGE_KEY,
  CHECKPOINTS_STORAGE_KEY,
  MAX_CHECKPOINTS,
  MODEL_UPDATED_EVENT,
  CHAT_PANEL_WIDTH_STORAGE_KEY,
  CHAT_PANEL_EXPANDED_STORAGE_KEY,
  CHAT_MIN_WIDTH,
  CHAT_MAX_WIDTH,
} from "./utils/constants";
import {
  Field,
  FieldReference,
  Stage,
  Process,
  Step,
  WorkflowModel,
} from "../../types";
// import { StepType } from "../../utils/stepTypes";
import { registerRuleTypes } from "../../types/ruleTypeDefinitions";
// validateModelIds handled inside useWorkflowData
import { useWorkflowData } from "./hooks/useWorkflowData";

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
//
import WorkflowTopBar from "./components/WorkflowTopBar";
import WorkflowToolbar from "./components/WorkflowToolbar";
import WorkflowTabs from "./components/WorkflowTabs";
import FieldsHeader from "./components/FieldsHeader";
import ViewsHeader from "./components/ViewsHeader";
import LoadingScreen from "./components/LoadingScreen";
import ErrorScreen from "./components/ErrorScreen";
import AddFieldModal from "../../components/AddFieldModal";
import EditFieldModal from "../../components/EditFieldModal";
import { DB_TABLES } from "../../types/database";
// view model helpers used inside useViewMutations (kept for types, not used here)
// fetchWithBaseUrl used in hooks/utilities
import AddStageModal from "../../components/AddStageModal";
import AddProcessModal from "../../components/AddProcessModal";
import EditWorkflowModal from "../../components/EditWorkflowModal";
import ModalPortal from "../../components/ModalPortal";
import { StepType } from "@/app/utils/stepTypes";

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

// Field shape expected by live preview (distinct from app database Field)
type PreviewField = {
  ID?: string;
  name: string;
  label: string;
  type: string;
  refType?: string;
  refName?: string;
  source?: "" | "User input" | "System" | "Integration" | "Calculated";
  highlighted?: boolean;
  primary?: boolean;
  fillAvailableSpace?: boolean;
  value?: string | number | boolean | Array<string>;
  displayValue?: string | Array<string>;
  options?: string[];
};

// moved to ./utils/constants

// DatabaseCase type provided by useWorkflowData

interface WorkflowState {
  stages: Stage[];
}

interface ComposedModel {
  name: string;
  description?: string;
  stages: Stage[];
}

export default function WorkflowPage() {
  // 1. Router and params hooks
  const params = useParams();
  const id = params?.id as string;

  // 2. All useState hooks
  const {
    model,
    setModelAction: setModel,
    fields,
    setFields,
    views,
    setViews,
    selectedCase,
    setSelectedCaseAction: setSelectedCase,
    loading,
    error,
    loadWorkflow: _loadWorkflow,
    refreshWorkflowData,
    fetchCaseData: _fetchCaseData,
  } = useWorkflowData(id);
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
    "lifecycle",
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
    resolveExternalIds: (rect) =>
      isPreviewMode
        ? requestSelectedIdsInRect(rect)
        : Promise.resolve({ fieldIds: [], viewIds: [] }),
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
                      id: step.viewId,
                      name: step.name,
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
        // For live preview, omit processes and provide flattened steps directly under the stage
        tmpStages.push({
          id: stage.id,
          name: stage.name,
          steps: tmpSteps,
        });
      }
      const fieldsWithValues: PreviewField[] = currentFields.map((f: any) => {
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
        return {
          ID: f?.id !== undefined && f?.id !== null ? String(f.id) : undefined,
          name: f.name,
          label: f.label,
          type: f.type,
          primary: f.primary,
          options: f.options,
          value,
        } as PreviewField;
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
  // quickInputRef already defined for QuickChatOverlay usage

  // 3. All useRef hooks
  const addFieldButtonRef = useRef<HTMLButtonElement>(null);
  const generatePreviewModelAction = useCallback(
    () => generateModelData(fields, workflowModel.stages),
    [fields, workflowModel.stages, generateModelData],
  );

  const { containerRef: previewContainerRef, requestSelectedIdsInRect } =
    usePreviewIframe({
      isPreviewMode,
      generateModelAction: generatePreviewModelAction,
    });

  // replaced by useQuickChat

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

  // Checkpoint helper must be defined before hooks that depend on it
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

  // Hooks that must always run every render (before any early returns)
  const { handleStepsUpdate } = useStepsUpdate({
    selectedCase,
    setSelectedCaseAction: (next) => setSelectedCase(next as any),
    setModelAction: setModel,
    eventName: MODEL_UPDATED_EVENT,
  });

  const { handleAddField, handleUpdateField, handleDeleteField } =
    useFieldMutations({
      selectedCase,
      fields,
      setFields,
      setModel,
      setSelectedCase: (next) => setSelectedCase(next as any),
      caseId: id,
      eventName: MODEL_UPDATED_EVENT,
      fetchCaseData: _fetchCaseData,
    });

  const {
    handleAddStep,
    handleAddProcess,
    handleDeleteStep,
    handleDeleteProcess,
    handleDeleteStage,
  } = useWorkflowMutations({
    selectedCase,
    workflowStages: workflowModel.stages,
    setSelectedCaseAction: (next) => setSelectedCase(next as any),
    setModelAction: setModel,
    setViewsAction: setViews,
    addCheckpointAction: addCheckpoint,
    caseId: id,
    eventName: MODEL_UPDATED_EVENT,
  });

  const { handleStageReorder, handleProcessReorder, handleStepReorder } =
    useReorderHandlers({
      stages: workflowModel.stages,
      setModelAction: setModel,
      setSelectedCaseAction: (next) => setSelectedCase(next as any),
      handleStepsUpdate,
      selectedCase,
    });

  const {
    handleAddFieldsToView,
    handleRemoveFieldFromView,
    handleAddFieldsToStep,
  } = useViewMutations({
    selectedCase,
    fields,
    views,
    setViewsAction: setViews,
    setModelAction: setModel,
    setSelectedCaseAction: (next) => setSelectedCase(next as any),
    eventName: MODEL_UPDATED_EVENT,
  });

  const { handleSendMessage, handleAbort } = useChatMessaging({
    messages,
    setMessagesAction: setMessages,
    setIsProcessingAction: setIsProcessing,
    selectedCase,
    stages: workflowModel.stages,
    refreshWorkflowDataAction: refreshWorkflowData,
    setSelectedViewAction: setSelectedView,
    setActiveStageAction: setActiveStage,
    setActiveProcessAction: setActiveProcess,
    setActiveStepAction: setActiveStep,
  });

  const quickInputRef = useRef<HTMLInputElement>(null);
  const { quickSelectionSummary, sendQuickChat } = useQuickChat({
    stages: workflowModel.stages,
    fields,
    views,
    selectedFieldIds: (selectedFieldIds as number[]) || [],
    selectedViewIds: (selectedViewIds as number[]) || [],
    selectedStageIds: (selectedStageIds as number[]) || [],
    selectedProcessIds: (selectedProcessIds as number[]) || [],
    selectedStepIds: (selectedStepIds as number[]) || [],
    messages,
    setMessagesAction: setMessages,
    setIsProcessingAction: setIsProcessing,
    selectedCase,
    refreshWorkflowDataAction: refreshWorkflowData,
    setSelectedViewAction: setSelectedView,
    setActiveStageAction: setActiveStage,
    setActiveProcessAction: setActiveProcess,
    setActiveStepAction: setActiveStep,
  });

  if (loading) {
    return <LoadingScreen />;
  }

  if (error) {
    return <ErrorScreen message={error} />;
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

  // workflow mutation handlers provided by hook called earlier

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
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Header row with title and preview switch */}
        <WorkflowTopBar
          selectedCaseName={selectedCase?.name}
          canEdit={Boolean(selectedCase)}
          onEditWorkflow={() => setIsEditWorkflowModalOpen(true)}
          isPreviewMode={isPreviewMode}
          onTogglePreview={() => setIsPreviewMode(!isPreviewMode)}
        />

        {/* Tabs - Only show when not in preview mode */}
        {!isPreviewMode && (
          <WorkflowTabs
            active={activeTab as any}
            onChange={setActiveTab as any}
          />
        )}

        {/* Main Content Area */}
        <main
          id="main-content-area"
          className="flex-1 overflow-auto relative"
          data-main-content="true"
        >
          {isPreviewMode ? (
            <div className="w-full h-full" ref={previewContainerRef} />
          ) : (
            <>
              {activeTab === "workflow" && (
                <>
                  <WorkflowToolbar
                    workflowView={workflowView}
                    onSetView={setWorkflowView}
                    onAddStage={() => setIsAddStageModalOpen(true)}
                  />
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
                      onEditStep={(stageId, processId, stepId) => {
                        // For lifecycle view editing, just select the step to show configuration
                        handleStepSelect(
                          stageId.toString(),
                          processId.toString(),
                          stepId.toString(),
                        );
                      }}
                      onDeleteStep={handleDeleteStep}
                      fields={fields}
                      readOnly={false}
                      onAddField={handleAddField}
                      onUpdateField={handleUpdateField}
                      onDeleteField={handleDeleteField}
                      onAddExistingField={(stepId, fieldIds) => {
                        // Convert field IDs to field names for the existing handler
                        const fieldNames = fieldIds
                          .map((id) => fields.find((f) => f.id === id)?.name)
                          .filter((name): name is string => !!name);
                        void handleAddFieldsToStep(
                          stepId,
                          fieldNames,
                          workflowModel.stages,
                        );
                      }}
                      onFieldChange={(fieldId, value) => {
                        // For now, this is read-only in lifecycle view
                        console.log(
                          "Field change in lifecycle view:",
                          fieldId,
                          value,
                        );
                      }}
                      views={views}
                      onAddFieldsToView={handleAddFieldsToView}
                      onStepsUpdate={handleStepsUpdate}
                      onAddProcess={(stageId, processName) =>
                        handleAddProcess(Number(stageId), processName)
                      }
                      onAddStep={(stageId, processId, stepName, stepType) =>
                        handleAddStep(
                          Number(stageId),
                          Number(processId),
                          stepName,
                          stepType as StepType,
                        )
                      }
                      onDeleteProcess={(stageId, processId) =>
                        handleDeleteProcess(Number(stageId), Number(processId))
                      }
                    />
                  )}
                </>
              )}
              {activeTab === "fields" && (
                <div className="p-6">
                  <FieldsHeader
                    count={fields.length}
                    onAddField={() => setIsAddFieldModalOpen(true)}
                    buttonRef={
                      addFieldButtonRef as React.RefObject<HTMLButtonElement>
                    }
                  />
                  <FieldsList
                    fields={fields}
                    onReorderFields={handleFieldsListReorder}
                    onDeleteField={handleDeleteField}
                    onEditField={handleEditField}
                  />
                </div>
              )}
              {activeTab === "views" && (
                <>
                  <ViewsHeader />
                  <ViewsPanel
                    stages={workflowModel.stages}
                    fields={fields}
                    views={views}
                    onAddField={handleAddField}
                    onUpdateField={handleUpdateField}
                    onDeleteField={handleDeleteField}
                    onRemoveFieldFromView={(field) =>
                      void handleRemoveFieldFromView(field, selectedView)
                    }
                    onAddFieldsToView={(viewId, fieldNames) =>
                      void handleAddFieldsToView(viewId, fieldNames)
                    }
                    onAddFieldsToStep={(stepId, fieldNames) =>
                      void handleAddFieldsToStep(
                        stepId,
                        fieldNames,
                        workflowModel.stages,
                      )
                    }
                    onFieldsReorder={(
                      selectedViewId: string,
                      fieldIds: number[],
                    ) => {
                      handleFieldsReorder(selectedViewId, fieldIds);
                    }}
                    onViewSelect={setSelectedView}
                    selectedView={selectedView}
                  />
                </>
              )}
            </>
          )}
        </main>

        {/* Modals - rendered in portal to isolate from main content */}
        <ModalPortal isOpen={isAddFieldModalOpen}>
          <AddFieldModal
            isOpen={isAddFieldModalOpen}
            onClose={() => setIsAddFieldModalOpen(false)}
            onAddField={async (field) => {
              await handleAddField(field);
            }}
            buttonRef={addFieldButtonRef as React.RefObject<HTMLButtonElement>}
            allowExistingFields={false}
          />
        </ModalPortal>

        <ModalPortal isOpen={!!editingField}>
          {editingField && (
            <EditFieldModal
              isOpen={!!editingField}
              onClose={() => setEditingField(null)}
              onSubmit={handleUpdateField}
              field={editingField}
            />
          )}
        </ModalPortal>

        <ModalPortal isOpen={isAddStageModalOpen}>
          <AddStageModal
            isOpen={isAddStageModalOpen}
            onClose={() => setIsAddStageModalOpen(false)}
            onAddStage={handleAddStage}
          />
        </ModalPortal>

        <ModalPortal isOpen={isAddProcessModalOpen}>
          <AddProcessModal
            isOpen={isAddProcessModalOpen}
            onClose={() => {
              setIsAddProcessModalOpen(false);
              setSelectedStageForProcess(null);
            }}
            onAddProcess={(processData: { name: string }) => {
              if (selectedStageForProcess) {
                handleAddProcess(
                  Number(selectedStageForProcess),
                  processData.name,
                );
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
        </ModalPortal>

        <ModalPortal isOpen={isEditWorkflowModalOpen}>
          <EditWorkflowModal
            isOpen={isEditWorkflowModalOpen}
            onClose={() => setIsEditWorkflowModalOpen(false)}
            onSubmit={handleEditWorkflow}
            initialData={{
              name: selectedCase?.name || "",
              description: selectedCase?.description || "",
            }}
          />
        </ModalPortal>
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
            onSendMessage={(message) => void handleSendMessage(message)}
            onAbort={() => handleAbort()}
            isProcessing={isProcessing}
            caseId={parseInt(id)}
            onQuickAction={beginFreeFormSelection}
            onClearChat={handleClearChat}
          />
        </div>
      </motion.div>

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
          onEnter={() => {
            void sendQuickChat(quickChatText);
            setIsQuickChatOpen(false);
            setQuickChatText("");
          }}
          onEscape={() => {
            setIsQuickChatOpen(false);
            setQuickChatText("");
          }}
        />
      )}
    </div>
  );
}
