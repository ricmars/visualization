'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { WorkflowDiagram } from './components/WorkflowDiagram';
import { ChatInterface } from './components/ChatInterface';
import StepForm from './components/StepForm';
import { OllamaService, ChatRole } from './services/ollama';
import { Stage, Message } from './types';
import AddFieldModal from './components/AddFieldModal';
import { motion } from 'framer-motion';
import defaultModel from './model.json';
import { v4 as uuidv4 } from 'uuid';
import { DragDropContext, DropResult } from '@hello-pangea/dnd';

interface ChatMessage {
  role: ChatRole;
  content: string;
}

interface WorkflowDelta {
  type: 'add' | 'delete' | 'move' | 'update';
  target: {
    type: 'stage' | 'step';
    id?: string;
    name?: string;
    sourceStageId?: string;
    targetStageId?: string;
    sourceIndex?: number;
    targetIndex?: number;
  };
  changes: {
    before?: Stage | Stage['steps'][number];
    after?: Partial<Stage | Stage['steps'][number]>;
  };
}

interface OllamaResponse {
  content: string;
}

const SESSION_STORAGE_KEY = 'workflow_stages';

export default function Home() {
  const [stages, setStages] = useState<Stage[]>([]);
  const [activeStage, setActiveStage] = useState<string | undefined>();
  const [activeStep, setActiveStep] = useState<string | undefined>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatPanelWidth, setChatPanelWidth] = useState(500);
  const [isResizing, setIsResizing] = useState(false);
  const startX = useRef(0);
  const startWidth = useRef(0);
  const [isModalOpen, setModalOpen] = useState(false);
  const [fields, setFields] = useState<{ label: string; type: string }[]>([]);
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [isAddStepModalOpen, setIsAddStepModalOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  // Load stages from session storage or default model
  useEffect(() => {
    const loadStages = () => {
      const savedStages = sessionStorage.getItem(SESSION_STORAGE_KEY);
      const initialStages = savedStages ? JSON.parse(savedStages) : defaultModel.stages;
      setStages(initialStages);
      
      // Set initial welcome message
      setMessages([{
        id: 'welcome',
        type: 'json',
        content: {
          message: 'Welcome! I can help you manage your workflow. Here is your current workflow:',
          model: initialStages,
          visualization: {
            totalStages: initialStages.length,
            stageBreakdown: initialStages.map((stage: Stage) => ({
              name: stage.name,
              status: stage.status,
              stepCount: stage.steps.length
            }))
          }
        },
        sender: 'ai'
      }]);
    };

    loadStages();
  }, []);

  // Save stages to session storage whenever they change
  useEffect(() => {
    if (stages.length > 0) {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(stages));
    }
  }, [stages]);

  const handleAddField = (field: { label: string; type: string }) => {
    setFields([...fields, field]);
  };

  const addMessage = (message: Message) => {
    setMessages(prev => [...prev, message]);
  };

  const generateDelta = (oldStages: Stage[], newStages: Stage[]): WorkflowDelta[] => {
    const deltas: WorkflowDelta[] = [];

    // Check for added or deleted stages
    const oldStageIds = new Set(oldStages.map(s => s.id));
    const newStageIds = new Set(newStages.map(s => s.id));

    // Added stages
    newStages.forEach(stage => {
      if (!oldStageIds.has(stage.id)) {
        deltas.push({
          type: 'add',
          target: {
            type: 'stage',
            id: stage.id,
            name: stage.name
          },
          changes: {
            after: stage
          }
        });
      }
    });

    // Deleted stages
    oldStages.forEach(stage => {
      if (!newStageIds.has(stage.id)) {
        deltas.push({
          type: 'delete',
          target: {
            type: 'stage',
            id: stage.id,
            name: stage.name
          },
          changes: {
            before: stage
          }
        });
      }
    });

    // Check for moved or updated steps
    oldStages.forEach(oldStage => {
      const newStage = newStages.find(s => s.id === oldStage.id);
      if (!newStage) return;

      // Compare steps
      const newStepIds = new Set(newStage.steps.map(s => s.id));

      // Check for moved steps
      oldStage.steps.forEach((oldStep, oldIndex) => {
        const newStepIndex = newStage.steps.findIndex(s => s.id === oldStep.id);
        if (newStepIndex !== -1 && newStepIndex !== oldIndex) {
          deltas.push({
            type: 'move',
            target: {
              type: 'step',
              id: oldStep.id,
              name: oldStep.name,
              sourceStageId: oldStage.id,
              targetStageId: newStage.id,
              sourceIndex: oldIndex,
              targetIndex: newStepIndex
            },
            changes: {
              before: oldStage.steps[oldIndex],
              after: { ...newStage.steps[newStepIndex] }
            }
          });
        }
      });

      // Check for steps that moved between stages
      oldStage.steps.forEach(oldStep => {
        if (!newStepIds.has(oldStep.id)) {
          // Find which stage this step moved to
          const targetStage = newStages.find(s => 
            s.id !== oldStage.id && s.steps.some(step => step.id === oldStep.id)
          );
          if (targetStage) {
            const newIndex = targetStage.steps.findIndex(s => s.id === oldStep.id);
            deltas.push({
              type: 'move',
              target: {
                type: 'step',
                id: oldStep.id,
                name: oldStep.name,
                sourceStageId: oldStage.id,
                targetStageId: targetStage.id,
                sourceIndex: oldStage.steps.findIndex(s => s.id === oldStep.id),
                targetIndex: newIndex
              },
              changes: {
                before: oldStep,
                after: { id: targetStage.id }
              }
            });
          }
        }
      });
    });

    return deltas;
  };

  const handleStepsUpdate = (updatedStages: Stage[]) => {
    const deltas = generateDelta(stages, updatedStages);
    setStages(updatedStages);

    // Add a message showing the changes
    const responseMessage: Message = {
      id: Date.now().toString(),
      type: 'json',
      content: {
        status: 'success',
        action: {
          type: 'Workflow Updated',
          timestamp: new Date().toISOString(),
          changes: deltas
        },
        model: {
          before: stages,
          after: updatedStages
        },
        visualization: {
          totalStages: updatedStages.length,
          stageBreakdown: updatedStages.map(stage => ({
            name: stage.name,
            status: stage.status,
            stepCount: stage.steps.length,
            steps: stage.steps.map(step => ({
              name: step.name,
              status: step.status
            }))
          }))
        }
      },
      sender: 'ai'
    };
    addMessage(responseMessage);

    // Apply animation flags
    const animatedStages = updatedStages.map(stage => {
      const delta = deltas.find(d => 
        (d.target.type === 'stage' && d.target.id === stage.id) ||
        (d.target.type === 'step' && (d.target.sourceStageId === stage.id || d.target.targetStageId === stage.id))
      );

      if (delta) {
        switch (delta.type) {
          case 'add':
            return { ...stage, isNew: true };
          case 'delete':
            return { ...stage, isDeleting: true };
          case 'move':
            if (delta.target.type === 'step') {
              const isSource = delta.target.sourceStageId === stage.id;
              const isTarget = delta.target.targetStageId === stage.id;
              if (isSource || isTarget) {
                return {
                  ...stage,
                  isMoving: true,
                  moveDirection: isSource ? 'up' as const : 'down' as const
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
      setStages(updatedStages.map(stage => ({
        ...stage,
        isNew: undefined,
        isDeleting: undefined,
        isMoving: undefined,
        moveDirection: undefined
      })));
    }, 500);
  };

  const handleStepSelect = (stageId: string, stepId: string) => {
    setActiveStage(stageId);
    setActiveStep(stepId);
  };

  const handleFieldChange = (fieldId: string, value: string | number | boolean | undefined) => {
    setStages(prevStages => {
      return prevStages.map(stage => ({
        ...stage,
        steps: stage.steps.map(step => ({
          ...step,
          fields: step.fields.map(field => 
            field.id === fieldId ? { ...field, value } : field
          )
        }))
      }));
    });
  };

  const handleWorkflowUpdate = async (workflow: Stage[]) => {
    // Handle animations based on flags
    const animatingStages = workflow.map(stage => ({
      ...stage,
      animationComplete: false
    }));

    setStages(animatingStages);

    // Wait for animations to complete
    await new Promise(resolve => setTimeout(resolve, 500));

    // Remove animation flags
    setStages(workflow.map(stage => ({
      ...stage,
      isNew: undefined,
      isMoving: undefined,
      isDeleting: undefined,
      moveDirection: undefined
    })));
  };

  const handleChatMessage = async (message: string) => {
    try {
      // Add user message
      const userMessage: Message = {
        id: Date.now().toString(),
        type: 'text',
        content: message,
        sender: 'user'
      };
      addMessage(userMessage);
      
      // Update chat history with system context
      const systemMessage = {
        role: 'system' as ChatRole,
        content: JSON.stringify({
          instruction: `You are a workflow management assistant. Help update the workflow based on the user's request.
          Rules:
          1. Return ONLY a valid JSON array of stages that matches the current workflow structure
          2. Each stage should have: id, name, status, and steps array
          3. Each step should have: id, name, status, and fields array
          4. Use 'isNew' flag for new stages/steps
          5. Use 'isDeleting' flag for removed stages/steps
          6. Use 'isMoving' and 'moveDirection' flags for reordered items
          7. Generate unique IDs for new items
          8. Preserve existing IDs when modifying existing items
          9. DO NOT return schema definitions or explanations - only the actual workflow data
          
          Current workflow structure for reference:
          ${JSON.stringify(stages, null, 2)}`,
          currentWorkflow: stages
        })
      };

      const userChatMessage = { 
        role: 'user' as ChatRole, 
        content: message 
      };

      const updatedHistory = [...chatHistory, systemMessage, userChatMessage];
      setChatHistory(updatedHistory);

      // Get LLM response
      const response = await OllamaService.chat(updatedHistory);
      const responseContent = typeof response === 'string' ? response : (response as OllamaResponse).content;
      
      try {
        // Extract JSON from the response
        const jsonMatch = responseContent.match(/```json\s*(\[[\s\S]*?\]|\{[\s\S]*?\})\s*```/) || 
                         responseContent.match(/\[[\s\S]*?\]|\{[\s\S]*?\}/);
        
        if (!jsonMatch) {
          throw new Error('No valid JSON found in response');
        }

        const jsonStr = jsonMatch[1] || jsonMatch[0];
        const parsedResponse = JSON.parse(jsonStr);
        
        // Handle both array and object formats
        const updatedWorkflow = Array.isArray(parsedResponse) 
          ? parsedResponse
          : parsedResponse.stages || parsedResponse;
        
        // Validate the workflow structure
        if (!Array.isArray(updatedWorkflow)) {
          throw new Error('Invalid workflow format: not an array');
        }

        // Validate each stage has required properties
        updatedWorkflow.forEach((stage, index) => {
          if (!stage.id || !stage.name || !stage.status || !Array.isArray(stage.steps)) {
            throw new Error(`Invalid stage format at index ${index}`);
          }
          
          stage.steps.forEach((step: Stage['steps'][number], stepIndex: number) => {
            if (!step.id || !step.name || !step.status || !Array.isArray(step.fields)) {
              throw new Error(`Invalid step format at stage ${index}, step ${stepIndex}`);
            }
          });
        });
        
        // Update the workflow with proper type casting
        const typedStages = updatedWorkflow.map(stage => ({
          id: stage.id,
          name: stage.name,
          status: stage.status as 'pending' | 'active' | 'completed',
          steps: stage.steps.map((step: Stage['steps'][number]) => ({
            id: step.id,
            name: step.name,
            status: step.status as 'pending' | 'active' | 'completed',
            fields: Array.isArray(step.fields) ? step.fields.map((field: { id: string; label: string; type: 'number' | 'text' | 'select' | 'checkbox'; options?: string[] }) => ({
              id: field.id,
              label: field.label,
              type: field.type as 'number' | 'text' | 'select' | 'checkbox',
              options: field.options
            })) : [],
            ...(step.isNew && { isNew: true })
          })),
          ...(stage.isNew && { isNew: true }),
          ...(stage.isMoving && { isMoving: true }),
          ...(stage.isDeleting && { isDeleting: true }),
          ...(stage.moveDirection && { moveDirection: stage.moveDirection as 'up' | 'down' })
        }));

        handleWorkflowUpdate(typedStages);
        
        // Add success message
        const responseMessage: Message = {
          id: Date.now().toString(),
          type: 'json',
          content: {
            status: 'success',
            action: {
              type: 'Workflow Updated',
              timestamp: new Date().toISOString(),
              changes: generateDelta(stages, typedStages)
            },
            model: {
              before: stages,
              after: typedStages
            },
            visualization: {
              totalStages: typedStages.length,
              stageBreakdown: typedStages.map(stage => ({
                name: stage.name,
                status: stage.status,
                stepCount: stage.steps.length,
                steps: stage.steps.map((step: { name: string; status: string }) => ({
                  name: step.name,
                  status: step.status
                }))
              }))
            }
          },
          sender: 'ai'
        };
        addMessage(responseMessage);
      } catch (error: unknown) {
          console.error('Error parsing LLM response:', error);
           const errorMessage: Message = {
            id: Date.now().toString(),
            type: 'text',
            content: 'Sorry, there was an error processing your request. Please try again.',
            sender: 'ai'
          };
          addMessage(errorMessage);
      }
    } catch (error) {
      console.error('Error handling chat message:', error);
      const errorMessage: Message = {
        id: Date.now().toString(),
        type: 'text',
        content: 'Sorry, there was an error processing your request. Please try again.',
        sender: 'ai'
      };
      addMessage(errorMessage);
    }
  };

  const getActiveStepFields = () => {
    const stage = stages.find(s => s.id === activeStage);
    const step = stage?.steps.find(s => s.id === activeStep);
    return (step?.fields || []).map(field => ({
      ...field,
      type: field.type as 'number' | 'text' | 'select' | 'checkbox',
      value: field.value ?? undefined // Ensure null is replaced with undefined
    }));
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;
    const delta = e.pageX - startX.current;
    const newWidth = Math.max(300, Math.min(800, startWidth.current - delta));
    setChatPanelWidth(newWidth);
  }, [isResizing]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, [handleMouseMove]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    startX.current = e.pageX;
    startWidth.current = chatPanelWidth;
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [chatPanelWidth, handleMouseMove, handleMouseUp]);

  const handleClearChat = () => {
    setMessages([]);
    setChatHistory([]);
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
              type: stepData.type,
              status: 'pending' as const,
              fields: []
            }
          ]
        };
      }
      return stage;
    });

    handleStepsUpdate(updatedStages);
    setIsAddStepModalOpen(false);
    setSelectedStageId(null);
  };

  const handleDeleteStage = (stageId: string) => {
    const updatedStages = stages.filter(stage => stage.id !== stageId);
    handleStepsUpdate(updatedStages);
  };

  const handleDeleteStep = (stageId: string, stepId: string) => {
    const updatedStages = stages.map(stage => {
      if (stage.id === stageId) {
        return {
          ...stage,
          steps: stage.steps.filter(step => step.id !== stepId)
        };
      }
      return stage;
    });
    handleStepsUpdate(updatedStages);
  };

  const handleDragStart = () => {
    setIsDragging(true);
  };

  const handleDragEnd = (result: DropResult) => {
    setIsDragging(false);

    if (!result.destination) {
      return;
    }

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

    handleStepsUpdate(updatedStages);
  };

  return (
    <div className="flex h-screen bg-white dark:bg-gray-900">
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-auto">
          <WorkflowDiagram
            stages={stages}
            onStepSelect={handleStepSelect}
            activeStage={activeStage}
            activeStep={activeStep}
            onStepsUpdate={handleStepsUpdate}
            onDeleteStage={handleDeleteStage}
            onDeleteStep={handleDeleteStep}
          />
        </main>
        
      </div>

      {/* Resize Handle */}
      <div
        className="relative cursor-col-resize select-none"
        onMouseDown={handleMouseDown}
      >
        <div 
          className={`absolute top-0 left-[-4px] w-[8px] h-full hover:bg-blue-500/50 ${
            isResizing ? 'bg-blue-500/50' : 'bg-transparent'
          }`}
        />
      </div>

      {/* Chat Panel */}
      <div 
        className="border-l dark:border-gray-700 flex flex-col h-screen overflow-hidden"
        style={{ 
          width: `${chatPanelWidth}px`,
          minWidth: '300px',
          maxWidth: '800px'
        }}
      >
        <div className="flex-1 overflow-hidden">
          <ChatInterface
            messages={messages}
            onSendMessage={handleChatMessage}
            onClear={handleClearChat}
          />
        </div>
      </div>
    </div>
  );
}
