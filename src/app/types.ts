import { FieldType } from "./utils/fieldTypes";
import type { StepType } from "./utils/stepTypes";
import { CaseRecord, FieldRecord } from "./types/dynamicTypes";

/* Interface definition */
export type fieldType = FieldType;

// Use dynamic field type from rule type registry
export type Field = FieldRecord & {
  /** if type is embeddded data, data reference or case reference, set this value to the object name */
  refType?: string;
  /** source of the field - if not set will default to 'User input' */
  source?: "User input" | "System" | "Integration" | "Calculated";
  /** Example of value of the field - Only used when field is render as a displayField */
  value?: string | number | boolean | Array<string>;
};

export interface FieldReference {
  /** Unique identifier for the field (database ID) */
  fieldId: number;
  /** set to true if the field is required */
  required: boolean;
}

export interface Step {
  id: number; // Database ID
  name: string;
  type: StepType;
  fields?: FieldReference[];
  viewId?: number;
  order?: number;
}

export interface Process {
  id: number; // Database ID
  name: string;
  steps: Step[];
}

export interface Stage {
  id: number; // Database ID
  name: string;
  processes: Process[];
  isDeleting?: boolean;
  isMoving?: boolean;
  moveDirection?: "up" | "down";
  isNew?: boolean;
}

export interface Message {
  id: number;
  type: "text" | "json";
  content:
    | string
    | {
        message: string;
        model: WorkflowModel;
        action?: {
          type?: "add" | "delete" | "move" | "update";
          changes: MessageDelta[];
        };
        visualization: {
          totalStages: number;
          stageBreakdown: {
            name: string;
            stepCount: number;
            processes: {
              name: string;
              steps: {
                name: string;
              }[];
            }[];
          }[];
        };
      };
  sender: "user" | "ai";
}

export interface WorkflowModel {
  stages?: Stage[];
  before?: Stage[];
  after?: Stage[];
  action?: {
    type?: "add" | "delete" | "move" | "update";
    changes: MessageDelta[];
  };
}

export interface WorkflowDelta {
  type: "add" | "delete" | "move" | "update";
  target: {
    type: "stage" | "step";
    id?: number;
    name?: string;
    sourceStageId?: number;
    targetStageId?: number;
    sourceIndex?: number;
    targetIndex?: number;
  };
  changes: {
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
  };
}

export interface Delta {
  type: "add" | "delete" | "move" | "update";
  path: string;
  target?: {
    type: "stage" | "step";
    id?: number;
    name?: string;
    sourceStageId?: number;
    targetStageId?: number;
    sourceIndex?: number;
    targetIndex?: number;
  };
  changes?: {
    before?: Record<string, unknown> | null;
    after?: Partial<Record<string, unknown>> | null;
  };
}

export interface MessageDelta {
  type: "add" | "delete" | "move" | "update";
  path: string;
  target: {
    type: "stage" | "step";
    id?: number;
    name?: string;
    sourceStageId?: number;
    targetStageId?: number;
    sourceIndex?: number;
    targetIndex?: number;
  };
  value?: Partial<Stage | Step> | null;
  oldValue?: Stage | Step | null;
}

// Use dynamic case type from rule type registry
export type Case = CaseRecord & {
  /** Unique identifier for the case */
  id: number;
  /** Case description */
  description?: string;
};

export interface Application {
  /**
   * List of the available case types - will be rendered in the create list and global search dropdown
   */
  caseTypes?: Case[];
  /**
   * ID of the case type to open in the main content
   */
  caseid?: number;
  /**
   * Name of the case type to open in the main content
   */
  caseName?: string;
  /**
   * Name of the current active step -  If set, the assignment will be open for this step.
   * If not set, the current active step will be the first step in the case type
   */
  stepName?: string;
}

export interface Checkpoint {
  id: string; // UUID for database-backed checkpoints
  description: string;
  status: "active" | "committed" | "rolled_back";
  created_at: Date;
  finished_at?: Date;
}

export interface CheckpointSession {
  id: string;
  description: string;
  startedAt: Date;
}
