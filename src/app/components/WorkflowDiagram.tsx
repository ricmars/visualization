import React, { useState } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "@hello-pangea/dnd";
import {
  Stage,
  Field,
  StepType,
  FieldReference,
  Process,
  Step,
} from "../types";
import AddStepModal from "./AddStepModal";
import EditModal from "./EditModal";
import {
  FaClipboardList,
  FaCheckCircle,
  FaRobot,
  FaFolder,
  FaQuestionCircle,
  FaTrash,
  FaGripVertical,
  FaPencilAlt,
} from "react-icons/fa";
import { IoDocumentText } from "react-icons/io5";
import { RiBrainFill } from "react-icons/ri";
import { MdNotifications } from "react-icons/md";
import { BsGearFill } from "react-icons/bs";
import StepConfigurationModal from "./StepConfigurationModal";
import AddProcessModal from "./AddProcessModal";

interface WorkflowDiagramProps {
  stages: Stage[];
  fields: Field[];
  views: { id: number; name: string; model: string; caseID: number }[];
  onStepSelect: (stageId: number, processId: number, stepId: number) => void;
  activeStage?: number;
  activeProcess?: number;
  activeStep?: number;
  onStepsUpdate: (updatedStages: Stage[]) => void;
  onDeleteStage?: (stageId: number) => void;
  onDeleteProcess?: (stageId: number, processId: number) => void;
  onDeleteStep?: (stageId: number, processId: number, stepId: number) => void;
  onAddField: (field: {
    label: string;
    type: Field["type"];
    options?: string[];
    required?: boolean;
    primary?: boolean;
  }) => string;
  onUpdateField: (updates: Partial<Field>) => void;
  onDeleteField: (field: Field) => void;
  onAddProcess: (stageId: number, processName: string) => void;
  onAddStep: (
    stageId: number,
    processId: number,
    stepName: string,
    stepType: StepType,
  ) => void;
  onStageReorder: (startIndex: number, endIndex: number) => void;
  onProcessReorder: (
    stageId: number,
    startIndex: number,
    endIndex: number,
  ) => void;
  onStepReorder: (
    stageId: number,
    processId: number,
    startIndex: number,
    endIndex: number,
  ) => void;
}

interface EditItem {
  type: "stage" | "process" | "step";
  id: number;
  stageId?: number;
  processId?: number;
  name: string;
  stepType?: StepType;
}

