'use client';

import { useState, useCallback, useRef, useEffect, MutableRefObject } from 'react';
import { WorkflowDiagram } from './components/WorkflowDiagram';
import { ChatInterface } from './components/ChatInterface';
import StepForm from './components/StepForm';
import { Service, ChatRole } from './services/service';
import { Stage, Message, Delta, Field } from './types';
import AddFieldModal from './components/AddFieldModal';
import { motion } from 'framer-motion';
import defaultModel from './model.json';
import { v4 as uuidv4 } from 'uuid';
import { DragDropContext, DropResult } from '@hello-pangea/dnd';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import AddStageModal from './components/AddStageModal';
import { FaPencilAlt, FaTrash } from 'react-icons/fa';
import EditFieldModal from './components/EditFieldModal';

interface ChatMessage {
  role: ChatRole;
  content: string;
}

interface WorkflowDelta {
  type: 'add' | 'delete' | 'move' | 'update';
  path: string;
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

const SESSION_STORAGE_KEY = 'workflow_stages';

export default function Home() {
  const [stages, setStages] = useState<Stage[]>([]);
  const [activeStage, setActiveStage] = useState<string | undefined>();
  const [activeStep, setActiveStep] = useState<string | undefined>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatPanelWidth, setChatPanelWidth] = useState(500);
  const [isResizing, setIsResizing] = useState(false);
  const [isChatPanelExpanded, setIsChatPanelExpanded] = useState(true);
  const startX = useRef(0);
  const startWidth = useRef(0);
  const [isModalOpen, setModalOpen] = useState(false);
  const [fields, setFields] = useState<Field[]>([]);
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [isAddStepModalOpen, setIsAddStepModalOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [activeTab, setActiveTab] = useState<'workflow' | 'data' | 'ux' | 'fields'>('workflow');
  const [isAddStageModalOpen, setIsAddStageModalOpen] = useState(false);
  const [isAddFieldModalOpen, setIsAddFieldModalOpen] = useState(false);
  const [editingField, setEditingField] = useState<Field | null>(null);
  const addFieldButtonRef = useRef<HTMLButtonElement>(null) as MutableRefObject<HTMLButtonElement>;
  
  // Load stages and fields from session storage or default model
  useEffect(() => {
    const loadData = () => {
      const savedStages = sessionStorage.getItem(SESSION_STORAGE_KEY);
      const savedFields = sessionStorage.getItem('workflow_fields');
      const initialStages = savedStages ? JSON.parse(savedStages) : defaultModel.stages;
      const initialFields = savedFields ? JSON.parse(savedFields) : defaultModel.fields || [];
      
      setStages(initialStages);
      setFields(initialFields);
      
      // Set initial welcome message
      setMessages([{
        id: 'welcome',
        type: 'json',
        content: {
          message: 'Welcome! I can help you manage your workflow. Here is your current workflow:',
          model: {
            stages: initialStages,
            fields: initialFields
          },
          visualization: {
            totalStages: initialStages.length,
            stageBreakdown: initialStages.map((stage: Stage) => ({
              name: stage.name,
              stepCount: stage.steps.length
            }))
          }
        },
        sender: 'ai'
      }]);
    };

    loadData();
  }, []);

  // Save stages to session storage whenever they change
  useEffect(() => {
    if (stages.length > 0) {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(stages));
    }
  }, [stages]);

  const handleAddField = (fieldData: { label: string; type: Field['type']; options?: string[]; required?: boolean; isPrimary?: boolean }) => {
    const newField: Field = {
      id: uuidv4(),
      label: fieldData.label,
      type: fieldData.type,
      required: fieldData.required || false,
      isPrimary: fieldData.isPrimary || false,
      ...(fieldData.options && { options: fieldData.options })
    };

    setFields(prevFields => {
      const updatedFields = [...prevFields, newField];
      sessionStorage.setItem('workflow_fields', JSON.stringify(updatedFields));
      return updatedFields;
    });

    return newField.id;
  };

  const handleUpdateField = (updates: Partial<Field>) => {
    if (!editingField) return;

    setFields(prevFields => {
      const updatedFields = prevFields.map(field => 
        field.id === editingField.id ? { ...field, ...updates } : field
      );
      sessionStorage.setItem('workflow_fields', JSON.stringify(updatedFields));
      return updatedFields;
    });

    setEditingField(null);
  };

