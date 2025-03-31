export interface Field {
  id: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'checkbox';
  value?: string | number | boolean | null;
  options?: string[];
}

export interface Step {
  id: string;
  name: string;
  isNew?: boolean;
  status: 'pending' | 'active' | 'completed';
  fields: Array<Field>;
}

export interface Stage {
  id: string;
  name: string;
  status: 'pending' | 'active' | 'completed';
  steps: Step[];
  isNew?: boolean;
  isMoving?: boolean;
  isDeleting?: boolean;
  moveDirection?: 'up' | 'down';
}

export interface Message {
  id: string;
  type: 'text' | 'json';
  content: string | Record<string, unknown>;
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