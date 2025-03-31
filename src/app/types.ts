export interface Field {
  id: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'checkbox';
  value?: any;
  options?: string[];
}

export interface Step {
  id: string;
  name: string;
  status: 'pending' | 'active' | 'completed';
  fields: Array<{
    id: string;
    label: string;
    type: string;
    options?: string[];
  }>;
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
  content: string | any;
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
    before?: any;
    after?: any;
  };
} 