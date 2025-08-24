"use client";

import React, { Suspense } from "react";
import { Stage, Field } from "../types";

// Separate the props interface so it can be used by both components
interface WorkflowLifecycleViewProps {
  stages: Stage[];
  onStepSelect: (stageId: string, processId: string, stepId: string) => void;
  activeStage?: string;
  activeProcess?: string;
  activeStep?: string;
  // Step action handlers
  onEditStep?: (stageId: number, processId: number, stepId: number) => void;
  onDeleteStep?: (stageId: number, processId: number, stepId: number) => void;
  fields?: Field[];
  readOnly?: boolean;
  // Field handlers for modal functionality
  onAddField?: (field: {
    label: string;
    type: Field["type"];
    options?: string[];
    required?: boolean;
    primary?: boolean;
  }) => Promise<string>;
  onUpdateField?: (updates: Partial<Field>) => void;
  onDeleteField?: (field: Field) => void;
  onAddExistingField?: (stepId: number, fieldIds: number[]) => void;
  onFieldChange?: (fieldId: number, value: string | number | boolean) => void;
  // Views used to resolve fields by viewId for collect steps
  views?: Array<{ id: number; model: any }>;
  // Add new field names to a view
  onAddFieldsToView?: (viewId: number, fieldNames: string[]) => void;
  // Lifecycle stage/process handlers
  onStepsUpdate?: (updatedStages: Stage[]) => void;
  onAddProcess?: (stageId: number, processName: string) => void;
  onAddStep?: (
    stageId: number,
    processId: number,
    stepName: string,
    stepType: string,
  ) => void;
  onDeleteProcess?: (stageId: number, processId: number) => void;
}

// Lazy load the actual implementation
const WorkflowLifecycleViewImpl = React.lazy(
  () => import("./WorkflowLifecycleViewImpl"),
);

// Create a wrapper component that handles the lazy loading
const WorkflowLifecycleView: React.FC<WorkflowLifecycleViewProps> = (props) => {
  return (
    <Suspense fallback={<div>Loading workflow view...</div>}>
      <WorkflowLifecycleViewImpl {...props} />
    </Suspense>
  );
};

export default WorkflowLifecycleView;
