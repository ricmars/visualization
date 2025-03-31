'use client';

import { useState, useCallback, useRef } from 'react';
import { WorkflowDiagram } from './components/WorkflowDiagram';
import { ChatInterface } from './components/ChatInterface';
import { StepForm } from './components/StepForm';
import { OllamaService, ChatRole } from './services/ollama';
import { Stage, Step, Message } from './types';
import { workflowSchema } from './types/schema';

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
    before?: any;
    after?: any;
  };
}

interface OllamaResponse {
  content: string;
}

interface WorkflowResponse {
  stages: Array<{
    id: string;
    name: string;
    status: 'pending' | 'active' | 'completed';
    steps: Array<{
      id: string;
      name: string;
      status: 'pending' | 'active' | 'completed';
      fields: Array<{
        id: string;
        label: string;
        type: string;
        options?: string[];
      }>;
    }>;
    isNew?: boolean;
    isMoving?: boolean;
    isDeleting?: boolean;
    moveDirection?: 'up' | 'down';
  }>;
}

const sampleStages: Stage[] = [
  {
    id: 'stage1',
    name: 'Incident Intake',
    status: 'active',
    steps: [
      {
        id: 'step1',
        name: 'Collect Incident Details',
        status: 'pending',
        fields: [
          {
            id: 'incidentTitle',
            label: 'Incident Title',
            type: 'text',
          },
          {
            id: 'description',
            label: 'Description',
            type: 'text',
          }
        ]
      },
      {
        id: 'step2',
        name: 'Determine Incident Severity',
        status: 'pending',
        fields: [
          {
            id: 'severity',
            label: 'Severity Level',
            type: 'select',
            options: ['Low', 'Medium', 'High', 'Critical']
          }
        ]
      },
      {
        id: 'step3',
        name: 'Trigger Compliance Verification',
        status: 'pending',
        fields: [
          {
            id: 'complianceRequired',
            label: 'Compliance Check Required',
            type: 'checkbox'
          }
        ]
      }
    ]
  },
  {
    id: 'stage2',
    name: 'Compliance Verification',
    status: 'pending',
    steps: [
      {
        id: 'step4',
        name: 'Review Program Records',
        status: 'pending',
        fields: [
          {
            id: 'programId',
            label: 'Program ID',
            type: 'text'
          }
        ]
      },
      {
        id: 'step5',
        name: 'Identify Compliance Violations',
        status: 'pending',
        fields: [
          {
            id: 'violations',
            label: 'Violations Found',
            type: 'text'
          }
        ]
      },
      {
        id: 'step6',
        name: 'Approve Compliance Findings',
        status: 'pending',
        fields: [
          {
            id: 'approved',
            label: 'Findings Approved',
            type: 'checkbox'
          }
        ]
      }
    ]
  },
  {
    id: 'stage3',
    name: 'Risk Assessment',
    status: 'pending',
    steps: [
      {
        id: 'step7',
        name: 'Analyze Risk Factors',
        status: 'pending',
        fields: [
          {
            id: 'riskFactors',
            label: 'Risk Factors',
            type: 'text'
          }
        ]
      },
      {
        id: 'step8',
        name: 'Determine Investigation Needed',
        status: 'pending',
        fields: [
          {
            id: 'investigationRequired',
            label: 'Investigation Required',
            type: 'checkbox'
          }
        ]
      },
      {
        id: 'step9',
        name: 'Assign Investigation Team',
        status: 'pending',
        fields: [
          {
            id: 'teamMembers',
            label: 'Team Members',
            type: 'text'
          }
        ]
      }
    ]
  },
  {
    id: 'stage4',
    name: 'Investigation',
    status: 'pending',
    steps: [
      {
        id: 'step10',
        name: 'Gather Additional Evidence',
        status: 'pending',
        fields: [
          {
            id: 'evidence',
            label: 'Evidence Details',
            type: 'text'
          }
        ]
      },
      {
        id: 'step11',
        name: 'Approve Investigation Findings',
        status: 'pending',
        fields: [
          {
            id: 'findingsApproved',
            label: 'Findings Approved',
            type: 'checkbox'
          }
        ]
      },
      {
        id: 'step12',
        name: 'Notify Stakeholders',
        status: 'pending',
        fields: [
          {
            id: 'stakeholders',
            label: 'Stakeholders',
            type: 'text'
          }
        ]
      }
    ]
  },
  {
    id: 'stage5',
    name: 'Case Closure',
    status: 'pending',
    steps: [
      {
        id: 'step13',
        name: 'Update Case Records',
        status: 'pending',
        fields: [
          {
            id: 'resolution',
            label: 'Resolution Details',
            type: 'text'
          }
        ]
      },
      {
        id: 'step14',
        name: 'Notify Stakeholders of Resolution',
        status: 'pending',
        fields: [
          {
            id: 'notificationSent',
            label: 'Notification Sent',
            type: 'checkbox'
          }
        ]
      },
      {
        id: 'step15',
        name: 'Conduct Post-Mortem Review',
        status: 'pending',
        fields: [
          {
            id: 'lessons',
            label: 'Lessons Learned',
            type: 'text'
          }
        ]
      }
    ]
  }
];

