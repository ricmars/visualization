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
import { v4 as uuidv4 } from "uuid";
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

interface WorkflowDiagramProps {
  stages: Stage[];
  fields: Field[];
  onStepSelect: (stageId: string, processId: string, stepId: string) => void;
  activeStage?: string;
  activeProcess?: string;
  activeStep?: string;
  onStepsUpdate: (updatedStages: Stage[]) => void;
  onDeleteStage?: (stageId: string) => void;
  onDeleteProcess?: (stageId: string, processId: string) => void;
  onDeleteStep?: (stageId: string, processId: string, stepId: string) => void;
  onAddField: (field: {
    label: string;
    type: Field["type"];
    options?: string[];
    required?: boolean;
    primary?: boolean;
  }) => string;
  onUpdateField: (updates: Partial<Field>) => void;
  onDeleteField: (fieldId: string) => void;
  onAddProcess: (stageId: string) => void;
}

interface _StepConfigurationModalProps {
  isOpen: boolean;
  onClose: () => void;
  step: {
    id: string;
    stageId: string;
    processId: string;
    stepId: string;
    name: string;
    fields: Field[];
    type: string;
  };
  fields: Field[];
  onFieldChange: (fieldId: string, value: string | number | boolean) => void;
  onAddField: (field: {
    label: string;
    type: Field["type"];
    options?: string[];
    required?: boolean;
    primary?: boolean;
  }) => string;
  onAddExistingField: (stepId: string, fieldIds: string[]) => void;
  onUpdateField: (updates: Partial<Field>) => void;
  onDeleteField: (fieldId: string) => void;
}

