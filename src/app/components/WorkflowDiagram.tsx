import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from  '@hello-pangea/dnd'
import { Stage } from '../types';

interface WorkflowDiagramProps {
  stages: Stage[];
  onStepSelect: (stageId: string, stepId: string) => void;
  activeStage?: string;
  activeStep?: string;
  onStepsUpdate: (updatedStages: Stage[]) => void;
}

export const WorkflowDiagram: React.FC<WorkflowDiagramProps> = ({
  stages,
  onStepSelect,
  activeStage,
  activeStep,
  onStepsUpdate
}) => {
  const [, setIsDragging] = useState(false);

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

  const getStepIcon = (stepName: string) => {
    // Map step names to appropriate icons
    if (stepName.includes('Collect')) return '📋';
    if (stepName.includes('Determine')) return '⚠️';
    if (stepName.includes('Trigger')) return '🔄';
    if (stepName.includes('Review')) return '📑';
    if (stepName.includes('Identify')) return '🔍';
    if (stepName.includes('Approve')) return '✅';
    if (stepName.includes('Analyze')) return '📊';
    if (stepName.includes('Investigation')) return '🔎';
    if (stepName.includes('Assign')) return '👥';
    if (stepName.includes('Gather')) return '📥';
    if (stepName.includes('Notify')) return '📢';
    if (stepName.includes('Update')) return '📝';
    if (stepName.includes('Post-Mortem')) return '📋';
    return '▶️';
  };

  const handleDragStart = () => {
    setIsDragging(true);
  };

  const handleDragEnd = (result: DropResult) => {
    setIsDragging(false);
    const { source, destination } = result;

    // Dropped outside a droppable area
    if (!destination) return;

    // No movement
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) return;

    // Create a new stages array to avoid mutating state
    const newStages = [...stages];

    // Find source and destination stages
    const sourceStage = newStages.find(stage => stage.id === source.droppableId);
    const destStage = newStages.find(stage => stage.id === destination.droppableId);

    if (!sourceStage || !destStage) return;

    // Remove step from source
    const [movedStep] = sourceStage.steps.splice(source.index, 1);

    // Add step to destination
    destStage.steps.splice(destination.index, 0, movedStep);

    // Update stages
    onStepsUpdate(newStages);
  };

  return (
    <div className="w-full h-full overflow-auto p-6">
      <div className="workflow-container mb-8">
        {/* Stages Bar */}
        <div className="flex flex-nowrap gap-0 mb-8">
          {stages.map((stage, index) => (
            <div 
              key={stage.id} 
              className={getStageClass(stage, index)}
              style={{
                zIndex: stage.isNew ? stages.length : undefined
              }}
            >
              <div className="flex flex-col items-center">
                <h3 className="text-lg font-semibold">{stage.name}</h3>
              </div>
            </div>
          ))}
        </div>

        {/* Detailed Steps View */}
        <DragDropContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 gap-6">
            {stages.map((stage, index) => (
              <div
                key={stage.id}
                className={`p-6 rounded-xl border transform transition-all duration-500 ease-in-out 
                  ${stage.isNew ? 'animate-fade-in' : ''}
                  ${
                    activeStage === stage.id
                      ? 'border-blue-500/50 bg-blue-50/50 dark:bg-blue-900/10 shadow-lg'
                      : 'border-gray-200/50 dark:border-gray-700/50'
                  }
                `}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-1 h-6 rounded stage-${index + 1}`} />
                  <h3 className="font-semibold text-lg text-gray-700 dark:text-gray-200">{stage.name}</h3>
                </div>
                <Droppable 
                  droppableId={stage.id} 
                  type="STEP"
                  mode="standard"
                  isDropDisabled={false}
                  isCombineEnabled={false}
                  ignoreContainerClipping={false}
                >
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`grid grid-cols-1 gap-3 pl-4 border-l-2 transition-colors duration-200
                        ${snapshot.isDraggingOver 
                          ? 'border-blue-500 bg-blue-50/30 dark:bg-blue-900/10 rounded-lg p-2' 
                          : 'border-gray-100 dark:border-gray-800'
                        }`}
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
                              className={`transform transition-all duration-200 w-full flex items-center gap-3 p-3 rounded-lg border text-left cursor-grab
                                ${snapshot.isDragging ? 'scale-105 rotate-1 shadow-lg cursor-grabbing' : ''}
                                ${
                                  activeStep === step.id
                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                    : 'border-gray-200 dark:border-gray-700 hover:border-blue-500/30 dark:hover:border-blue-500/30'
                                }`}
                              onClick={() => onStepSelect(stage.id, step.id)}
                            >
                              <span 
                                className="text-xl" 
                                role="img" 
                                aria-label="step icon"
                              >
                                {getStepIcon(step.name)}
                              </span>
                              <span className="font-medium text-gray-700 dark:text-gray-200">
                                {step.name}
                              </span>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            ))}
          </div>
        </DragDropContext>
      </div>
    </div>
  );
};