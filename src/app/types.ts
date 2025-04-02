export interface Field {
  id: string;
  label: string;
  type: 'text' | 'select' | 'checkbox' | 'email' | 'textarea' | 'number';
  options?: string[];
  required?: boolean;
  isPrimary?: boolean;
}

export interface FieldValue {
  id: string;
}

export interface Step {
  id: string;
  name: string;
  type: string;
  fields: FieldValue[];
}

export interface Stage {
  id: string;
  name: string;
  steps: Step[];
  isNew?: boolean;
  isMoving?: boolean;
  isDeleting?: boolean;
  moveDirection?: 'up' | 'down';
}

export interface Message {
  id: string;
  type: 'text' | 'json';
  content: string | {
    message?: string;
    model?: {
      stages?: Stage[];
      fields?: Field[];
      before?: Stage[];
      after?: Stage[];
    };
    action?: {
      type?: 'add' | 'delete' | 'move' | 'update';
      changes: MessageDelta[];
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
    before?: Stage | Stage['steps'][number] | null;
    after?: Partial<Stage | Stage['steps'][number]> | null;
  };
}

export interface MessageDelta {
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
  value?: Partial<Stage | Step> | null;
  oldValue?: Stage | Step | null;
} 