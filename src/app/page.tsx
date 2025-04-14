"use client";

import {
  useState,
  useCallback,
  useRef,
  useEffect,
  MutableRefObject,
} from "react";
import WorkflowDiagram from "./components/WorkflowDiagram";
import { ChatInterface } from "./components/ChatInterface";
import { Service, ChatRole } from "./services/service";
import {
  Stage,
  Message,
  Delta,
  Field,
  StepType,
  FieldReference,
  Process,
  Step,
} from "./types";
import AddFieldModal from "./components/AddFieldModal";
import { motion } from "framer-motion";
import defaultModel from "./model.json";
import { v4 as uuidv4 } from "uuid";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";
import AddStageModal from "./components/AddStageModal";
import { FaPencilAlt, FaTrash } from "react-icons/fa";
import EditFieldModal from "./components/EditFieldModal";
import {
  DragDropContext as _DragDropContext,
  DropResult,
} from "@hello-pangea/dnd";
import { default as _StepForm } from "./components/StepForm";
import { getFieldTypeDisplayName } from "./utils/fieldTypes";
import { generateSampleValue } from "./utils/sampleValues";
import ViewsPanel from "./components/ViewsPanel";
import WorkflowLifecycleView from "./components/WorkflowLifecycleView";
import AddProcessModal from "./components/AddProcessModal";

interface ChatMessage {
  role: ChatRole;
  content: string;
}

interface WorkflowDelta {
  type: "add" | "delete" | "move" | "update";
  path: string;
  target: {
    type: "stage" | "step";
    id?: string;
    name?: string;
    sourceStageId?: string;
    targetStageId?: string;
    sourceIndex?: number;
    targetIndex?: number;
  };
  changes: {
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
  };
}

const SESSION_STORAGE_KEY = "workflow_stages";
const ACTIVE_TAB_STORAGE_KEY = "active_tab";
const MODEL_UPDATED_EVENT = "modelUpdated";

