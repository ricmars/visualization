import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Stage, Step, Field, FieldValue } from '../types';
import AddStepModal from './AddStepModal';
import EditModal from './EditModal';
import { v4 as uuidv4 } from 'uuid';
import { FaClipboardList, FaCheckCircle, FaRobot, FaFolder, FaQuestionCircle, FaTrash, FaGripVertical, FaPencilAlt } from 'react-icons/fa';
import { IoDocumentText } from 'react-icons/io5';
import { RiBrainFill } from 'react-icons/ri';
import { MdNotifications } from 'react-icons/md';
import { BsGearFill } from 'react-icons/bs';
import StepConfigurationModal from './StepConfigurationModal';

interface WorkflowDiagramProps {
  stages: Stage[];
  fields: Field[];
  onStepSelect: (stageId: string, stepId: string) => void;
  activeStage?: string;
  activeStep?: string;
  onStepsUpdate: (updatedStages: Stage[]) => void;
  onDeleteStage?: (stageId: string) => void;
  onDeleteStep?: (stageId: string, stepId: string) => void;
  onAddField: (field: { label: string; type: Field['type']; options?: string[] }) => string;
  onUpdateField: (updates: Partial<Field>) => void;
  onDeleteField: (fieldId: string) => void;
}

export const WorkflowDiagram: React.FC<WorkflowDiagramProps> = ({
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
  onDeleteField
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isAddStepModalOpen, setIsAddStepModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<{
    type: 'stage' | 'step';
    id: string;
    stageId?: string;
    name: string;
    stepType?: string;
  } | null>(null);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [selectedStep, setSelectedStep] = useState<{
    stageId: string;
    stepId: string;
    name: string;
    fields: FieldValue[];
    type: string;
  } | null>(null);

  const getStageClass = (stage: Stage, index: number) => {
    const baseClass = 'clip-path-chevron min-w-[var(--stage-min-width)] h-[var(--stage-height)] flex items-center justify-center p-4 text-white font-semibold text-shadow transition-all duration-500';
    const positionClass = `stage-${index + 1}`;
    
    let animationClass = '';
    if (stage.isNew) {
      animationClass = 'animate-slide-in';
    } else if (stage.isDeleting) {
      animationClass = 'animate-fade-out';
    } else if (stage.isMoving) {
      animationClass = stage.moveDirection === 'up' ? 'animate-move-up' : 'animate-move-down';
    }

    const activeClass = activeStage === stage.id ? 'ring-2 ring-white ring-opacity-70' : '';
    
    return `${baseClass} ${positionClass} ${animationClass} ${activeClass}`;
  };

  const getStepIcon = (stepType: string) => {
    // Map step types to appropriate icons
    switch (stepType) {
      case 'Collect information':
        return <FaClipboardList className="text-blue-500" />;
      case 'Approve/Reject':
        return <FaCheckCircle className="text-green-500" />;
      case 'Automation':
        return <BsGearFill className="text-purple-500" />;
      case 'Create Case':
        return <FaFolder className="text-yellow-500" />;
      case 'Decision':
        return <FaQuestionCircle className="text-orange-500" />;
      case 'Generate Document':
        return <IoDocumentText className="text-gray-500" />;
      case 'Generative AI':
        return <RiBrainFill className="text-pink-500" />;
      case 'Robotic Automation':
        return <FaRobot className="text-indigo-500" />;
      case 'Send Notification':
        return <MdNotifications className="text-red-500" />;
      default:
        return <BsGearFill className="text-gray-400" />;
    }
  };

  const handleDragStart = () => {
    setIsDragging(true);
  };

  const handleDragEnd = (result: DropResult) => {
    setIsDragging(false);

    if (!result.destination) {
      return;
    }

    if (result.type === 'stage') {
      // Handle stage reordering
      const sourceIndex = result.source.index;
      const destinationIndex = result.destination.index;

      const updatedStages = Array.from(stages);
      const [movedStage] = updatedStages.splice(sourceIndex, 1);
      updatedStages.splice(destinationIndex, 0, movedStage);

      // Save to session storage
      sessionStorage.setItem('workflowStages', JSON.stringify(updatedStages));
      
      onStepsUpdate(updatedStages);
      return;
    }

    // Handle step reordering within stages
    const sourceStageId = result.source.droppableId;
    const destinationStageId = result.destination.droppableId;
    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;

    const updatedStages = [...stages];
    const sourceStage = updatedStages.find(s => s.id === sourceStageId);
    const destinationStage = updatedStages.find(s => s.id === destinationStageId);

    if (!sourceStage || !destinationStage) {
      return;
    }

    const [movedStep] = sourceStage.steps.splice(sourceIndex, 1);
    destinationStage.steps.splice(destinationIndex, 0, movedStep);

    // Save to session storage
    sessionStorage.setItem('workflowStages', JSON.stringify(updatedStages));

    onStepsUpdate(updatedStages);
  };

  const handleAddStep = (stageId: string) => {
    setSelectedStageId(stageId);
    setIsAddStepModalOpen(true);
  };

  const handleAddStepSubmit = (stepData: { name: string; type: string }) => {
    if (!selectedStageId) return;

    const updatedStages = stages.map(stage => {
      if (stage.id === selectedStageId) {
        return {
          ...stage,
          steps: [
            ...stage.steps,
            {
              id: uuidv4(),
              name: stepData.name,
              type: stepData.type || 'Automation',
              status: 'pending' as const,
              fields: []
            }
          ]
        };
      }
      return stage;
    });

    onStepsUpdate(updatedStages);
    setIsAddStepModalOpen(false);
    setSelectedStageId(null);
  };

  const handleEditClick = (type: 'stage' | 'step', id: string, stageId?: string) => {
    if (type === 'stage') {
      const stage = stages.find(s => s.id === id);
      if (stage) {
        setEditItem({
          type: 'stage',
          id: stage.id,
          name: stage.name
        });
        setIsEditModalOpen(true);
      }
    } else {
      const stage = stages.find(s => s.id === stageId);
      const step = stage?.steps.find(s => s.id === id);
      if (step) {
        setEditItem({
          type: 'step',
          id: step.id,
          stageId: stageId,
          name: step.name,
          stepType: step.type
        });
        setIsEditModalOpen(true);
      }
    }
  };

  const handleEditSubmit = (data: { name: string; type?: string }) => {
    if (!editItem) return;

    const updatedStages = stages.map(stage => {
      if (editItem.type === 'stage' && stage.id === editItem.id) {
        return {
          ...stage,
          name: data.name
        };
      } else if (editItem.type === 'step' && stage.id === editItem.stageId) {
        return {
          ...stage,
          steps: stage.steps.map(step => 
            step.id === editItem.id
              ? { ...step, name: data.name, type: data.type || step.type }
              : step
          )
        };
      }
      return stage;
    });

    // Save to session storage
    sessionStorage.setItem('workflowStages', JSON.stringify(updatedStages));
    
    onStepsUpdate(updatedStages);
    setIsEditModalOpen(false);
    setEditItem(null);
  };

  const handleStepSelect = (stageId: string, stepId: string) => {
    const stage = stages.find(s => s.id === stageId);
    const step = stage?.steps.find(s => s.id === stepId);
    
    if (step) {
      setSelectedStep({
        stageId,
        stepId,
        name: step.name,
        fields: step.fields,
        type: step.type
      });
      setIsConfigModalOpen(true);
    }
    
    onStepSelect(stageId, stepId);
  };

  const handleFieldChange = (fieldId: string, value: string | number | boolean | null) => {
    if (!selectedStep) return;

    const updatedStages = stages.map(stage => {
      if (stage.id === selectedStep.stageId) {
        return {
          ...stage,
          steps: stage.steps.map(step => {
            if (step.id === selectedStep.stepId) {
              return {
                ...step,
                fields: step.fields.map(field => 
                  field.id === fieldId ? { ...field, value } : field
                )
              };
            }
            return step;
          })
        };
      }
      return stage;
    });

    onStepsUpdate(updatedStages);
  };

  const handleAddFieldToStep = (fieldData: { label: string; type: Field['type']; options?: string[] }) => {
    if (!selectedStep) return;

    const fieldId = onAddField(fieldData);
    const fieldValue: FieldValue = {
      id: fieldId,
    };

    const updatedStages = stages.map(stage => {
      if (stage.id === selectedStep.stageId) {
        return {
          ...stage,
          steps: stage.steps.map(step => {
            if (step.id === selectedStep.stepId) {
              return {
                ...step,
                fields: [...step.fields, fieldValue]
              };
            }
            return step;
          })
        };
      }
      return stage;
    });

    // Update the stages
    onStepsUpdate(updatedStages);

    // Update the selectedStep state to reflect the new field
    const updatedStage = updatedStages.find(s => s.id === selectedStep.stageId);
    const updatedStep = updatedStage?.steps.find(s => s.id === selectedStep.stepId);
    if (updatedStep) {
      setSelectedStep({
        ...selectedStep,
        fields: updatedStep.fields
      });
    }
  };

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        <DragDropContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <Droppable droppableId="stages" type="stage" direction="vertical">
            {(provided) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="space-y-8"
              >
                {stages.map((stage, index) => (
                  <Draggable
                    key={stage.id}
                    draggableId={stage.id}
                    index={index}
                  >
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`p-6 rounded-xl border transform transition-all duration-500 ease-in-out 
                          ${stage.isNew ? 'animate-fade-in' : ''}
                          ${snapshot.isDragging ? 'shadow-2xl ring-2 ring-blue-500/50' : ''}
                          ${
                            activeStage === stage.id
                              ? 'border-blue-500/50 bg-blue-50/50 dark:bg-blue-900/10 shadow-lg'
                              : 'border-gray-200/50 dark:border-gray-700/50'
                          }
                        `}
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing p-1 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded">
                              <FaGripVertical className="text-gray-400" />
                            </div>
                            <div className={`w-1 h-6 rounded stage-${index + 1}`} />
                            <h3 className="font-semibold text-lg text-gray-700 dark:text-gray-200">{stage.name}</h3>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleAddStep(stage.id)}
                              className="inline-flex items-center px-3 py-1.5 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                            >
                              Add Step
                            </button>
                            <button
                              onClick={() => handleEditClick('stage', stage.id)}
                              className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                              aria-label="Edit stage"
                            >
                              <FaPencilAlt className="w-4 h-4 text-gray-500" />
                            </button>
                            {onDeleteStage && (
                              <button
                                onClick={() => onDeleteStage(stage.id)}
                                className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                                aria-label="Delete stage"
                              >
                                <FaTrash className="w-4 h-4 text-gray-500" />
                              </button>
                            )}
                          </div>
                        </div>

                        <Droppable droppableId={stage.id} type="step">
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.droppableProps}
                              className={`space-y-2 ${snapshot.isDraggingOver ? 'bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2' : ''}`}
                            >
                              {stage.steps.map((step, stepIndex) => (
                                <Draggable
                                  key={step.id}
                                  draggableId={step.id}
                                  index={stepIndex}
                                >
                                  {(provided, snapshot) => (
                                    <div
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      {...provided.dragHandleProps}
                                      onClick={() => handleStepSelect(stage.id, step.id)}
                                      className={`p-3 rounded-lg border transition-all cursor-pointer
                                        ${snapshot.isDragging ? 'shadow-lg ring-2 ring-blue-500/50' : 'hover:shadow-md'}
                                        ${
                                          activeStep === step.id
                                            ? 'border-blue-500/50 bg-blue-50 dark:bg-blue-900/20'
                                            : 'border-gray-200 dark:border-gray-700 hover:border-blue-500/30 dark:hover:border-blue-500/30'
                                        }
                                      `}
                                    >
                                      <div className="flex items-center gap-3">
                                        <span className="text-xl">
                                          {getStepIcon(step.type || 'Automation')}
                                        </span>
                                        <span className="flex-1 font-medium text-gray-700 dark:text-gray-200">
                                          {step.name}
                                        </span>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleEditClick('step', step.id, stage.id);
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
                                              onDeleteStep(stage.id, step.id);
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
          onAddStep={handleAddStepSubmit}
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
              type: editItem.stepType
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
            fields={fields}
            stepFields={selectedStep.fields}
            onFieldChange={handleFieldChange}
            onAddField={handleAddFieldToStep}
            stepName={selectedStep.name}
            stepType={selectedStep.type}
            onUpdateField={onUpdateField}
            onDeleteField={onDeleteField}
          />
        )}
      </div>
    </div>
  );
};

export default WorkflowDiagram;