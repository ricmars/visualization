import { FieldType } from "./types/fields";

/* Interface definition */
export type fieldType = FieldType;

export interface Field {
  /** Unique identifier for the field */
  id?: number;
  /** Unique name of the field for the case type - used as key */
  name: string;
  /** Field label */
  label: string;
  /** Type of the field */
  type: fieldType;
  /** if type is embeddded data, data reference or case reference, set this value to the object name */
  refType?: string;
  /** source of the field - if not set will default to 'User input' */
  source?: "User input" | "System" | "Integration" | "Calculated";
  /** set to true if the field is a primary field - the field will be exposed in the CaseView summary panel */
  primary?: boolean;
  /** Example of value of the field - Only used when field is render as a displayField */
  value?: string | number | boolean | Array<string>;
  /** if type is RadioButtons, Dropdown or AutoComplete - list of valid options */
  options?: string[];
  /** set to true if the field is required */
  required?: boolean;
  /** display order of the field */
  order?: number;
  /** field description */
  description?: string;
  /** Default value for the field */
  defaultValue?: unknown;
}

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

export type StepType =
  | "Collect information"
  | "Approve/Reject"
  | "Automation"
  | "Create Case"
  | "Decision"
  | "Generate Document"
  | "Generative AI"
  | "Robotic Automation"
  | "Send Notification";

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

export interface Case {
  /** Unique identifier for the case */
  id: number;
  /** Unique name of the case type */
  name: string;
  /** Case description */
  description?: string;
  /** Workflow model as JSON string containing stages structure */
  model: string;
}

export interface Application {
  /**
   * List of the available case types - will be rendered in the create list and global search dropdown
   */
  caseTypes?: Case[];
  /**
   * ID of the case type to open in the main content
   */
  caseID?: number;
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
  id: number;
  timestamp: string;
  description: string;
  model: WorkflowModel;
}