const WorkflowDiagram: React.FC<WorkflowDiagramProps> = ({
  stages,
  fields,
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
}) => {
  const [_isDragging, setIsDragging] = useState(false);
  const [_isAddProcessModalOpen, _setIsAddProcessModalOpen] = useState(false);
  const [_selectedProcessId, setSelectedProcessId] = useState<string | null>(
    null,
  );
  const [isAddStepModalOpen, setIsAddStepModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<{
    type: "stage" | "process" | "step";
    id: string;
    stageId?: string;
    processId?: string;
    name: string;
    stepType?: StepType;
  } | null>(null);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [selectedStep, setSelectedStep] = useState<{
    id: string;
    stageId: string;
    processId: string;
    stepId: string;
    name: string;
    fields: Field[];
    type: string;
  } | null>(null);

  const _getStageClass = (stage: Stage, index: number) => {
    const baseClass =
      "clip-path-chevron min-w-[var(--stage-min-width)] h-[var(--stage-height)] flex items-center justify-center p-4 text-white font-semibold text-shadow transition-all duration-500";
    const positionClass = `stage-${index + 1}`;

    let animationClass = "";
    if (stage.isNew) {
      animationClass = "animate-slide-in";
    } else if (stage.isDeleting) {
      animationClass = "animate-fade-out";
    } else if (stage.isMoving) {
      animationClass =
        stage.moveDirection === "up" ? "animate-move-up" : "animate-move-down";
    }

    const activeClass =
      activeStage === stage.name ? "ring-2 ring-white ring-opacity-70" : "";

    return `${baseClass} ${positionClass} ${animationClass} ${activeClass}`;
  };

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

  const _handleWorkflowUpdate = (updatedStages: Stage[]) => {
    onStepsUpdate(updatedStages);
  };

  const _handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const _handleAddStepSubmit = (stepData: { name: string; type: StepType }) => {
    if (!selectedStageId || !_selectedProcessId) return;

    const updatedStages = stages.map((stage) => {
      if (stage.name === selectedStageId) {
        return {
          ...stage,
          processes: stage.processes.map((process) => {
            if (process.name === _selectedProcessId) {
              return {
                ...process,
                steps: [
                  ...process.steps,
                  {
                    id: uuidv4(),
                    name: stepData.name,
                    type: stepData.type,
                    status: "pending" as const,
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
    });

    onStepsUpdate(updatedStages);
    setIsAddStepModalOpen(false);
    setSelectedStageId(null);
    setSelectedProcessId(null);
  };

  const _handleDragStart = () => {
    setIsDragging(true);
  };

  const _handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const sourceDroppableId = result.source.droppableId;
    const destinationDroppableId = result.destination.droppableId;

    // Handle stage reordering
    if (sourceDroppableId === "stages" && destinationDroppableId === "stages") {
      const newStages = Array.from(stages);
      const [removed] = newStages.splice(result.source.index, 1);
      newStages.splice(result.destination.index, 0, removed);
      onStepsUpdate(newStages);
      return;
    }

    // Handle process reordering
    if (
      sourceDroppableId.startsWith("processes-") &&
      destinationDroppableId.startsWith("processes-")
    ) {
      const sourceStageId = sourceDroppableId.replace("processes-", "");
      const destStageId = destinationDroppableId.replace("processes-", "");

      const newStages = Array.from(stages);
      const sourceStage = newStages.find((s) => s.name === sourceStageId);
      const destStage = newStages.find((s) => s.name === destStageId);

      if (!sourceStage || !destStage) return;

      const [removedProcess] = sourceStage.processes.splice(
        result.source.index,
        1,
      );
      destStage.processes.splice(result.destination.index, 0, removedProcess);

      onStepsUpdate(newStages);
      return;
    }

    // Handle step reordering within a process
    const [sourceStageId, sourceProcessId] = sourceDroppableId.split(":");
    const [destStageId, destProcessId] = destinationDroppableId.split(":");

    const newStages = Array.from(stages);
    const sourceStage = newStages.find((s) => s.name === sourceStageId);
    const destStage = newStages.find((s) => s.name === destStageId);

    if (!sourceStage || !destStage) return;

    const sourceProcess = sourceStage.processes.find(
      (p) => p.name === sourceProcessId,
    );
    const destProcess = destStage.processes.find(
      (p) => p.name === destProcessId,
    );

    if (!sourceProcess || !destProcess) return;

    const newSourceSteps = Array.from(sourceProcess.steps);
    const [removed] = newSourceSteps.splice(result.source.index, 1);

    if (sourceProcessId === destProcessId) {
      // Reordering within the same process
      newSourceSteps.splice(result.destination.index, 0, removed);
      sourceProcess.steps = newSourceSteps;
    } else {
      // Moving between processes
      const newDestSteps = Array.from(destProcess.steps);
      newDestSteps.splice(result.destination.index, 0, removed);
      sourceProcess.steps = newSourceSteps;
      destProcess.steps = newDestSteps;
    }

    onStepsUpdate(newStages);
  };

  const handleAddProcess = (stageId: string) => {
    onAddProcess(stageId);
  };

  const handleAddStep = (stageId: string, processId: string) => {
    setSelectedStageId(stageId);
    setSelectedProcessId(processId);
    setIsAddStepModalOpen(true);
  };

  const handleEditClick = (
    type: "stage" | "process" | "step",
    id: string,
    stageId?: string,
    processId?: string,
  ) => {
    if (type === "stage") {
      const stage = stages.find((s) => s.name === id);
      if (stage) {
        setEditItem({
          type: "stage",
          id: stage.name,
          name: stage.name,
        });
        setIsEditModalOpen(true);
      }
    } else if (type === "process") {
      const stage = stages.find((s) => s.name === stageId);
      const process = stage?.processes.find((p) => p.name === id);
      if (process) {
        setEditItem({
          type: "process",
          id: process.name,
          stageId,
          name: process.name,
        });
        setIsEditModalOpen(true);
      }
    } else {
      const stage = stages.find((s) => s.name === stageId);
      const process = stage?.processes.find((p) => p.name === processId);
      const step = process?.steps.find((s) => s.name === id);
      if (step) {
        setEditItem({
          type: "step",
          id: step.name,
          stageId,
          processId,
          name: step.name,
          stepType: step.type,
        });
        setIsEditModalOpen(true);
      }
    }
  };

  const handleEditSubmit = (data: {
    name: string;
    type?: StepType;
    fields?: never[];
  }) => {
    if (!editItem) return;

    const updatedStages = stages.map((stage) => {
      if (editItem.type === "stage" && stage.name === editItem.name) {
        return {
          ...stage,
          name: data.name,
        };
      } else if (
        editItem.type === "process" &&
        stage.name === editItem.stageId
      ) {
        return {
          ...stage,
          processes: stage.processes.map((process) =>
            process.name === editItem.name
              ? { ...process, name: data.name }
              : process,
          ),
        };
      } else if (editItem.type === "step" && stage.name === editItem.stageId) {
        return {
          ...stage,
          processes: stage.processes.map((process) =>
            process.name === editItem.processId
              ? {
                  ...process,
                  steps: process.steps.map((step) =>
                    step.name === editItem.name
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
    stageId: string,
    processId: string,
    stepId: string,
  ) => {
    const stage = stages.find((s: Stage) => s.name === stageId);
    const process = stage?.processes.find((p: Process) => p.name === processId);
    const step = process?.steps.find((s: Step) => s.name === stepId);

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

      setSelectedStep({
        id: step.name,
        stageId,
        processId,
        stepId: step.name,
        name: step.name,
        fields: stepFields,
        type: step.type,
      });
      setIsConfigModalOpen(true);
    }

    onStepSelect(stageId, processId, stepId);
  };

  const _handleFieldChange = (
    fieldId: string,
    value: string | number | boolean,
  ) => {
    const updatedStages = stages.map((stage: Stage) => ({
      ...stage,
      processes: stage.processes.map((process: Process) => ({
        ...process,
        steps: process.steps.map((step: Step) => {
          const field = step.fields?.find(
            (f: FieldReference) => f.name === fieldId,
          );
          if (field) {
            return {
              ...step,
              fields: step.fields?.map((f: FieldReference) =>
                f.name === fieldId ? { ...f, value } : f,
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
      if (stage.name === selectedStep.stageId) {
        return {
          ...stage,
          processes: stage.processes.map((process) => {
            if (process.name === selectedStep.processId) {
              return {
                ...process,
                steps: process.steps.map((step) => {
                  if (step.name === selectedStep.stepId) {
                    const updatedFields = [
                      ...(step.fields || []),
                      { name: fieldId, required: false },
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
    stepId: string,
    fieldIds: string[],
  ): void => {
    if (!selectedStep) return;

    // Only allow adding fields to "Collect information" steps
    if (selectedStep.type !== "Collect information") {
      return;
    }

    const updatedStages = stages.map((stage: Stage) => {
      if (stage.name === selectedStep.stageId) {
        return {
          ...stage,
          processes: stage.processes.map((process) => {
            if (process.name === selectedStep.processId) {
              return {
                ...process,
                steps: process.steps.map((step) => {
                  if (step.name === stepId) {
                    const fieldsToAdd = fieldIds
                      .map((fieldId) => {
                        const field = fields.find((f) => f.name === fieldId);
                        if (!field) return null;
                        return {
                          name: field.name,
                          required: false,
                        } as FieldReference;
                      })
                      .filter(
                        (field): field is FieldReference => field !== null,
                      );

                    const updatedFields = [
                      ...(step.fields || []),
                      ...fieldsToAdd,
                    ];

                    setSelectedStep({
                      ...selectedStep,
                      fields: updatedFields.map((field): Field => {
                        const existingField = fields.find(
                          (f) => f.name === field.name,
                        );
                        if (existingField) {
                          return {
                            ...existingField,
                            value: isField(field) ? field.value : undefined,
                          };
                        }
                        return {
                          name: field.name,
                          label: field.name,
                          type: "Text",
                          value: undefined,
                        } as Field;
                      }),
                    });

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
  };

  // Type guard to check if a field is a Field type
  const isField = (field: Field | FieldReference): field is Field => {
    return "value" in field && "type" in field && "label" in field;
  };

  return (
    <div className={`p-6 ${_isDragging ? "cursor-grabbing" : ""}`}>
      <div className="max-w-7xl mx-auto">
        <DragDropContext
          onDragStart={_handleDragStart}
          onDragEnd={_handleDragEnd}
        >
          <Droppable droppableId="stages" type="stage" direction="vertical">
            {(provided) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="space-y-6"
              >
                {stages.map((stage, index) => (
                  <Draggable
                    key={`stage-${stage.name}-${index}`}
                    draggableId={`stage-${stage.name}-${index}`}
                    index={index}
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
                            activeStage === stage.name
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
                              className={`w-1 h-5 rounded stage-${index + 1}`}
                            />
                            <h3 className="font-semibold text-base text-gray-700 dark:text-gray-200">
                              {stage.name}
                            </h3>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleAddProcess(stage.name)}
                              className="inline-flex items-center px-2 py-1 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                            >
                              Add Process
                            </button>
                            <button
                              onClick={() =>
                                handleEditClick("stage", stage.name)
                              }
                              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                              aria-label="Edit stage"
                            >
                              <FaPencilAlt className="w-3.5 h-3.5 text-gray-500" />
                            </button>
                            {onDeleteStage && (
                              <button
                                onClick={() => onDeleteStage(stage.name)}
                                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                                aria-label="Delete stage"
                              >
                                <FaTrash className="w-3.5 h-3.5 text-gray-500" />
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="p-2 space-y-2">
                          <Droppable
                            droppableId={`processes-${stage.name}`}
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
                                      key={`process-${stage.name}-${process.name}-${processIndex}`}
                                      draggableId={`process-${stage.name}-${process.name}-${processIndex}`}
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
                                                  handleAddStep(
                                                    stage.name,
                                                    process.name,
                                                  )
                                                }
                                                className="inline-flex items-center px-1.5 py-0.5 text-sm bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                                              >
                                                Add Step
                                              </button>
                                              <button
                                                onClick={() =>
                                                  handleEditClick(
                                                    "process",
                                                    process.name,
                                                    stage.name,
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
                                                      stage.name,
                                                      process.name,
                                                    )
                                                  }
                                                  className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                                                  aria-label="Delete process"
                                                >
                                                  <FaTrash className="w-3.5 h-3.5 text-gray-500" />
                                                </button>
                                              )}
                                            </div>
                                          </div>

                                          <Droppable
                                            droppableId={`${stage.name}:${process.name}`}
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
                                                      key={`step-${stage.name}-${process.name}-${step.name}-${stepIndex}`}
                                                      draggableId={`step-${stage.name}-${process.name}-${step.name}-${stepIndex}`}
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
                                                            step.name &&
                                                          activeProcess ===
                                                            process.name &&
                                                          activeStage ===
                                                            stage.name
                                                            ? "border-blue-500/50 bg-blue-50 dark:bg-blue-900/20"
                                                            : "border-gray-200 dark:border-gray-700 hover:border-blue-500/30 dark:hover:border-blue-500/30"
                                                        }
                                                      `}
                                                          onClick={() =>
                                                            handleStepSelect(
                                                              stage.name,
                                                              process.name,
                                                              step.name,
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
                                                                  handleEditClick(
                                                                    "step",
                                                                    step.name,
                                                                    stage.name,
                                                                    process.name,
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
                                                                      stage.name,
                                                                      process.name,
                                                                      step.name,
                                                                    );
                                                                  }}
                                                                  className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
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

        <AddStepModal
          isOpen={isAddStepModalOpen}
          onClose={() => {
            setIsAddStepModalOpen(false);
            setSelectedStageId(null);
            setSelectedProcessId(null);
          }}
          onAddStep={_handleAddStepSubmit}
        />

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
            onFieldChange={_handleFieldChange}
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