export default function Home() {
  const [stages, setStages] = useState<Stage[]>([]);
  const [workflowName, setWorkflowName] = useState<string>("Investigation");
  const [activeStage, setActiveStage] = useState<string>();
  const [activeProcess, setActiveProcess] = useState<string>();
  const [activeStep, setActiveStep] = useState<string>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [_chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatPanelWidth, setChatPanelWidth] = useState(500);
  const [isResizing, setIsResizing] = useState(false);
  const [isChatPanelExpanded, setIsChatPanelExpanded] = useState(true);
  const startX = useRef(0);
  const startWidth = useRef(0);
  const [_isModalOpen, _setModalOpen] = useState(false);
  const [fields, setFields] = useState<Field[]>([]);
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [_isAddStepModalOpen, setIsAddStepModalOpen] = useState(false);
  const [_isDragging, setIsDragging] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "workflow" | "fields" | "views" | "fields"
  >("workflow");
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isAddStageModalOpen, setIsAddStageModalOpen] = useState(false);
  const [isAddFieldModalOpen, setIsAddFieldModalOpen] = useState(false);
  const [editingField, setEditingField] = useState<Field | null>(null);
  const addFieldButtonRef = useRef<HTMLButtonElement>(
    null,
  ) as MutableRefObject<HTMLButtonElement>;
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [workflowView, setWorkflowView] = useState<"flat" | "lifecycle">(
    "flat",
  );
  const [selectedProcessId, setSelectedProcessId] = useState<string | null>(
    null,
  );
  const [_selectedStep, _setSelectedStep] = useState<{
    stageId: string;
    processId: string;
    stepId: string;
    name: string;
    fields: Field[];
    type: StepType;
  } | null>(null);
  const [_isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isAddProcessModalOpen, setIsAddProcessModalOpen] = useState(false);

  // Load saved tab from localStorage after initial render
  useEffect(() => {
    const savedTab = localStorage.getItem(ACTIVE_TAB_STORAGE_KEY) as
      | "workflow"
      | "fields"
      | "views"
      | "fields";
    if (savedTab) {
      setActiveTab(savedTab);
    }
  }, []);

  // Save tab to localStorage when it changes
  useEffect(() => {
    localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, activeTab);
  }, [activeTab]);

  // Function to generate the model data structure
  const generateModelData = useCallback(
    (currentFields: Field[], currentStages: Stage[]) => {
      const tmpStages = [];
      /* Iterate over currentStages - iterate over processes and steps - processes is not needed */
      for (const stage of currentStages) {
        const tmpSteps = [];
        for (const process of stage.processes) {
          for (const step of process.steps) {
            tmpSteps.push(step);
          }
        }
        tmpStages.push({
          ...stage,
          steps: tmpSteps,
        });
      }
      return {
        fullUpdate: true,
        appName: "My Application",
        channel: "WorkPortal",
        industry: "Banking",
        userName: "John Smith",
        userLocale: "en-EN",
        caseName: workflowName,
        caseTypes: [
          {
            name: workflowName,
            fields: currentFields,
            creationFields: [],
            stages: tmpStages,
          },
        ],
      };
    },
    [workflowName],
  );

  // Effect to send model updates to iframe when the model is updated
  useEffect(() => {
    const handleModelUpdate = () => {
      if (isPreviewMode && previewContainerRef.current) {
        const iframe = previewContainerRef.current.querySelector("iframe");
        if (iframe) {
          const model = generateModelData(fields, stages);
          iframe.contentWindow?.postMessage(model, "*");
        }
      }
    };

    // Add custom event listener
    window.addEventListener(MODEL_UPDATED_EVENT, handleModelUpdate);

    return () => {
      window.removeEventListener(MODEL_UPDATED_EVENT, handleModelUpdate);
    };
  }, [isPreviewMode, generateModelData, fields, stages]);

  // Load stages and fields from session storage or default model
  useEffect(() => {
    const loadData = () => {
      const savedStages = sessionStorage.getItem(SESSION_STORAGE_KEY);
      const savedFields = sessionStorage.getItem("workflow_fields");
      const savedWorkflowName = sessionStorage.getItem("workflow_name");
      const initialStages = savedStages
        ? JSON.parse(savedStages)
        : defaultModel.stages;
      const initialFields = savedFields
        ? JSON.parse(savedFields)
        : defaultModel.fields || [];
      const initialWorkflowName = savedWorkflowName || defaultModel.name;

      setStages(initialStages);
      setFields(initialFields);
      setWorkflowName(initialWorkflowName);

      // Save workflow name to session storage if not already present
      if (!savedWorkflowName) {
        sessionStorage.setItem("workflow_name", defaultModel.name);
      }

      // Set initial welcome message
      setMessages([
        {
          id: "welcome",
          type: "json",
          content: {
            message:
              "Welcome! I can help you manage your workflow. Here is your current workflow:",
            model: {
              name: initialWorkflowName,
              stages: initialStages,
              fields: initialFields,
            },
            visualization: {
              totalStages: initialStages.length,
              stageBreakdown: initialStages.map((stage: Stage) => ({
                name: stage.name,
                stepCount: stage.processes.reduce(
                  (total, process) => total + process.steps.length,
                  0,
                ),
                processes: stage.processes.map((process) => ({
                  name: process.name,
                  steps: process.steps.map((step) => ({
                    name: step.name,
                  })),
                })),
              })),
            },
          },
          sender: "ai",
        },
      ]);
    };

    loadData();
    // This effect should only run once on mount to initialize data from storage
  }, []);

  // Save stages to session storage whenever they change
  useEffect(() => {
    if (stages.length > 0) {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(stages));
      // Dispatch custom event after model update
      window.dispatchEvent(new Event(MODEL_UPDATED_EVENT));
    }
  }, [stages]);

  const handleAddField = (fieldData: {
    label: string;
    type: Field["type"];
    options?: string[];
    required?: boolean;
    primary?: boolean;
  }) => {
    const newField: Field = {
      name: uuidv4(),
      label: fieldData.label,
      type: fieldData.type,
      primary: fieldData.primary || false,
      value: generateSampleValue(fieldData.type, fieldData.options),
      ...(fieldData.options && { options: fieldData.options }),
    };

    setFields((prevFields) => {
      const updatedFields = [...prevFields, newField];
      sessionStorage.setItem("workflow_fields", JSON.stringify(updatedFields));
      // Dispatch custom event after model update
      window.dispatchEvent(new Event(MODEL_UPDATED_EVENT));
      return updatedFields;
    });

    return newField.name;
  };

  const handleUpdateField = (updates: Partial<Field>) => {
    if (!updates.name) return; // Ensure we have a field name to update

    // First update the field in the fields array
    setFields((prevFields) => {
      const updatedFields = prevFields.map((field) =>
        field.name === updates.name ? { ...field, ...updates } : field,
      );
      sessionStorage.setItem("workflow_fields", JSON.stringify(updatedFields));
      // Dispatch custom event after model update
      window.dispatchEvent(new Event(MODEL_UPDATED_EVENT));
      return updatedFields;
    });

    // Then update all references to this field in all steps
    setStages((prevStages) => {
      const updatedStages = prevStages.map((stage) => ({
        ...stage,
        processes: stage.processes.map((process) => ({
          ...process,
          steps: process.steps.map((step) => ({
            ...step,
            fields: (step.fields || []).map((field) => ({
              ...field,
              // Only update the name if it matches
              name: field.name === updates.name ? updates.name : field.name,
            })),
          })),
        })),
      }));
      sessionStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify(updatedStages),
      );
      // Dispatch custom event after model update
      window.dispatchEvent(new Event(MODEL_UPDATED_EVENT));
      return updatedStages;
    });
  };

  const handleUpdateWorkflowName = (newName: string) => {
    setWorkflowName(newName);
    sessionStorage.setItem("workflow_name", newName);
  };

  const handleDeleteField = (fieldId: string) => {
    // Remove the field from the fields array
    setFields((prevFields) => {
      const updatedFields = prevFields.filter(
        (field) => field.name !== fieldId,
      );
      sessionStorage.setItem("workflow_fields", JSON.stringify(updatedFields));
      // Dispatch custom event after model update
      window.dispatchEvent(new Event(MODEL_UPDATED_EVENT));
      return updatedFields;
    });

    // Remove references to this field from all steps
    setStages((prevStages) => {
      const updatedStages = prevStages.map((stage) => ({
        ...stage,
        processes: stage.processes.map((process) => ({
          ...process,
          steps: process.steps.map((step) => ({
            ...step,
            fields: (step.fields || []).filter((f) => f.name !== fieldId),
          })),
        })),
      }));
      sessionStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify(updatedStages),
      );
      // Dispatch custom event after model update
      window.dispatchEvent(new Event(MODEL_UPDATED_EVENT));
      return updatedStages;
    });
  };

  const addMessage = (message: Message) => {
    setMessages((prev) => [...prev, message]);
  };

  const generateDelta = (oldStages: Stage[], newStages: Stage[]): Delta[] => {
    const deltas: WorkflowDelta[] = [];

    // Check for added or deleted stages
    const oldStageIds = new Set(oldStages.map((s) => s.name));
    const newStageIds = new Set(newStages.map((s) => s.name));

    // Added stages
    newStages.forEach((stage) => {
      if (!oldStageIds.has(stage.name)) {
        deltas.push({
          type: "add",
          path: `/stages/${stage.name}`,
          target: {
            type: "stage",
            id: stage.name,
            name: stage.name,
          },
          changes: {
            after: stage as unknown as Record<string, unknown>,
          },
        });
      }
    });

    // Deleted stages
    oldStages.forEach((stage) => {
      if (!newStageIds.has(stage.name)) {
        deltas.push({
          type: "delete",
          path: `/stages/${stage.name}`,
          target: {
            type: "stage",
            id: stage.name,
            name: stage.name,
          },
          changes: {
            before: stage as unknown as Record<string, unknown>,
          },
        });
      }
    });

    // Check for moved or updated steps within processes
    oldStages.forEach((oldStage) => {
      const newStage = newStages.find((s) => s.name === oldStage.name);
      if (!newStage) return;

      oldStage.processes.forEach((oldProcess) => {
        const newProcess = newStage.processes.find(
          (p) => p.name === oldProcess.name,
        );
        if (!newProcess) return;

        // Compare steps
        const newStepIds = new Set(newProcess.steps.map((step) => step.name));

        // Check for moved steps within the same process
        oldProcess.steps.forEach((oldStep, oldIndex) => {
          const newStepIndex = newProcess.steps.findIndex(
            (step) => step.name === oldStep.name,
          );
          if (newStepIndex !== -1 && newStepIndex !== oldIndex) {
            deltas.push({
              type: "move",
              path: `/stages/${oldStage.name}/processes/${oldProcess.name}/steps/${oldStep.name}`,
              target: {
                type: "step",
                id: oldStep.name,
                name: oldStep.name,
                sourceStageId: oldStage.name,
                targetStageId: newStage.name,
                sourceIndex: oldIndex,
                targetIndex: newStepIndex,
              },
              changes: {
                before: oldProcess.steps[oldIndex] as unknown as Record<
                  string,
                  unknown
                >,
                after: {
                  ...newProcess.steps[newStepIndex],
                } as unknown as Record<string, unknown>,
              },
            });
          }
        });

        // Check for steps that moved between processes
        oldProcess.steps.forEach((oldStep) => {
          if (!newStepIds.has(oldStep.name)) {
            // Find which process this step moved to
            let targetProcess: Process | undefined;
            let targetStage: Stage | undefined;

            for (const s of newStages) {
              for (const p of s.processes) {
                if (p.steps.some((step) => step.name === oldStep.name)) {
                  targetProcess = p;
                  targetStage = s;
                  break;
                }
              }
              if (targetProcess) break;
            }

            if (targetProcess && targetStage) {
              const newIndex = targetProcess.steps.findIndex(
                (step) => step.name === oldStep.name,
              );
              deltas.push({
                type: "move",
                path: `/stages/${oldStage.name}/processes/${oldProcess.name}/steps/${oldStep.name}`,
                target: {
                  type: "step",
                  id: oldStep.name,
                  name: oldStep.name,
                  sourceStageId: oldStage.name,
                  targetStageId: targetStage.name,
                  sourceIndex: oldProcess.steps.findIndex(
                    (step) => step.name === oldStep.name,
                  ),
                  targetIndex: newIndex,
                },
                changes: {
                  before: oldStep as unknown as Record<string, unknown>,
                  after: { name: targetStage.name } as unknown as Record<
                    string,
                    unknown
                  >,
                },
              });
            }
          }
        });
      });
    });

    return deltas;
  };

  const handleStepsUpdate = (updatedStages: Stage[]) => {
    const oldStages = stages;
    setStages(updatedStages);
    const deltas = generateDelta(oldStages, updatedStages);
    const _deltas_str = JSON.stringify(deltas, null, 2);

    // Add a message showing the changes
    const responseMessage: Message = {
      id: Date.now().toString(),
      type: "json",
      content: {
        message: "Changes applied successfully",
        action: {
          type: "update",
          changes: deltas.map((delta) => ({
            type: delta.type,
            path: delta.path,
            target: delta.target || {
              type: "step",
              id: "",
              name: "",
              sourceStageId: "",
              targetStageId: "",
              sourceIndex: 0,
              targetIndex: 0,
            },
            value: delta.changes?.after as Partial<Stage | Step> | null,
            oldValue: delta.changes?.before as Stage | Step | null,
          })),
        },
        model: {
          before: oldStages,
          after: updatedStages,
        },
        visualization: {
          totalStages: updatedStages.length,
          stageBreakdown: updatedStages.map((stage) => ({
            name: stage.name,
            stepCount: stage.processes.reduce(
              (total, process) => total + process.steps.length,
              0,
            ),
            processes: stage.processes.map((process) => ({
              name: process.name,
              steps: process.steps.map((step) => ({
                name: step.name,
              })),
            })),
          })),
        },
      },
      sender: "ai",
    };
    addMessage(responseMessage);

    // Apply animation flags
    const animatedStages = updatedStages.map((stage) => {
      const delta = deltas.find(
        (d) =>
          (d.target?.type === "stage" && d.target?.name === stage.name) ||
          (d.target?.type === "step" &&
            (d.target?.sourceStageId === stage.name ||
              d.target?.targetStageId === stage.name)),
      );

      if (delta?.target) {
        switch (delta.type) {
          case "add":
            return { ...stage, isNew: true };
          case "delete":
            return { ...stage, isDeleting: true };
          case "move":
            if (delta.target?.type === "step") {
              const isSource = delta.target?.sourceStageId === stage.name;
              const isTarget = delta.target?.targetStageId === stage.name;
              if (isSource || isTarget) {
                return {
                  ...stage,
                  isMoving: true,
                  moveDirection: isSource ? ("up" as const) : ("down" as const),
                };
              }
            }
            return stage;
          default:
            return stage;
        }
      }
      return stage;
    });

    // Update stages with animation flags
    setStages(animatedStages);

    // Remove animation flags after animation completes
    setTimeout(() => {
      setStages(
        updatedStages.map((stage) => ({
          ...stage,
          isNew: undefined,
          isDeleting: undefined,
          isMoving: undefined,
          moveDirection: undefined,
        })),
      );
    }, 500);
  };

  const handleStepSelect = (
    stageId: string,
    processId: string,
    stepId: string,
  ) => {
    setActiveStage(stageId);
    setActiveProcess(processId);
    setActiveStep(stepId);

    const stage = stages.find((s) => s.name === stageId);
    const process = stage?.processes.find((p) => p.name === processId);
    const step = process?.steps.find((s) => s.name === stepId);

    if (step) {
      const stepFields = (step.fields || []).map(
        (fieldRef: FieldReference): Field => {
          const fullField = fields.find((f) => f.name === fieldRef.name);
          if (fullField) {
            return {
              ...fullField,
            };
          }
          return {
            name: fieldRef.name,
            label: fieldRef.name,
            type: "Text" as const,
            value: undefined,
          };
        },
      );

      _setSelectedStep({
        stageId,
        processId,
        stepId,
        name: step.name,
        fields: stepFields,
        type: step.type,
      });
      setIsConfigModalOpen(true);
    }
  };

  const _handleFieldChange = (
    fieldId: string,
    value: string | number | boolean | null,
  ): void => {
    if (!activeStep || !activeStage || !activeProcess) return;

    setStages((prevStages) => {
      const updatedStages = prevStages.map((stage) => {
        if (stage.name === activeStage) {
          return {
            ...stage,
            processes: stage.processes.map((process) => {
              if (process.name === activeProcess) {
                return {
                  ...process,
                  steps: process.steps.map((step) => {
                    if (step.name === activeStep) {
                      return {
                        ...step,
                        fields: (step.fields || []).map((field) =>
                          field.name === fieldId ? { ...field, value } : field,
                        ),
                      };
                    }
                    return step;
                  }),
                };
              }
              return process;
            }),
          };
        }
        return stage;
      });
      sessionStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify(updatedStages),
      );
      // Dispatch custom event after model update
      window.dispatchEvent(new Event(MODEL_UPDATED_EVENT));
      return updatedStages;
    });
  };

  const _handleWorkflowUpdate = async (workflow: Stage[]): Promise<void> => {
    setStages(workflow);
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(workflow));
  };

  const _getActiveStepFields = (): FieldReference[] => {
    if (!activeStage || !activeStep || !activeProcess) return [];
    const stage = stages.find((s) => s.name === activeStage);
    if (!stage) return [];
    const process = stage.processes.find((p) => p.name === activeProcess);
    if (!process) return [];
    const step = process.steps.find((s) => s.name === activeStep);
    return step?.fields || [];
  };

  const _handleMouseDown = (_event: React.MouseEvent): void => {
    setIsResizing(true);
    startX.current = _event.pageX;
    startWidth.current = chatPanelWidth;
  };

  const _handleAddStepSubmit = (stepData: {
    name: string;
    type: StepType;
  }): void => {
    if (!selectedStageId || !selectedProcessId) return;

    setStages((prevStages) =>
      prevStages.map((stage) => {
        if (stage.name === selectedStageId) {
          return {
            ...stage,
            processes: stage.processes.map((process) => {
              if (process.name === selectedProcessId) {
                return {
                  ...process,
                  steps: [
                    ...process.steps,
                    {
                      name: stepData.name,
                      type: stepData.type,
                      fields: [],
                    },
                  ],
                };
              }
              return process;
            }),
          };
        }
        return stage;
      }),
    );

    setIsAddStepModalOpen(false);
    setSelectedStageId(null);
    setSelectedProcessId(null);
  };

  const _handleDragStart = (): void => {
    setIsDragging(true);
  };

  const _handleDragEnd = (result: DropResult): void => {
    setIsDragging(false);

    if (!result.destination) {
      return;
    }

    const [sourceStageId, sourceProcessId] =
      result.source.droppableId.split("-");
    const [destStageId, destProcessId] =
      result.destination.droppableId.split("-");

    const updatedStages = [...stages];
    const sourceStage = updatedStages.find((s) => s.name === sourceStageId);
    const destStage = updatedStages.find((s) => s.name === destStageId);

    if (!sourceStage || !destStage) return;

    const sourceProcess = sourceStage.processes.find(
      (p) => p.name === sourceProcessId,
    );
    const destProcess = destStage.processes.find(
      (p) => p.name === destProcessId,
    );

    if (!sourceProcess || !destProcess) return;

    const [movedStep] = sourceProcess.steps.splice(result.source.index, 1);
    destProcess.steps.splice(result.destination.index, 0, movedStep);

    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(updatedStages));
    setStages(updatedStages);
  };

  const handleAddStage = (stageData: { name: string }) => {
    const newStage: Stage = {
      name: stageData.name,
      processes: [],
      isNew: true,
    };

    setStages((prevStages) => {
      const updatedStages = [...prevStages, newStage];
      sessionStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify(updatedStages),
      );
      // Dispatch custom event after model update
      window.dispatchEvent(new Event(MODEL_UPDATED_EVENT));
      return updatedStages;
    });
    setIsAddStageModalOpen(false);
  };

  const handleEditField = (fieldId: string) => {
    const field = fields.find((f) => f.name === fieldId);
    if (field) {
      setEditingField(field);
    }
  };

  const handleDeleteStage = (stageId: string) => {
    const updatedStages = stages.filter((stage) => stage.name !== stageId);
    handleStepsUpdate(updatedStages);
  };

  const handleDeleteProcess = (stageId: string, processId: string) => {
    const updatedStages = stages.map((stage) => {
      if (stage.name === stageId) {
        return {
          ...stage,
          processes: stage.processes.filter(
            (process) => process.name !== processId,
          ),
        };
      }
      return stage;
    });
    handleStepsUpdate(updatedStages);
  };

  const handleDeleteStep = (
    stageId: string,
    processId: string,
    stepId: string,
  ) => {
    const updatedStages = stages.map((stage) => {
      if (stage.name === stageId) {
        return {
          ...stage,
          processes: stage.processes.map((process) => {
            if (process.name === processId) {
              return {
                ...process,
                steps: process.steps.filter((step) => step.name !== stepId),
              };
            }
            return process;
          }),
        };
      }
      return stage;
    });
    handleStepsUpdate(updatedStages);
  };

  const handleSendMessage = async (message: string) => {
    try {
      setIsProcessing(true);

      // Add user message immediately
      setMessages((prev) => [
        ...prev,
        {
          id: uuidv4(),
          type: "text",
          content: message,
          sender: "user",
        },
      ]);

      // Add a placeholder AI message that will be updated with streaming content
      const aiMessageId = uuidv4();
      setMessages((prev) => [
        ...prev,
        {
          id: aiMessageId,
          type: "text",
          content: "",
          sender: "ai",
        },
      ]);

      // Accumulate the complete response during streaming
      let completeResponse = "";

      // Handle streaming updates
      const updateAiMessage = (chunk: string) => {
        completeResponse += chunk;
        setMessages((prev) => {
          const newMessages = [...prev];
          const aiMessageIndex = newMessages.findIndex(
            (msg) => msg.id === aiMessageId,
          );
          if (aiMessageIndex !== -1) {
            newMessages[aiMessageIndex] = {
              ...newMessages[aiMessageIndex],
              content: completeResponse,
            };
          }
          return newMessages;
        });
      };

      await Service.generateResponse(
        message,
        {
          name: workflowName,
          stages,
          fields,
        },
        updateAiMessage,
      );

      // Only parse and update the model once streaming is complete
      const cleanedResponse = completeResponse
        .replace(/^```json\n/, "")
        .replace(/\n```$/, "")
        .trim();
      const parsedResponse = JSON.parse(cleanedResponse);

      // Batch all model updates together
      const updatedFields = parsedResponse.model?.fields
        ? [...parsedResponse.model.fields]
        : null;
      const updatedStages = parsedResponse.model?.stages
        ? [...parsedResponse.model.stages]
        : null;
      const updatedName =
        parsedResponse.model?.name !== workflowName
          ? parsedResponse.model.name
          : null;

      // Apply all updates at once
      if (updatedName) {
        handleUpdateWorkflowName(updatedName);
      }

      if (updatedStages) {
        await _handleWorkflowUpdate(updatedStages);
      }

      if (updatedFields) {
        setFields(updatedFields);
        sessionStorage.setItem(
          "workflow_fields",
          JSON.stringify(updatedFields),
        );
      }

      // Only dispatch model update event once at the end if any updates occurred
      if (updatedName || updatedStages || updatedFields) {
        window.dispatchEvent(new Event(MODEL_UPDATED_EVENT));
      }

      // Update the AI message with the final structured response
      setMessages((prev) => {
        const newMessages = [...prev];
        const aiMessageIndex = newMessages.findIndex(
          (msg) => msg.id === aiMessageId,
        );
        if (aiMessageIndex !== -1) {
          newMessages[aiMessageIndex] = {
            id: aiMessageId,
            type: "json",
            content: parsedResponse,
            sender: "ai",
          };
        }
        return newMessages;
      });
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: uuidv4(),
          type: "text",
          content: "Sorry, there was an error processing your request.",
          sender: "ai",
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const _handleMouseMove = useCallback(
    (_e: MouseEvent) => {
      if (!isResizing) return;
      const delta = _e.clientX - startX.current;
      const newWidth = Math.max(300, Math.min(800, startWidth.current + delta));
      setChatPanelWidth(newWidth);
    },
    [isResizing],
  );

  const _handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  const handleClearChat = () => {
    setMessages([]);
    setChatHistory([]);
  };

  const handleAddExistingFieldToStep = (stepId: string, fieldIds: string[]) => {
    // For views tab
    if (activeTab === "views") {
      setStages((prevStages) => {
        const updatedStages = prevStages.map((stage) => ({
          ...stage,
          processes: stage.processes.map((process) => ({
            ...process,
            steps: process.steps.map((step) => {
              if (step.name === stepId && step.type === "Collect information") {
                // Get existing fields
                const existingFields = step.fields || [];

                // Create a map to store unique field references
                const uniqueFieldsMap = new Map<FieldReference, boolean>();

                // First, add existing fields to the map
                existingFields.forEach((field) => {
                  uniqueFieldsMap.set(field, true);
                });

                // Then add new fields, ensuring uniqueness
                const newFields = fieldIds.map((fieldId) => ({
                  name: fieldId,
                  required:
                    existingFields.find((f) => f.name === fieldId)?.required ??
                    false,
                }));

                newFields.forEach((field) => {
                  uniqueFieldsMap.set(field, true);
                });

                return {
                  ...step,
                  fields: Array.from(uniqueFieldsMap.keys()),
                };
              }
              return step;
            }),
          })),
        }));
        sessionStorage.setItem(
          SESSION_STORAGE_KEY,
          JSON.stringify(updatedStages),
        );
        // Dispatch custom event after model update
        window.dispatchEvent(new Event(MODEL_UPDATED_EVENT));
        return updatedStages;
      });
      return;
    }

    // For workflow tab
    if (!_selectedStep) return;

    setStages((prevStages) => {
      const updatedStages = prevStages.map((stage) => {
        if (stage.name === _selectedStep.stageId) {
          return {
            ...stage,
            processes: stage.processes.map((process) => {
              if (process.name === _selectedStep.processId) {
                return {
                  ...process,
                  steps: process.steps.map((step) => {
                    if (step.name === stepId) {
                      // Get existing fields
                      const existingFields = step.fields || [];

                      // Create a map to store unique field references
                      const uniqueFieldsMap = new Map<
                        FieldReference,
                        boolean
                      >();

                      // First, add existing fields to the map
                      existingFields.forEach((field) => {
                        uniqueFieldsMap.set(field, true);
                      });

                      // Then add new fields, ensuring uniqueness
                      const newFields = fieldIds.map((fieldId) => ({
                        name: fieldId,
                        required:
                          existingFields.find((f) => f.name === fieldId)
                            ?.required ?? false,
                      }));

                      newFields.forEach((field) => {
                        uniqueFieldsMap.set(field, true);
                      });

                      return {
                        ...step,
                        fields: Array.from(uniqueFieldsMap.keys()),
                      };
                    }
                    return step;
                  }),
                };
              }
              return process;
            }),
          };
        }
        return stage;
      });
      sessionStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify(updatedStages),
      );
      // Dispatch custom event after model update
      window.dispatchEvent(new Event(MODEL_UPDATED_EVENT));
      return updatedStages;
    });
  };

  const handleFieldsReorder = (stepId: string, fieldIds: string[]) => {
    // For views tab
    if (activeTab === "views") {
      setStages((prevStages) => {
        const updatedStages = prevStages.map((stage) => ({
          ...stage,
          processes: stage.processes.map((process) => ({
            ...process,
            steps: process.steps.map((step) => {
              if (step.name === stepId && step.type === "Collect information") {
                // Ensure unique field references
                const uniqueFieldIds = Array.from(new Set(fieldIds));
                return {
                  ...step,
                  fields: uniqueFieldIds.map((fieldId) => ({
                    name: fieldId,
                    required:
                      step.fields?.find((f) => f.name === fieldId)?.required ??
                      false,
                  })),
                };
              }
              return step;
            }),
          })),
        }));
        sessionStorage.setItem(
          SESSION_STORAGE_KEY,
          JSON.stringify(updatedStages),
        );
        // Dispatch custom event after model update
        window.dispatchEvent(new Event(MODEL_UPDATED_EVENT));
        return updatedStages;
      });
      return;
    }

    // For workflow tab
    if (!_selectedStep) return;

    // Only allow reordering fields in "Collect information" steps
    const stage = stages.find((s) => s.name === _selectedStep.stageId);
    const process = stage?.processes.find(
      (p) => p.name === _selectedStep.processId,
    );
    const step = process?.steps.find((s) => s.name === stepId);

    if (!step || step.type !== "Collect information") {
      return;
    }

    setStages((prevStages) => {
      const updatedStages = prevStages.map((stage) => {
        if (stage.name === _selectedStep.stageId) {
          return {
            ...stage,
            processes: stage.processes.map((process) => {
              if (process.name === _selectedStep.processId) {
                return {
                  ...process,
                  steps: process.steps.map((step) => {
                    if (step.name === stepId) {
                      // Ensure unique field references
                      const uniqueFieldIds = Array.from(new Set(fieldIds));
                      return {
                        ...step,
                        fields: uniqueFieldIds.map((fieldId) => ({
                          name: fieldId,
                          required:
                            step.fields?.find((f) => f.name === fieldId)
                              ?.required ?? false,
                        })),
                      };
                    }
                    return step;
                  }),
                };
              }
              return process;
            }),
          };
        }
        return stage;
      });
      sessionStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify(updatedStages),
      );
      // Dispatch custom event after model update
      window.dispatchEvent(new Event(MODEL_UPDATED_EVENT));
      return updatedStages;
    });
  };

  const handleAddProcess = (stageId: string) => {
    setSelectedStageId(stageId);
    setIsAddProcessModalOpen(true);
  };

  const handleAddProcessSubmit = (data: { name: string }) => {
    if (!selectedStageId) return;

    setStages((prevStages) =>
      prevStages.map((stage) => {
        if (stage.name === selectedStageId) {
          return {
            ...stage,
            processes: [
              ...stage.processes,
              {
                name: data.name,
                steps: [],
              },
            ],
          };
        }
        return stage;
      }),
    );

    setIsAddProcessModalOpen(false);
    setSelectedStageId(null);
  };

  // Handle iframe creation and cleanup
  useEffect(() => {
    let iframe: HTMLIFrameElement | null = null;
    // Capture the ref value at the start of the effect
    const container = previewContainerRef.current;

    if (isPreviewMode && container) {
      iframe = container.querySelector("iframe");
      if (!iframe) {
        iframe = document.createElement("iframe");
        iframe.src =
          "https://blueprint2024-8b147.web.app/blueprint-preview.html";
        iframe.className = "w-full h-full border-0";
        iframe.title = "Blueprint Preview";

        // Once the iframe loads, send the model data
        iframe.onload = () => {
          if (iframe) {
            const model = generateModelData(fields, stages);
            iframe.contentWindow?.postMessage(model, "*");
          }
        };

        container.appendChild(iframe);
      }
    }

    // Cleanup function to remove iframe when preview mode is disabled
    return () => {
      if (container && iframe) {
        container.removeChild(iframe);
      }
    };
  }, [isPreviewMode, fields, stages, generateModelData]); // Add missing dependencies

  return (
    <div className="flex h-screen bg-white dark:bg-gray-900">
      {/* Toggle Button */}
      <button
        onClick={() => setIsChatPanelExpanded(!isChatPanelExpanded)}
        className="fixed right-0 top-4 p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-l-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 shadow-sm z-50"
        aria-label={
          isChatPanelExpanded ? "Collapse AI Assistant" : "Expand AI Assistant"
        }
      >
        {isChatPanelExpanded ? (
          <FaChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        ) : (
          <FaChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        )}
      </button>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header row with title and preview switch */}
        <div className="flex justify-between items-center p-6 pb-3 pr-[200px]">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            {workflowName}
            <button
              onClick={() => {
                const newName = prompt(
                  "Enter new workflow name:",
                  workflowName,
                );
                if (newName) {
                  handleUpdateWorkflowName(newName);
                }
              }}
              className="ml-2 p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 inline-flex items-center"
              aria-label="Edit workflow name"
            >
              <FaPencilAlt className="w-4 h-4 text-gray-500" />
            </button>
          </h1>
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

        {/* Tab Content */}
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
                      stages={stages}
                      fields={fields}
                      onStepSelect={handleStepSelect}
                      activeStage={activeStage}
                      activeProcess={activeProcess}
                      activeStep={activeStep}
                      onStepsUpdate={handleStepsUpdate}
                      onDeleteStage={handleDeleteStage}
                      onDeleteProcess={handleDeleteProcess}
                      onDeleteStep={handleDeleteStep}
                      onAddField={handleAddField}
                      onUpdateField={handleUpdateField}
                      onDeleteField={handleDeleteField}
                      onAddProcess={handleAddProcess}
                    />
                  ) : (
                    <WorkflowLifecycleView
                      stages={stages}
                      onStepSelect={handleStepSelect}
                      activeStage={activeStage}
                      activeProcess={activeProcess}
                      activeStep={activeStep}
                    />
                  )}
                  <AddStageModal
                    isOpen={isAddStageModalOpen}
                    onClose={() => setIsAddStageModalOpen(false)}
                    onAddStage={handleAddStage}
                  />
                  <AddProcessModal
                    isOpen={isAddProcessModalOpen}
                    onClose={() => setIsAddProcessModalOpen(false)}
                    onAddProcess={handleAddProcessSubmit}
                  />
                </>
              )}
              {activeTab === "views" && (
                <div className="h-full">
                  <ViewsPanel
                    stages={stages}
                    fields={fields}
                    onAddField={handleAddField}
                    onUpdateField={handleUpdateField}
                    onDeleteField={handleDeleteField}
                    onAddExistingFieldToStep={handleAddExistingFieldToStep}
                    onFieldsReorder={handleFieldsReorder}
                  />
                </div>
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
                    {fields
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
                                onClick={() => handleEditField(field.name)}
                                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                              >
                                <FaPencilAlt className="w-4 h-4 text-gray-500" />
                              </button>
                              <button
                                onClick={() => handleDeleteField(field.name)}
                                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                              >
                                <FaTrash className="w-4 h-4 text-gray-500" />
                              </button>
                            </div>
                          </div>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Type: {getFieldTypeDisplayName(field.type)}
                          </p>
                        </div>
                      ))}
                  </div>
                  <AddFieldModal
                    isOpen={isAddFieldModalOpen}
                    onClose={() => setIsAddFieldModalOpen(false)}
                    onAddField={handleAddField}
                    buttonRef={addFieldButtonRef}
                    allowExistingFields={false}
                  />
                </div>
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
        <div className="flex-1 overflow-hidden">
          <ChatInterface
            messages={messages}
            onSendMessage={handleSendMessage}
            onClear={handleClearChat}
            isProcessing={isProcessing}
          />
        </div>
      </motion.div>

      {editingField && (
        <EditFieldModal
          isOpen={!!editingField}
          onClose={() => setEditingField(null)}
          onSubmit={handleUpdateField}
          field={editingField}
        />
      )}
    </div>
  );
}
