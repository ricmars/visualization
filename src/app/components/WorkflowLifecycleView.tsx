"use client";

import React, { Suspense } from "react";
import { Stage } from "../types";

// Separate the props interface so it can be used by both components
interface WorkflowLifecycleViewProps {
  stages: Stage[];
  onStepSelect: (stageId: string, processId: string, stepId: string) => void;
  activeStage?: string;
  activeProcess?: string;
  activeStep?: string;
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
