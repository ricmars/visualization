export interface Field {
  id: string;
  label: string;
  type: 'number' | 'text' | 'select' | 'checkbox' | 'email' | 'textarea';
  options?: string[];
  value?: string | number | boolean;
  required?: boolean;
}

export interface Step {
  id: string;
  name: string;
  type?: string;
  fields: Field[];
  isNew?: boolean;
}

export interface Stage {
  id: string;
  name: string;
  steps: Step[];
  isNew?: boolean;
  isDeleting?: boolean;
  isMoving?: boolean;
  moveDirection?: 'up' | 'down';
}

export interface Message {
  id: string;
  type: 'text' | 'json';
  content: string | {
    message?: string;
    model?: any;
    action?: {
      type?: 'add' | 'delete' | 'move' | 'update';
      changes: Array<{
        type: 'add' | 'delete' | 'move' | 'update';
        path: string;
        value?: any;
        oldValue?: any;
        target: {
          type: 'stage' | 'step';
          id?: string;
          name?: string;
          sourceStageId?: string;
          targetStageId?: string;
          sourceIndex?: number;
          targetIndex?: number;
        };
      }>;
    };
    visualization?: {
      totalStages: number;
      stageBreakdown: {
        name: string;
        stepCount: number;
        steps?: {
          name: string;
        }[];
      }[];
    };
  };
  sender: 'user' | 'ai';
}

export interface WorkflowDelta {
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
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
  };
}

export interface Delta {
  type: 'add' | 'delete' | 'move' | 'update';
  path: string;
  value?: any;
  oldValue?: any;
  target?: {
    type: 'stage' | 'step';
    id?: string;
    name?: string;
    sourceStageId?: string;
    targetStageId?: string;
    sourceIndex?: number;
    targetIndex?: number;
  };
  changes?: {
    before?: Stage | Stage['steps'][number];
    after?: Partial<Stage | Stage['steps'][number]>;
  };
} 