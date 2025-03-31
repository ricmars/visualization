export interface Field {
  id: string;
  label: string;
  type: 'text' | 'email' | 'number' | 'textarea' | 'select' | 'checkbox';
  value?: string | number | boolean;
  placeholder?: string;
  description?: string;
  required?: boolean;
  error?: string;
  options?: Array<{
    value: string;
    label: string;
  }>;
}

export interface Step {
  id: string;
  name: string;
  type: string;
  status: 'pending' | 'completed' | 'error';
  fields: Field[];
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