export default function Home() {
  const [stages, setStages] = useState<Stage[]>(sampleStages);
  const [activeStage, setActiveStage] = useState<string | undefined>();
  const [activeStep, setActiveStep] = useState<string | undefined>();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      type: 'json',
      content: {
        message: 'Welcome! I can help you manage your workflow. Here is your current workflow:',
        model: sampleStages,
        visualization: {
          totalStages: sampleStages.length,
          stageBreakdown: sampleStages.map(stage => ({
            name: stage.name,
            status: stage.status,
            stepCount: stage.steps.length
          }))
        }
      },
      sender: 'ai'
    }
  ]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatPanelWidth, setChatPanelWidth] = useState(500);
  const [isResizing, setIsResizing] = useState(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

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
      const oldStepIds = new Set(oldStage.steps.map(s => s.id));
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
              before: { stageId: oldStage.id, index: oldIndex },
              after: { stageId: newStage.id, index: newStepIndex }
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
                before: { stageId: oldStage.id },
                after: { stageId: targetStage.id }
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
    const animatedStages: Stage[] = updatedStages.map(stage => {
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

  const handleFieldChange = (fieldId: string, value: any) => {
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
          instruction: `You are a workflow management assistant. Please update the workflow based on the user's request.
          Rules:
          1. Maintain the same structure as the current workflow model
          2. Add 'isNew' flag for new stages/steps
          3. Add 'isDeleting' flag for removed stages/steps
          4. Add 'isMoving' and 'moveDirection' flags for reordered items
          5. Generate unique IDs for new items
          6. Preserve existing IDs and properties when possible
          7. Return only the updated workflow model as JSON
          8. Follow the schema:
          ${JSON.stringify(workflowSchema, null, 2)}
          `,
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
        // Clean up the response content by removing comments and normalizing JSON
        const cleanedContent = responseContent
          .replace(/\/\/.*$/gm, '') // Remove single line comments
          .replace(/\/\*[\s\S]*?\*\//gm, '') // Remove multi-line comments
          .replace(/\n\s*\n/g, '\n') // Remove empty lines
          .replace(/^\s*[\r\n]/gm, '') // Remove empty lines with whitespace
          .replace(/```json\s*|\s*```/g, '') // Remove markdown code block markers
          .trim();

        // Parse and validate the response
        const parsedResponse = JSON.parse(cleanedContent);
        
        // Handle both array and object formats
        const updatedWorkflow = Array.isArray(parsedResponse) 
          ? { stages: parsedResponse }
          : parsedResponse as WorkflowResponse;
        
        // Validate that we have stages
        if (!updatedWorkflow.stages || !Array.isArray(updatedWorkflow.stages)) {
          throw new Error('Invalid workflow format: missing stages array');
        }
        
        // Update the workflow with proper type casting and validation
        const typedStages = updatedWorkflow.stages.map(stage => {
          // Remove any non-standard properties
          const {
            id,
            name,
            status,
            steps,
            isNew,
            isMoving,
            isDeleting,
            moveDirection,
            ...rest
          } = stage;

          // Ensure steps are properly formatted
          const typedSteps = steps.map((step: any) => ({
            id: step.id,
            name: step.name,
            status: step.status as 'pending' | 'active' | 'completed',
            fields: Array.isArray(step.fields) ? step.fields.map((field: any) => ({
              id: field.id,
              label: field.label,
              type: field.type as 'number' | 'text' | 'select' | 'checkbox',
              options: field.options
            })) : []
          }));

          // Construct a properly typed stage
          const typedStage: Stage = {
            id,
            name,
            status: status as 'pending' | 'active' | 'completed',
            steps: typedSteps,
            ...(isNew && { isNew: true }),
            ...(isMoving && { isMoving: true }),
            ...(isDeleting && { isDeleting: true }),
            ...(moveDirection && { moveDirection: moveDirection === 'up' ? 'up' : 'down' })
          };

          return typedStage;
        });

        // Ensure the entire array is properly typed
        const validatedStages: Stage[] = typedStages;
        
        handleWorkflowUpdate(validatedStages);
        
        // Add success message
        const responseMessage: Message = {
          id: Date.now().toString(),
          type: 'json',
          content: {
            status: 'success',
            action: {
              type: 'Workflow Updated',
              timestamp: new Date().toISOString(),
              changes: generateDelta(stages, validatedStages)
            },
            model: {
              before: stages,
              after: validatedStages
            },
            visualization: {
              totalStages: validatedStages.length,
              stageBreakdown: validatedStages.map((stage: Stage) => ({
                name: stage.name,
                status: stage.status,
                stepCount: stage.steps.length,
                steps: stage.steps.map((step: Step) => ({
                  name: step.name,
                  status: step.status
                }))
              }))
            }
          },
          sender: 'ai'
        };
        addMessage(responseMessage);
      } catch (error) {
        // Add error message if response parsing fails
        const errorMessage: Message = {
          id: Date.now().toString(),
          type: 'text',
          content: 'Sorry, I was unable to update the workflow. Please try rephrasing your request.',
          sender: 'ai'
        };
        addMessage(errorMessage);
      }
    } catch (error) {
      console.error('Error handling chat message:', error);
    }
  };

  const getActiveStepFields = () => {
    const stage = stages.find(s => s.id === activeStage);
    const step = stage?.steps.find(s => s.id === activeStep);
    return (step?.fields || []).map(field => ({
      ...field,
      type: field.type as 'number' | 'text' | 'select' | 'checkbox'
    }));
  };

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsResizing(true);
    startX.current = e.pageX;
    startWidth.current = chatPanelWidth;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [chatPanelWidth]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;
    const delta = startX.current - e.pageX;
    const newWidth = Math.max(500, startWidth.current + delta);
    setChatPanelWidth(newWidth);
  }, [isResizing]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

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
          />
        </main>
        {activeStep && (
          <div className="h-1/3 border-t dark:border-gray-700 p-4 overflow-auto">
            <h2 className="text-lg font-semibold mb-4">Step Configuration</h2>
            <StepForm
              fields={getActiveStepFields()}
              onFieldChange={handleFieldChange}
            />
          </div>
        )}
      </div>

      {/* Resize Handle */}
      <div
        className={`resize-handle ${isResizing ? 'resizing' : ''}`}
        onMouseDown={handleMouseDown}
      />

      {/* Chat Panel */}
      <div 
        className="border-l dark:border-gray-700 flex flex-col h-screen overflow-hidden"
        style={{ width: chatPanelWidth }}
      >
        <div className="p-4 border-b dark:border-gray-700">
          <h2 className="text-lg font-semibold">AI Assistant</h2>
        </div>
        <div className="flex-1 overflow-hidden">
          <ChatInterface
            onSendMessage={handleChatMessage}
            messages={messages}
          />
        </div>
      </div>
    </div>
  );
}
