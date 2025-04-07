import React, { useState } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "@hello-pangea/dnd";
import { Stage, Field, StepType, FieldReference } from "../types";
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
  onStepSelect: (stageId: string, stepId: string) => void;
  activeStage?: string;
  activeStep?: string;
  onStepsUpdate: (updatedStages: Stage[]) => void;
  onDeleteStage?: (stageId: string) => void;
  onDeleteStep?: (stageId: string, stepId: string) => void;
  onAddField: (field: {
    label: string;
    type: Field["type"];
    options?: string[];
    required?: boolean;
    primary?: boolean;
  }) => string;
  onUpdateField: (updates: Partial<Field>) => void;
  onDeleteField: (fieldId: string) => void;
}

const WorkflowDiagram: React.FC<WorkflowDiagramProps> = ({
  stages,
  fields,
  onStepSelect,
  activeStage,
  activeStep,
  onStepsUpdate,
  onDeleteStage,
  onDeleteStep,
  onAddField,
  onUpdateField,
  onDeleteField,
}) => {
  const [_isDragging, setIsDragging] = useState(false);
  const [isAddStepModalOpen, setIsAddStepModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<{
    type: "stage" | "step";
    id: string;
    stageId?: string;
    name: string;
    stepType?: StepType;
  } | null>(null);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [selectedStep, setSelectedStep] = useState<{
    stageId: string;
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
    if (!selectedStageId) return;

    const updatedStages = stages.map((stage) => {
      if (stage.name === selectedStageId) {
        return {
          ...stage,
          steps: [
            ...stage.steps,
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
      return stage;
    });

    onStepsUpdate(updatedStages);
    setIsAddStepModalOpen(false);
    setSelectedStageId(null);
  };

  const _handleDragStart = () => {
    setIsDragging(true);
  };

  const _handleDragEnd = (result: DropResult) => {
    setIsDragging(false);

    if (!result.destination) {
      return;
    }

    if (result.type === "stage") {
      // Handle stage reordering
      const sourceIndex = result.source.index;
      const destinationIndex = result.destination.index;

      const updatedStages = Array.from(stages);
      const [movedStage] = updatedStages.splice(sourceIndex, 1);
      updatedStages.splice(destinationIndex, 0, movedStage);

      // Save to session storage
      sessionStorage.setItem("workflowStages", JSON.stringify(updatedStages));

      onStepsUpdate(updatedStages);
      return;
    }

    // Handle step reordering within stages
    const sourceStageId = result.source.droppableId;
    const destinationStageId = result.destination.droppableId;
    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;

    const updatedStages = [...stages];
    const sourceStage = updatedStages.find((s) => s.name === sourceStageId);
    const destinationStage = updatedStages.find(
      (s) => s.name === destinationStageId,
    );

    if (!sourceStage || !destinationStage) {
      return;
    }

    const [movedStep] = sourceStage.steps.splice(sourceIndex, 1);
    destinationStage.steps.splice(destinationIndex, 0, movedStep);

    // Save to session storage
    sessionStorage.setItem("workflowStages", JSON.stringify(updatedStages));

    onStepsUpdate(updatedStages);
  };

  const handleAddStep = (stageId: string) => {
    setSelectedStageId(stageId);
    setIsAddStepModalOpen(true);
  };

  const handleEditClick = (
    type: "stage" | "step",
    id: string,
    stageId?: string,
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
    } else {
      const stage = stages.find((s) => s.name === stageId);
      const step = stage?.steps.find((s) => s.name === id);
      if (step) {
        setEditItem({
          type: "step",
          id: step.name,
          stageId,
          name: step.name,
          stepType: step.type,
        });
        setIsEditModalOpen(true);
      }
    }
  };

  const handleEditSubmit = (data: { name: string; type?: StepType }) => {
    if (!editItem) return;

    const updatedStages = stages.map((stage) => {
      if (editItem.type === "stage" && stage.name === editItem.name) {
        return {
          ...stage,
          name: data.name,
        };
      } else if (editItem.type === "step" && stage.name === editItem.stageId) {
        return {
          ...stage,
          steps: stage.steps.map((step) =>
            step.name === editItem.name
              ? { ...step, name: data.name, type: data.type || step.type }
              : step,
          ),
        };
      }
      return stage;
    });

    // Save to session storage
    sessionStorage.setItem("workflowStages", JSON.stringify(updatedStages));

    onStepsUpdate(updatedStages);
    setIsEditModalOpen(false);
    setEditItem(null);
  };

  const handleStepSelect = (stageId: string, stepId: string) => {
    const stage = stages.find((s) => s.name === stageId);
    const step = stage?.steps.find((s) => s.name === stepId);

    if (step) {
      // Map field references to full field objects
      const stepFields = (step.fields || []).map((fieldRef): Field => {
        const fullField = fields.find((f) => f.name === fieldRef.name);
        if (fullField) {
          return {
            ...fullField,
          };
        }
        // If field reference doesn't match any field, create a default field
        return {
          name: fieldRef.name,
          label: fieldRef.name,
          type: "Text",

          value: undefined,
        };
      });

      setSelectedStep({
        stageId,
        stepId,
        name: step.name,
        fields: stepFields,
        type: step.type,
      });
      setIsConfigModalOpen(true);
    }

    onStepSelect(stageId, stepId);
  };

  const _handleFieldChange = (
    fieldId: string,
    value: string | number | boolean,
  ): void => {
    if (!selectedStep) return;

    const updatedStages = stages.map((stage) => {
      if (stage.name === selectedStep.stageId) {
        return {
          ...stage,
          steps: stage.steps.map((step) => {
            if (step.name === selectedStep.stepId) {
              return {
                ...step,
                fields:
                  step.fields?.map((field) => {
                    if (field.name === fieldId) {
                      return { ...field, value };
                    }
                    return field;
                  }) || [],
              };
            }
            return step;
          }),
        };
      }
      return stage;
    });

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

    const fieldId = onAddField(field);

    const updatedStages = stages.map((stage: Stage) => {
      if (stage.name === selectedStep.stageId) {
        return {
          ...stage,
          steps: stage.steps.map((step) => {
            if (step.name === selectedStep.stepId) {
              const updatedFields = [
                ...(step.fields || []),
                { id: fieldId, value: null },
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
      return stage;
    });

    onStepsUpdate(updatedStages as Stage[]);
    return fieldId;
  };

  const handleAddExistingFieldToStep = (
    stepId: string,
    fieldIds: string[],
  ): void => {
    if (!selectedStep) return;

    const updatedStages = stages.map((stage: Stage) => {
      if (stage.name === selectedStep.stageId) {
        return {
          ...stage,
          steps: stage.steps.map((step) => {
            if (step.name === stepId) {
              const fieldsToAdd = fieldIds
                .map((fieldId) => {
                  const field = fields.find((f: Field) => f.name === fieldId);
                  if (!field) return null;
                  return {
                    id: fieldId,
                    name: field.name,
                    required: false,
                  } as FieldReference;
                })
                .filter((field): field is FieldReference => field !== null);

              const updatedFields = [...(step.fields || []), ...fieldsToAdd];

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
      return stage;
    });

    // Ensure we only keep FieldReference properties in the final stages
    const sanitizedStages = updatedStages.map((stage: Stage) => ({
      ...stage,
      steps: stage.steps.map((step) => ({
        ...step,
        fields: (step.fields || []).map(
          (field): FieldReference => ({
            name: field.name,
            required:
              typeof field.required === "boolean" ? field.required : false,
          }),
        ),
      })),
    })) as Stage[];

    onStepsUpdate(sanitizedStages);
  };

  // Type guard to check if a field is a Field type
  const isField = (field: Field | FieldReference): field is Field => {
    return "value" in field && "type" in field && "label" in field;
  };

  return (
    <div className="p-6">
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
                className="space-y-8"
              >
                {stages.map((stage, index) => (
                  <Draggable
                    key={stage.name}
                    draggableId={stage.name}
                    index={index}
                  >
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`p-6 rounded-xl border transform transition-all duration-500 ease-in-out
                          ${stage.isNew ? "animate-fade-in" : ""}
                          ${
                            snapshot.isDragging
                              ? "shadow-2xl ring-2 ring-blue-500/50"
                              : ""
                          }
                          ${
                            activeStage === stage.name
                              ? "border-blue-500/50 bg-blue-50/50 dark:bg-blue-900/10 shadow-lg"
                              : "border-gray-200/50 dark:border-gray-700/50"
                          }
                        `}
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div
                              {...provided.dragHandleProps}
                              className="cursor-grab active:cursor-grabbing p-1 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded"
                            >
                              <FaGripVertical className="text-gray-400" />
                            </div>
                            <div
                              className={`w-1 h-6 rounded stage-${index + 1}`}
                            />
                            <h3 className="font-semibold text-lg text-gray-700 dark:text-gray-200">
                              {stage.name}
                            </h3>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleAddStep(stage.name)}
                              className="inline-flex items-center px-3 py-1.5 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                            >
                              Add Step
                            </button>
                            <button
                              onClick={() =>
                                handleEditClick("stage", stage.name)
                              }
                              className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                              aria-label="Edit stage"
                            >
                              <FaPencilAlt className="w-4 h-4 text-gray-500" />
                            </button>
                            {onDeleteStage && (
                              <button
                                onClick={() => onDeleteStage(stage.name)}
                                className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                                aria-label="Delete stage"
                              >
                                <FaTrash className="w-4 h-4 text-gray-500" />
                              </button>
                            )}
                          </div>
                        </div>

                        <Droppable droppableId={stage.name} type="step">
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.droppableProps}
                              className={`space-y-2 ${
                                snapshot.isDraggingOver
                                  ? "bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2"
                                  : ""
                              }`}
                            >
                              {stage.steps.map((step, stepIndex) => (
                                <Draggable
                                  key={step.name}
                                  draggableId={step.name}
                                  index={stepIndex}
                                >
                                  {(provided, snapshot) => (
                                    <div
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      style={provided.draggableProps.style}
                                      className={`p-3 rounded-lg border transition-all cursor-pointer
                                        ${
                                          snapshot.isDragging
                                            ? "shadow-lg ring-2 ring-blue-500/50"
                                            : "hover:shadow-md"
                                        }
                                        ${
                                          activeStep === step.name
                                            ? "border-blue-500/50 bg-blue-50 dark:bg-blue-900/20"
                                            : "border-gray-200 dark:border-gray-700 hover:border-blue-500/30 dark:hover:border-blue-500/30"
                                        }
                                      `}
                                      onClick={() =>
                                        handleStepSelect(stage.name, step.name)
                                      }
                                    >
                                      <div className="flex items-center gap-3">
                                        <div
                                          {...provided.dragHandleProps}
                                          className="cursor-grab active:cursor-grabbing p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                                        >
                                          <FaGripVertical className="w-4 h-4 text-gray-400" />
                                        </div>
                                        <span className="text-xl">
                                          {getStepIcon(
                                            step.type || "Automation",
                                          )}
                                        </span>
                                        <span className="flex-1 font-medium text-gray-700 dark:text-gray-200">
                                          {step.name}
                                        </span>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleEditClick(
                                              "step",
                                              step.name,
                                              stage.name,
                                            );
                                          }}
                                          className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                                          aria-label="Edit step"
                                        >
                                          <FaPencilAlt className="w-4 h-4 text-gray-500" />
                                        </button>
                                        {onDeleteStep && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              onDeleteStep(
                                                stage.name,
                                                step.name,
                                              );
                                            }}
                                            className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                                            aria-label="Delete step"
                                          >
                                            <FaTrash className="w-4 h-4 text-gray-500" />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </Draggable>
                              ))}
                              {provided.placeholder}
                            </div>
                          )}
                        </Droppable>
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
          onClose={() => setIsAddStepModalOpen(false)}
          onAddStep={_handleAddStepSubmit}
        />

        {editItem && (
          <EditModal
            isOpen={isEditModalOpen}
            onClose={() => {
              setIsEditModalOpen(false);
              setEditItem(null);
            }}
            onSubmit={handleEditSubmit}
            type={editItem.type}
            initialData={{
              name: editItem.name,
              type: editItem.stepType,
            }}
          />
        )}

        {selectedStep && (
          <StepConfigurationModal
            isOpen={isConfigModalOpen}
            onClose={() => {
              setIsConfigModalOpen(false);
              setSelectedStep(null);
            }}
            step={{
              id: selectedStep.stepId,
              name: selectedStep.name,
              type: selectedStep.type,
              fields: selectedStep.fields,
            }}
            fields={fields}
            onAddField={handleAddFieldToStep}
            onUpdateField={onUpdateField}
            onDeleteField={onDeleteField}
            onAddExistingFieldToStep={handleAddExistingFieldToStep}
          />
        )}
      </div>
    </div>
  );
};

export default WorkflowDiagram;
