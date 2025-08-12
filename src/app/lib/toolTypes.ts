import { FieldType } from "../utils/fieldTypes";

// Define proper types for tool parameters and results
export interface ToolParams {
  [key: string]: unknown;
}

export interface ToolResult {
  [key: string]: unknown;
}

export interface LLMTool<TParams = ToolParams, TResult = ToolResult> {
  name: string;
  description: string;
  execute: (params: TParams) => Promise<TResult>;
}

// Define specific parameter types for each tool
export interface CreateCaseParams extends ToolParams {
  name: string;
  description: string;
}

export interface SaveCaseParams extends ToolParams {
  id: number;
  name: string;
  description: string;
  model: WorkflowModel;
}

export interface SaveFieldsParams extends ToolParams {
  fields: Array<{
    id?: number;
    name: string;
    type: FieldType;
    caseid: number;
    primary?: boolean;
    required?: boolean;
    label: string;
    description?: string;
    order?: number;
    options?: unknown[];
    sampleValue: unknown;
  }>;
}

export interface SaveViewParams extends ToolParams {
  id?: number;
  name: string;
  caseid: number;
  model: {
    fields: ViewField[];
    layout: ViewLayout;
  };
}

export interface DeleteParams extends ToolParams {
  id: number;
}

export interface WorkflowModel {
  stages: Stage[];
}

export interface Stage {
  id: number;
  name: string;
  order: number;
  processes: Process[];
}

export interface Process {
  id: number;
  name: string;
  order: number;
  steps: Step[];
}

export interface Step {
  id: number;
  type: string;
  name: string;
  order: number;
  viewId?: number;
  fields?: unknown[];
}

export interface ViewModel {
  fields: ViewField[];
  layout: ViewLayout;
}

export interface ViewField {
  fieldId: number;
  required?: boolean;
  order?: number;
}

export interface ViewLayout {
  type: string;
  columns?: number;
}
