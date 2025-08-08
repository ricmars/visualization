import { StepType } from "../types";

// All possible step types in array format for iteration
export const stepTypes: StepType[] = [
  "Collect information",
  "Approve/Reject",
  "Automation",
  "Create Case",
  "Decision",
  "Generate Document",
  "Generative AI",
  "Robotic Automation",
  "Send Notification",
];

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
export const getAllStepTypes = (): StepType[] => {
  return stepTypes;
};

// Function to get the display name for a step type
export const getStepTypeDisplayName = (type: StepType): string => {
  return stepTypeToDisplayName[type] || type;
};