  const handleDeleteField = (fieldId: string) => {
    setFields(prevFields => {
      const updatedFields = prevFields.filter(field => field.id !== fieldId);
      sessionStorage.setItem('workflow_fields', JSON.stringify(updatedFields));
      return updatedFields;
    });

    // Remove references to this field from all steps
    setStages(prevStages => {
      const updatedStages = prevStages.map(stage => ({
        ...stage,
        steps: stage.steps.map(step => ({
          ...step,
          fields: step.fields.filter(f => f.id !== fieldId)
        }))
      }));
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(updatedStages));
      return updatedStages;
    });
  };

  const addMessage = (message: Message) => {
    setMessages(prev => [...prev, message]);
  };

  const generateDelta = (oldStages: Stage[], newStages: Stage[]): Delta[] => {
    const deltas: WorkflowDelta[] = [];

    // Check for added or deleted stages
    const oldStageIds = new Set(oldStages.map(s => s.id));
    const newStageIds = new Set(newStages.map(s => s.id));

    // Added stages
    newStages.forEach(stage => {
      if (!oldStageIds.has(stage.id)) {
        deltas.push({
          type: 'add',
          path: `/stages/${stage.id}`,
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
          path: `/stages/${stage.id}`,
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
            path: `/stages/${oldStage.id}/steps/${oldStep.id}`,
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
              path: `/stages/${oldStage.id}/steps/${oldStep.id}`,
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
        message: 'Changes applied successfully',
        action: {
          type: 'update',
          changes: deltas.map(delta => ({
            type: delta.type,
            path: delta.path,
            target: delta.target || {
              type: 'step',
              id: '',
              name: '',
              sourceStageId: '',
              targetStageId: '',
              sourceIndex: 0,
              targetIndex: 0
            },
            value: delta.changes?.after,
            oldValue: delta.changes?.before
          }))
        },
        model: {
          before: stages,
          after: updatedStages
        },
        visualization: {
          totalStages: updatedStages.length,
          stageBreakdown: updatedStages.map(stage => ({
            name: stage.name,
            stepCount: stage.steps.length,
            steps: stage.steps.map(step => ({
              name: step.name
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
        (d.target?.type === 'stage' && d.target?.id === stage.id) ||
        (d.target?.type === 'step' && (d.target?.sourceStageId === stage.id || d.target?.targetStageId === stage.id))
      );

      if (delta?.target) {
        switch (delta.type) {
          case 'add':
            return { ...stage, isNew: true };
          case 'delete':
            return { ...stage, isDeleting: true };
          case 'move':
            if (delta.target?.type === 'step') {
              const isSource = delta.target?.sourceStageId === stage.id;
              const isTarget = delta.target?.targetStageId === stage.id;
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

  const handleFieldChange = (fieldId: string, value: string | number | boolean | null) => {
    setStages(prevStages => {
      const updatedStages = prevStages.map(stage => ({
        ...stage,
        steps: stage.steps.map(step => ({
          ...step,
          fields: step.fields.map(field => 
            field.id === fieldId ? { ...field, value } : field
          )
        }))
      }));
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(updatedStages));
      return updatedStages;
    });
  };

  const handleWorkflowUpdate = async (workflow: Stage[]) => {
    const deltas = generateDelta(stages, workflow) as Delta[];
    if (deltas.length === 0) return;

    const changes = deltas
      .filter((d): d is Delta => d.target !== undefined)
      .map(d => ({
        type: d.type,
        path: d.path,
        target: d.target
      }));

    addMessage({
      id: uuidv4(),
      type: 'json',
      content: {
        message: 'Workflow updated',
        model: workflow,
        action: {
          type: 'update' as const,
          changes: changes.map(change => ({
            ...change,
            target: change.target || {
              type: 'step',
              id: '',
              name: ''
            }
          }))
        }
      },
      sender: 'ai'
    });

    // Update chat history
    const deltas_str = changes
      .map(delta => {
        const target = delta.target;
        if (!target) return `Unknown change was made`;
        if (target.type === 'stage') {
          return `Stage ${target.name || target.id} was ${delta.type}ed`;
        } else if (target.type === 'step') {
          return `Step ${target.name || target.id} was ${delta.type}ed`;
        }
        return `Unknown change was made`;
      })
      .join('\n');

    setStages(workflow);
  };

  const handleChatMessage = async (message: string) => {
    try {
      // Service.setProvider('gemini');
      const currentModel = {
        stages: stages,
        fields: fields
      };
      const response = await Service.generateResponse(message, currentModel);
      
      // Try to parse the response as JSON
      let parsedResponse;
      try {
        parsedResponse = JSON.parse(response);
      } catch (e) {
        // If parsing fails, use the raw response as a message
        parsedResponse = {
          message: response
        };
      }

      // Update both stages and fields if the response includes a new model
      if (parsedResponse.model) {
        if (parsedResponse.model.stages) {
          setStages(parsedResponse.model.stages);
        }
        if (parsedResponse.model.fields) {
          setFields(parsedResponse.model.fields);
          // Save updated fields to session storage
          sessionStorage.setItem('workflow_fields', JSON.stringify(parsedResponse.model.fields));
        }
      }

      // Add the message to the chat
      addMessage({
        id: uuidv4(),
        type: 'json',
        content: parsedResponse,
        sender: 'ai'
      });
    } catch (error) {
      console.error('Error:', error);
      addMessage({
        id: uuidv4(),
        type: 'text',
        content: 'Sorry, there was an error processing your request.',
        sender: 'ai'
      });
    }
  };

  const getActiveStepFields = () => {
    const stage = stages.find(s => s.id === activeStage);
    const step = stage?.steps.find(s => s.id === activeStep);
    return (step?.fields || []).map(field => ({
      ...field,
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

  const handleAddStage = (stageData: { name: string }) => {
    const newStage: Stage = {
      id: uuidv4(),
      name: stageData.name,
      steps: [],
      isNew: true
    };

    setStages(prevStages => {
      const updatedStages = [...prevStages, newStage];
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(updatedStages));
      return updatedStages;
    });
    setIsAddStageModalOpen(false);
  };

  const handleEditField = (fieldId: string) => {
    const field = fields.find(f => f.id === fieldId);
    if (field) {
      setEditingField(field);
    }
  };

  return (
    <div className="flex h-screen bg-white dark:bg-gray-900">
      {/* Toggle Button */}
      <button
        onClick={() => setIsChatPanelExpanded(!isChatPanelExpanded)}
        className="fixed right-0 top-4 p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-l-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 shadow-sm z-50"
        aria-label={isChatPanelExpanded ? "Collapse AI Assistant" : "Expand AI Assistant"}
      >
        {isChatPanelExpanded ? (
          <FaChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        ) : (
          <FaChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        )}
      </button>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('workflow')}
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === 'workflow'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            Workflow
          </button>
          <button
            onClick={() => setActiveTab('data')}
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === 'data'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            Data
          </button>
          <button
            onClick={() => setActiveTab('ux')}
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === 'ux'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            UX
          </button>
         
        </div>
        
        {/* Tab Content */}
        <main className="flex-1 overflow-auto">
          {activeTab === 'workflow' && (
            <>
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Workflow</h1>
                <button
                  onClick={() => setIsAddStageModalOpen(true)}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                >
                  Add Stage
                </button>
              </div>
              <WorkflowDiagram
                stages={stages}
                fields={fields}
                onStepSelect={handleStepSelect}
                activeStage={activeStage}
                activeStep={activeStep}
                onStepsUpdate={handleStepsUpdate}
                onDeleteStage={handleDeleteStage}
                onDeleteStep={handleDeleteStep}
                onAddField={handleAddField}
                onUpdateField={handleUpdateField}
                onDeleteField={handleDeleteField}
              />
              <AddStageModal
                isOpen={isAddStageModalOpen}
                onClose={() => setIsAddStageModalOpen(false)}
                onAddStage={handleAddStage}
              />
            </>
          )}
          {activeTab === 'ux' && (
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">UX</h2>
              <p className="text-gray-600 dark:text-gray-400">UX tab content coming soon...</p>
            </div>
          )}
          {activeTab === 'data' && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Data</h2>
                <button
                  ref={addFieldButtonRef}
                  onClick={() => setIsAddFieldModalOpen(true)}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                >
                  Add Field
                </button>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {fields.map(field => (
                  <div
                    key={field.id}
                    className="p-4 rounded-lg border border-gray-200 dark:border-gray-700"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900 dark:text-gray-100">{field.label}</h3>
                        {field.isPrimary && (
                          <span className="px-1.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 rounded">
                            Primary
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleEditField(field.id)}
                          className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                        >
                          <FaPencilAlt className="w-4 h-4 text-gray-500" />
                        </button>
                        <button
                          onClick={() => handleDeleteField(field.id)}
                          className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                        >
                          <FaTrash className="w-4 h-4 text-gray-500" />
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Type: {field.type}</p>
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
        </main>
      </div>

      {/* Chat Panel */}
      <motion.div 
        className="border-l dark:border-gray-700 flex flex-col h-screen overflow-hidden"
        animate={{ 
          width: isChatPanelExpanded ? `${chatPanelWidth}px` : '0px',
          opacity: isChatPanelExpanded ? 1 : 0
        }}
        transition={{ duration: 0.3 }}
        style={{ 
          minWidth: isChatPanelExpanded ? '300px' : '0px',
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
