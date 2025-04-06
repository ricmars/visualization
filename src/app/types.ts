/* Interface definition */
export type fieldType =
  | "Address"
  | "AutoComplete"
  | "Checkbox"
  | "Currency"
  | "Date"
  | "DateTime"
  | "Decimal"
  | "Dropdown"
  | "Email"
  | "Integer"
  | "Location"
  | "ReferenceValues"
  | "DataReferenceSingle"
  | "DataReferenceMulti"
  | "CaseReferenceSingle"
  | "CaseReferenceMulti"
  | "Percentage"
  | "Phone"
  | "RadioButtons"
  | "RichText"
  | "Status"
  | "Text"
  | "TextArea"
  | "Time"
  | "URL"
  | "UserReference";

export interface Field {
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
}

export interface FieldReference {
  /** Unique name of the field for the case type - used as key - should match the name of a field in the fields object */
  name: string;
  /** set to true if the field is required */
  required?: boolean;
}

export interface Step {
  /** Unique name of the step */
  name: string;
  type: StepType;
  fields?: FieldReference[];
}

export interface Stage {
  /** Unique name of the stage */
  name: string;
  /** List of fields assigned to the step */
  steps: Step[];
  isNew?: boolean;
  isMoving?: boolean;
  isDeleting?: boolean;
  moveDirection?: "up" | "down";
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
  id: string;
  type: "text" | "json";
  content:
    | string
    | {
        message?: string;
        model?: {
          stages?: Stage[];
          fields?: Field[];
          before?: Stage[];
          after?: Stage[];
        };
        action?: {
          type?: "add" | "delete" | "move" | "update";
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
  sender: "user" | "ai";
}

export interface WorkflowDelta {
  type: "add" | "delete" | "move" | "update";
  target: {
    type: "stage" | "step";
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
  type: "add" | "delete" | "move" | "update";
  path: string;
  target?: {
    type: "stage" | "step";
    id?: string;
    name?: string;
    sourceStageId?: string;
    targetStageId?: string;
    sourceIndex?: number;
    targetIndex?: number;
  };
  changes?: {
    before?: Stage | Stage["steps"][number] | null;
    after?: Partial<Stage | Stage["steps"][number]> | null;
  };
}

export interface MessageDelta {
  type: "add" | "delete" | "move" | "update";
  path: string;
  target: {
    type: "stage" | "step";
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

export interface Case {
  /** Unique name of the case type */
  name: string;
  /** Case description - not used */
  description?: string;
  /**
   * Fields are linked to the case type - They will be shown in the Details card or in the SummaryView of the case.
   */
  fields?: Field[];
  /**
   * List of stages and steps
   */
  stages?: Stage[];
}

export interface Application {
  /**
   * List of the available case types - will be rendered in the create list and global search dropdown
   */
  caseTypes?: Case[];
  /**
   * ID of the case type to open in the main content
   */
  caseID?: string;
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