const WorkflowDiagram: React.FC<WorkflowDiagramProps> = ({
  stages,
  fields,
  views,
  onStepSelect,
  activeStage,
  activeProcess,
  activeStep,
  onStepsUpdate,
  onDeleteStage,
  onDeleteProcess,
  onDeleteStep,
  onAddField,
  onUpdateField,
  onDeleteField,
  onAddProcess,
  onAddStep,
  onStageReorder,
  onProcessReorder,
  onStepReorder,
}) => {
  const [_isDragging, setIsDragging] = useState(false);
  const [_isAddProcessModalOpen, setIsAddProcessModalOpen] = useState(false);
  const [selectedStageId, setSelectedStageId] = useState<number | null>(null);
  const [selectedProcessId, setSelectedProcessId] = useState<number | null>(
    null,
  );
  const [isAddStepModalOpen, setIsAddStepModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<EditItem | null>(null);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [selectedStep, setSelectedStep] = useState<{
    id: number;
    stageId: number;
    processId: number;
    stepId: number;
    name: string;
    fields: FieldReference[];
    type: string;
  } | null>(null);

  const getStepIcon = (stepType: string) => {
    // Map step types to appropriate icons
    switch (stepType) {
      case "Collect information":
        return <FaClipboardList className="text-blue-500" />;
      case "Approve/Reject":
        return <FaCheckCircle className="text-green-500" />;
      case "Automation":
        return <BsGearFill className="text-purple-500" />;
      case "Create Case":
        return <FaFolder className="text-yellow-500" />;
      case "Decision":
        return <FaQuestionCircle className="text-orange-500" />;
      case "Generate Document":
        return <IoDocumentText className="text-gray-500" />;
      case "Generative AI":
        return <RiBrainFill className="text-pink-500" />;
      case "Robotic Automation":
        return <FaRobot className="text-indigo-500" />;
      case "Send Notification":
        return <MdNotifications className="text-red-500" />;
      default:
        return <BsGearFill className="text-gray-400" />;
    }
  };

  // Add Process Modal handler
  const openAddProcessModal = (stageId: number) => {
    setSelectedStageId(stageId);
    setIsAddProcessModalOpen(true);
  };
  const handleAddProcessSubmit = (data: { name: string }) => {
    if (!selectedStageId) return;
    // Call parent handler with stageId and process name
    onAddProcess(selectedStageId, data.name);
    setIsAddProcessModalOpen(false);
    setSelectedStageId(null);
  };

  // Add Step Modal handler
  const openAddStepModal = (stageId: number, processId: number) => {
    console.log("Opening Add Step Modal:", { stageId, processId });
    setSelectedStageId(stageId);
    setSelectedProcessId(processId);
    setIsAddStepModalOpen(true);
  };

  const handleAddStep = (
    stageId: number,
    processId: number,
    stepName: string,
    stepType: StepType,
  ) => {
    console.log("Adding Step:", { stageId, processId, stepName, stepType });
    onAddStep(stageId, processId, stepName, stepType);
    setIsAddStepModalOpen(false);
    setSelectedStageId(null);
    setSelectedProcessId(null);
  };

  const _handleDragStart = () => {
    setIsDragging(true);
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const { source, destination, type } = result;

    if (type === "stage") {
      onStageReorder(source.index, destination.index);
    } else if (type === "process") {
      const stageId = parseInt(result.source.droppableId.split("-")[1]);
      onProcessReorder(stageId, source.index, destination.index);
    } else if (type === "step") {
      const [stageId, processId] = result.source.droppableId
        .split("-")
        .slice(1)
        .map(Number);
      onStepReorder(stageId, processId, source.index, destination.index);
    }
  };

  const handleEditStage = (stageId: number) => {
    const stage = stages.find((s) => s.id === stageId);
    if (stage) {
      setEditItem({
        type: "stage",
        id: stage.id,
        name: stage.name,
      });
      setIsEditModalOpen(true);
    }
  };

  const handleEditProcess = (stageId: number, processId: number) => {
    const stage = stages.find((s) => s.id === stageId);
    const process = stage?.processes.find((p) => p.id === processId);
    if (process) {
      setEditItem({
        type: "process",
        id: process.id,
        stageId,
        name: process.name,
      });
      setIsEditModalOpen(true);
    }
  };

  const handleEditStep = (
    stageId: number,
    processId: number,
    stepId: number,
  ) => {
    const stage = stages.find((s) => s.id === stageId);
    const process = stage?.processes.find((p) => p.id === processId);
    const step = process?.steps.find((s) => s.id === stepId);
    if (step) {
      setEditItem({
        type: "step",
        id: step.id,
        stageId,
        processId,
        name: step.name,
        stepType: step.type,
      });
      setIsEditModalOpen(true);
    }
  };

  const handleEditSubmit = (data: {
    name: string;
    type?: StepType;
    fields?: never[];
  }) => {
    if (!editItem) return;

    const updatedStages = stages.map((stage) => {
      if (editItem.type === "stage" && stage.id === editItem.id) {
        return { ...stage, name: data.name };
      }

      if (editItem.type === "process" && stage.id === editItem.stageId) {
        return {
          ...stage,
          processes: stage.processes.map((process) =>
            process.id === editItem.id
              ? { ...process, name: data.name }
              : process,
          ),
        };
      }

      if (editItem.type === "step" && stage.id === editItem.stageId) {
        return {
          ...stage,
          processes: stage.processes.map((process) =>
            process.id === editItem.processId
              ? {
                  ...process,
                  steps: process.steps.map((step) =>
                    step.id === editItem.id
                      ? {
                          ...step,
                          name: data.name,
                          type: data.type || step.type,
                          fields:
                            data.type &&
                            editItem.stepType === "Collect information" &&
                            data.type !== "Collect information"
                              ? []
                              : step.fields,
                        }
                      : step,
                  ),
                }
              : process,
          ),
        };
      }
      return stage;
    });

    onStepsUpdate(updatedStages);
    setIsEditModalOpen(false);
    setEditItem(null);
  };

  const handleStepSelect = (
    stageId: number,
    processId: number,
    stepId: number,
  ) => {
    const stage = stages.find((s: Stage) => s.id === stageId);
    const process = stage?.processes.find((p: Process) => p.id === processId);
    const step = process?.steps.find((s: Step) => s.id === stepId);

    console.log("[DEBUG] Clicked step:", step);
    let stepFields: FieldReference[] = [];
    if (step && step.type === "Collect information" && step.viewId) {
      console.log("[DEBUG] Step has viewId:", step.viewId);
      const view = views.find((v) => v.id === step.viewId);
      console.log("[DEBUG] Found view:", view);
      if (view) {
        try {
          const viewModel = JSON.parse(view.model);
          console.log("[DEBUG] Parsed view model:", viewModel);
          if (Array.isArray(viewModel.fields)) {
            stepFields = viewModel.fields
              .map(
                (fieldRef: {
                  fieldId: number;
                  required?: boolean;
                  order?: number;
                }) => {
                  const field = fields.find((f) => f.id === fieldRef.fieldId);
                  console.log(
                    "[DEBUG] Mapping fieldRef",
                    fieldRef,
                    "to field",
                    field,
                  );
                  if (field) {
                    return {
                      fieldId: field.id,
                      required: fieldRef.required ?? false,
                    } as FieldReference;
                  }
                  return null;
                },
              )
              .filter(
                (f: FieldReference | null): f is FieldReference => f !== null,
              );
            console.log("[DEBUG] Final mapped stepFields:", stepFields);
          }
        } catch (_e) {
          console.log("[DEBUG] Error parsing view model for view:", view);
        }
      }
    }
    setSelectedStep(
      step
        ? {
            id: step.id,
            stageId,
            processId,
            stepId: step.id,
            name: step.name,
            fields: stepFields,
            type: step.type,
          }
        : null,
    );
    setIsConfigModalOpen(true);
    onStepSelect(stageId, processId, stepId);
  };

  const _handleFieldChange = (
    fieldId: number,
    value: string | number | boolean,
  ) => {
    const updatedStages = stages.map((stage: Stage) => ({
      ...stage,
      processes: stage.processes.map((process: Process) => ({
        ...process,
        steps: process.steps.map((step: Step) => {
          const field = step.fields?.find(
            (f: FieldReference) => f.fieldId === fieldId,
          );
          if (field) {
            return {
              ...step,
              fields: step.fields?.map((f: FieldReference) =>
                f.fieldId === fieldId ? { ...f, value } : f,
              ),
            };
          }
          return step;
        }),
      })),
    }));
    onStepsUpdate(updatedStages);
  };

  const handleAddFieldToStep = (field: {
    label: string;
    type: Field["type"];
    options?: string[];
    required?: boolean;
    primary?: boolean;
  }): string => {
    if (!selectedStep) return "";

    // Only allow adding fields to "Collect information" steps
    if (selectedStep.type !== "Collect information") {
      return "";
    }

    const fieldId = onAddField(field);

    const updatedStages = stages.map((stage: Stage) => {
      if (stage.id === selectedStep.stageId) {
        return {
          ...stage,
          processes: stage.processes.map((process) => {
            if (process.id === selectedStep.processId) {
              return {
                ...process,
                steps: process.steps.map((step) => {
                  if (step.id === selectedStep.stepId) {
                    // Find the field to get its ID
                    const field = fields.find((f) => f.name === fieldId);
                    const updatedFields = [
                      ...(step.fields || []),
                      {
                        fieldId: field?.id || 0,
                        required: false,
                      } as FieldReference,
                    ];

                    return {
                      ...step,
                      fields: updatedFields,
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

    onStepsUpdate(updatedStages);
    return fieldId;
  };

  const handleAddExistingFieldToStep = (
    stepId: number,
    fieldIds: number[],
  ): void => {
    if (!selectedStep) return;

    const updatedStages = stages.map((stage) => {
      if (stage.id === selectedStep.stageId) {
        return {
          ...stage,
          processes: stage.processes.map((process) => {
            if (process.id === selectedStep.processId) {
              return {
                ...process,
                steps: process.steps.map((step) => {
                  if (step.id === stepId) {
                    // Create new field references from the field IDs
                    const newFields = fieldIds
                      .map((fieldId) => {
                        // Find field by ID
                        const field = fields.find((f) => f.id === fieldId);
                        if (field) {
                          return {
                            fieldId: field.id,
                            required: false,
                          } as FieldReference;
                        }
                        return null;
                      })
                      .filter(
                        (field): field is FieldReference => field !== null,
                      );

                    const updatedStep = {
                      ...step,
                      fields: newFields,
                    };

                    // Update selectedStep state if this is the current step
                    if (selectedStep && selectedStep.stepId === step.id) {
                      setSelectedStep({
                        ...selectedStep,
                        fields: newFields,
                      });
                    }

                    return updatedStep;
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

    onStepsUpdate(updatedStages);
  };

  // Type guard to check if a field is a Field type

  return (
    <div className={`p-6 ${_isDragging ? "cursor-grabbing" : ""}`}>
      <div className="max-w-7xl mx-auto">
        <DragDropContext
          onDragStart={_handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <Droppable droppableId="stages" type="stage" direction="vertical">
            {(provided) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="space-y-6"
              >
                {stages.map((stage, stageIndex) => (
                  <Draggable
                    key={`stage-${stage.id}`}
                    draggableId={`stage-${stage.id}`}
                    index={stageIndex}
                  >
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`p-3 rounded-xl border transform transition-all duration-300 ease-in-out
                          ${stage.isNew ? "animate-fade-in" : ""}
                          ${
                            snapshot.isDragging
                              ? "shadow-2xl ring-2 ring-blue-500/50 bg-white dark:bg-gray-800 rotate-1 scale-[1.02] z-50"
                              : ""
                          }
                          ${
                            activeStage === stage.id
                              ? "border-blue-500/50 bg-blue-50/50 dark:bg-blue-900/10 shadow-lg"
                              : "border-gray-200/50 dark:border-gray-700/50"
                          }
                          ${
                            _isDragging && !snapshot.isDragging
                              ? "opacity-50"
                              : ""
                          }
                        `}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div
                              {...provided.dragHandleProps}
                              className="cursor-grab active:cursor-grabbing p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded"
                            >
                              <FaGripVertical className="text-gray-400" />
                            </div>
                            <div
                              className={`w-1 h-5 rounded stage-${
                                stageIndex + 1
                              }`}
                            />
                            <h3 className="font-semibold text-base text-gray-700 dark:text-gray-200">
                              {stage.name}
                            </h3>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openAddProcessModal(stage.id)}
                              className="flex items-center gap-2 text-blue-500 hover:text-blue-700"
                              data-testid={`add-process-${stage.id}`}
                            >
                              <BsGearFill className="h-4 w-4" />
                              Add Process
                            </button>
                            <button
                              onClick={() => handleEditStage(stage.id)}
                              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                              aria-label="Edit stage"
                            >
                              <FaPencilAlt className="w-3.5 h-3.5 text-gray-500" />
                            </button>
                            {onDeleteStage && (
                              <button
                                onClick={() => onDeleteStage(stage.id)}
                                className="p-1 text-red-500 hover:text-red-700"
                                data-testid={`delete-stage-${stage.id}`}
                              >
                                <FaTrash className="w-3.5 h-3.5 text-gray-500" />
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="p-2 space-y-2">
                          <Droppable
                            droppableId={`process-${stage.id}`}
                            type="process"
                          >
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                                className={`space-y-2 ${
                                  snapshot.isDraggingOver
                                    ? "bg-gray-50 dark:bg-gray-800/50 rounded-lg"
                                    : ""
                                }`}
                              >
                                {stage.processes.map(
                                  (process, processIndex) => (
                                    <Draggable
                                      key={`process-${process.id}`}
                                      draggableId={`process-${process.id}`}
                                      index={processIndex}
                                    >
                                      {(provided, snapshot) => (
                                        <div
                                          ref={provided.innerRef}
                                          {...provided.draggableProps}
                                          className={`border border-gray-200 dark:border-gray-700 rounded-lg p-2 ${
                                            snapshot.isDragging
                                              ? "shadow-lg ring-2 ring-blue-500/50"
                                              : ""
                                          }`}
                                        >
                                          <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                              <div
                                                {...provided.dragHandleProps}
                                                className="cursor-grab active:cursor-grabbing p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded"
                                              >
                                                <FaGripVertical className="w-3.5 h-3.5 text-gray-400" />
                                              </div>
                                              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                                {process.name}
                                              </h4>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <button
                                                onClick={() =>
                                                  openAddStepModal(
                                                    stage.id,
                                                    process.id,
                                                  )
                                                }
                                                className="flex items-center gap-2 text-blue-500 hover:text-blue-700"
                                                data-testid={`add-step-${process.id}`}
                                              >
                                                <BsGearFill className="h-4 w-4" />
                                                Add Step
                                              </button>
                                              <button
                                                onClick={() =>
                                                  handleEditProcess(
                                                    stage.id,
                                                    process.id,
                                                  )
                                                }
                                                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                                                aria-label="Edit process"
                                              >
                                                <FaPencilAlt className="w-3.5 h-3.5 text-gray-500" />
                                              </button>
                                              {onDeleteProcess && (
                                                <button
                                                  onClick={() =>
                                                    onDeleteProcess(
                                                      stage.id,
                                                      process.id,
                                                    )
                                                  }
                                                  className="p-1 text-red-500 hover:text-red-700"
                                                  data-testid={`delete-process-${process.id}`}
                                                >
                                                  <FaTrash className="w-3.5 h-3.5 text-gray-500" />
                                                </button>
                                              )}
                                            </div>
                                          </div>

                                          <Droppable
                                            droppableId={`step-${stage.id}-${process.id}`}
                                            type="step"
                                          >
                                            {(provided, snapshot) => (
                                              <div
                                                ref={provided.innerRef}
                                                {...provided.droppableProps}
                                                className={`space-y-1 ${
                                                  snapshot.isDraggingOver
                                                    ? "bg-gray-50 dark:bg-gray-800/50 rounded-lg p-1"
                                                    : ""
                                                }`}
                                              >
                                                {process.steps.map(
                                                  (step, stepIndex) => (
                                                    <Draggable
                                                      key={`step-${step.id}`}
                                                      draggableId={`step-${step.id}`}
                                                      index={stepIndex}
                                                    >
                                                      {(provided, snapshot) => (
                                                        <div
                                                          ref={
                                                            provided.innerRef
                                                          }
                                                          {...provided.draggableProps}
                                                          style={
                                                            provided
                                                              .draggableProps
                                                              .style
                                                          }
                                                          className={`p-2 rounded-lg border transition-all cursor-pointer
                                                        ${
                                                          snapshot.isDragging
                                                            ? "shadow-lg ring-2 ring-blue-500/50"
                                                            : "hover:shadow-md"
                                                        }
                                                        ${
                                                          activeStep ===
                                                            step.id &&
                                                          activeProcess ===
                                                            process.id &&
                                                          activeStage ===
                                                            stage.id
                                                            ? "border-blue-500/50 bg-blue-50 dark:bg-blue-900/20"
                                                            : "border-gray-200 dark:border-gray-700 hover:border-blue-500/30 dark:hover:border-blue-500/30"
                                                        }
                                                      `}
                                                          onClick={() =>
                                                            handleStepSelect(
                                                              stage.id,
                                                              process.id,
                                                              step.id,
                                                            )
                                                          }
                                                        >
                                                          <div className="flex items-center gap-2">
                                                            <div
                                                              {...provided.dragHandleProps}
                                                              className="cursor-grab active:cursor-grabbing p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                                                            >
                                                              <FaGripVertical className="w-3.5 h-3.5 text-gray-400" />
                                                            </div>
                                                            <span className="text-lg">
                                                              {getStepIcon(
                                                                step.type ||
                                                                  "Automation",
                                                              )}
                                                            </span>
                                                            <span className="flex-1 font-medium text-sm text-gray-700 dark:text-gray-200">
                                                              {step.name}
                                                            </span>
                                                            <div className="flex items-center gap-2">
                                                              <button
                                                                onClick={(
                                                                  e,
                                                                ) => {
                                                                  e.stopPropagation();
                                                                  handleEditStep(
                                                                    stage.id,
                                                                    process.id,
                                                                    step.id,
                                                                  );
                                                                }}
                                                                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                                                                aria-label="Edit step"
                                                              >
                                                                <FaPencilAlt className="w-3.5 h-3.5 text-gray-500" />
                                                              </button>
                                                              {onDeleteStep && (
                                                                <button
                                                                  onClick={(
                                                                    e,
                                                                  ) => {
                                                                    e.stopPropagation();
                                                                    onDeleteStep(
                                                                      stage.id,
                                                                      process.id,
                                                                      step.id,
                                                                    );
                                                                  }}
                                                                  className="p-1 text-red-500 hover:text-red-700"
                                                                  data-testid={`delete-step-${step.id}`}
                                                                  aria-label="Delete step"
                                                                >
                                                                  <FaTrash className="w-3.5 h-3.5 text-gray-500" />
                                                                </button>
                                                              )}
                                                            </div>
                                                          </div>
                                                        </div>
                                                      )}
                                                    </Draggable>
                                                  ),
                                                )}
                                                {provided.placeholder}
                                              </div>
                                            )}
                                          </Droppable>
                                        </div>
                                      )}
                                    </Draggable>
                                  ),
                                )}
                              </div>
                            )}
                          </Droppable>
                        </div>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        <AddProcessModal
          isOpen={_isAddProcessModalOpen}
          onClose={() => {
            setIsAddProcessModalOpen(false);
            setSelectedStageId(null);
          }}
          onAddProcess={handleAddProcessSubmit}
        />

        {isAddStepModalOpen && selectedStageId && selectedProcessId && (
          <AddStepModal
            isOpen={isAddStepModalOpen}
            onClose={() => {
              setIsAddStepModalOpen(false);
              setSelectedStageId(null);
              setSelectedProcessId(null);
            }}
            onAddStep={handleAddStep}
            stageId={selectedStageId}
            processId={selectedProcessId}
          />
        )}

        {editItem && (
          <EditModal
            isOpen={isEditModalOpen}
            onClose={() => {
              setIsEditModalOpen(false);
              setEditItem(null);
            }}
            type={editItem.type}
            name={editItem.name}
            stepType={editItem.stepType}
            onSubmit={handleEditSubmit}
          />
        )}

        {selectedStep && (
          <StepConfigurationModal
            isOpen={isConfigModalOpen}
            onClose={() => {
              setIsConfigModalOpen(false);
              setSelectedStep(null);
            }}
            step={selectedStep}
            fields={fields}
            onFieldChange={(
              fieldId: number,
              value: string | number | boolean,
            ) => {
              _handleFieldChange(fieldId, value);
            }}
            onAddField={handleAddFieldToStep}
            onAddExistingField={handleAddExistingFieldToStep}
            onUpdateField={onUpdateField}
            onDeleteField={onDeleteField}
          />
        )}
      </div>
    </div>
  );
};

export default WorkflowDiagram;
