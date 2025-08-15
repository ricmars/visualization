// All possible step types in array format (source of truth)
export const stepTypes = [
  "Collect information",
  "Approve/Reject",
  "Automation",
  "Create Case",
  "Decision",
  "Generate Document",
  "Generative AI",
  "Robotic Automation",
  "Send Notification",
] as const;

// Type derived from the stepTypes tuple
export type StepType = (typeof stepTypes)[number];

// Mapping of step types to user-friendly display names
export const stepTypeToDisplayName: Record<StepType, string> = {
  "Collect information": "Collect Information",
  "Approve/Reject": "Approve/Reject",
  Automation: "Automation",
  "Create Case": "Create Case",
  Decision: "Decision",
  "Generate Document": "Generate Document",
  "Generative AI": "Generative AI",
  "Robotic Automation": "Robotic Automation",
  "Send Notification": "Send Notification",
};

// Get all possible step types
export const getAllStepTypes = (): readonly StepType[] => {
  return stepTypes;
};

// Function to get the display name for a step type
export const getStepTypeDisplayName = (type: StepType): string => {
  return stepTypeToDisplayName[type] || type;
};

// Valid category types for Pega LifeCycle component
export type ValidCategory =
  | "task"
  | "case"
  | "automation"
  | "logic"
  | "ai"
  | "rule";

// Interface for step type visual data
export interface StepTypeVisualData {
  name: string;
  label: string;
  category: ValidCategory;
  inverted: boolean;
}

// Function to get step type visual data including icon name
export function getStepTypeData(stepType: StepType): StepTypeVisualData {
  switch (stepType) {
    case "Approve/Reject":
      return {
        name: "check",
        label: "Approve/Reject",
        category: "case",
        inverted: false,
      };
    case "Collect information":
      return {
        name: "user-solid",
        label: "Collect information",
        category: "task",
        inverted: false,
      };
    case "Automation":
      return {
        name: "gear-play",
        label: "Automation",
        category: "automation",
        inverted: false,
      };
    case "Create Case":
      return {
        name: "case",
        label: "Create Case",
        category: "automation",
        inverted: false,
      };
    case "Decision":
      return {
        name: "diamond",
        label: "Decision",
        category: "logic",
        inverted: false,
      };
    case "Generate Document":
      return {
        name: "document-pdf",
        label: "Generate Document",
        category: "automation",
        inverted: false,
      };
    case "Generative AI":
      return {
        name: "polaris",
        label: "Generative AI",
        category: "ai",
        inverted: false,
      };
    case "Robotic Automation":
      return {
        name: "robot",
        label: "Robotic Automation",
        category: "automation",
        inverted: false,
      };
    case "Send Notification":
      return {
        name: "bell",
        label: "Send Notification",
        category: "automation",
        inverted: false,
      };
    default:
      return {
        name: "document",
        label: stepType,
        category: "rule",
        inverted: false,
      };
  }
}
