"use client";

import React, {
  useRef,
  useEffect,
  useState,
  useMemo,
  useCallback,
} from "react";
import { createRoot } from "react-dom/client";

import { Stage, Field } from "../types";
import type { StepType } from "../utils/stepTypes";
import { getStepTypeData } from "../utils/stepTypes";
import StepConfigurationModal from "./StepConfigurationModal";
import ModalPortal from "./ModalPortal";

// Dynamic imports for Pega components to avoid SSR issues
import dynamic from "next/dynamic";
import { StyleSheetManager } from "styled-components";

const PegaLifeCycle = dynamic(
  () =>
    import("@pega/cosmos-react-build").then((mod) => ({
      default: mod.LifeCycle,
    })),
  { ssr: false },
);

const PegaConfiguration = dynamic(
  () =>
    import("@pega/cosmos-react-core").then((mod) => ({
      default: mod.Configuration,
    })),
  { ssr: false },
);

const PegaLiveLog = dynamic(
  () =>
    import("@pega/cosmos-react-core").then((mod) => ({ default: mod.LiveLog })),
  { ssr: false },
);

const PegaPopoverManager = dynamic(
  () =>
    import("@pega/cosmos-react-core").then((mod) => ({
      default: mod.PopoverManager,
    })),
  { ssr: false },
);

const PegaToaster = dynamic(
  () =>
    import("@pega/cosmos-react-core").then((mod) => ({ default: mod.Toaster })),
  { ssr: false },
);

const PegaModalManager = dynamic(
  () =>
    import("@pega/cosmos-react-core").then((mod) => ({
      default: mod.ModalManager,
    })),
  { ssr: false },
);

const PegaIcon = dynamic(
  () =>
    import("@pega/cosmos-react-core").then((mod) => ({ default: mod.Icon })),
  { ssr: false },
);

// Import types separately since they don't need dynamic loading
import type { IconTileProps, StageItemProps } from "@pega/cosmos-react-build";
import EditModal from "./EditModal";
import AddProcessModal from "./AddProcessModal";
import AddStepModal from "./AddStepModal";

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
  views?: Array<{ id: number; model: any }>;
  onAddFieldsToView?: (viewId: number, fieldNames: string[]) => void;
  onStepsUpdate?: (updatedStages: Stage[]) => void;
  onAddProcess?: (stageId: number, processName: string) => void;
  onAddStep?: (
    stageId: number,
    processId: number,
    stepName: string,
    stepType: StepType,
  ) => void;
  onDeleteProcess?: (stageId: number, processId: number) => void;
}

// Stable error boundary to avoid remounting the subtree on each render
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("🚨 LifeCycle component error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "20px", backgroundColor: "lightcoral" }}>
          <h3>LifeCycle Component Error</h3>
          <p>Error: {this.state.error?.message}</p>
        </div>
      );
    }

    return this.props.children;
  }
}

// Stable provider composition to prevent duplicate style tags on re-renders
const PegaProviders = React.memo(
  ({
    container,
    children,
  }: {
    container: HTMLElement;
    children: React.ReactNode;
  }) => (
    <StyleSheetManager target={container}>
      <PegaConfiguration
        disableDefaultFontLoading
        styleSheetTarget={container}
        portalTarget={container}
      >
        <PegaLiveLog maxLength={50}>
          <PegaPopoverManager>
            <PegaToaster dismissAfter={5000}>
              <PegaModalManager>{children as unknown as any}</PegaModalManager>
            </PegaToaster>
          </PegaPopoverManager>
        </PegaLiveLog>
      </PegaConfiguration>
    </StyleSheetManager>
  ),
);

const WorkflowLifecycleViewImpl: React.FC<WorkflowLifecycleViewProps> = ({
  stages,
  onStepSelect,
  activeStage,
  activeProcess,
  activeStep,
  onEditStep: _onEditStep,
  onDeleteStep,
  fields = [],
  readOnly: _readOnly = false,
  onAddField,
  onUpdateField,
  onDeleteField,
  onAddExistingField,
  onFieldChange,
  views = [],
  onAddFieldsToView,
  onStepsUpdate,
  onAddProcess,
  onAddStep,
  onDeleteProcess,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const shadowRootRef = useRef<ShadowRoot | null>(null);
  const reactRootRef = useRef<any>(null);
  const fieldsRef = useRef<Field[]>(fields);
  useEffect(() => {
    fieldsRef.current = fields;
  }, [fields]);

  const [editingStep, setEditingStep] = useState<{
    id: number;
    stageId: number;
    processId: number;
    stepId: number;
    name: string;
    fields: any[];
    type: string;
    viewId?: number;
  } | null>(null);

  const [stageEdit, setStageEdit] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [processModal, setProcessModal] = useState<{
    stageId: number | null;
    isOpen: boolean;
  }>({ stageId: null, isOpen: false });

  const [processEdit, setProcessEdit] = useState<{
    stageId: number;
    id: number;
    name: string;
  } | null>(null);

  const [addStepModal, setAddStepModal] = useState<{
    stageId: number | null;
    processId: number | null;
    isOpen: boolean;
  }>({ stageId: null, processId: null, isOpen: false });

  const [stepEdit, setStepEdit] = useState<{
    stageId: number;
    processId: number;
    id: number;
    name: string;
    stepType: StepType;
  } | null>(null);

  // When views update, recompute editingStep.fields from the linked view model
  useEffect(() => {
    if (!editingStep) return;
    if (editingStep.type !== "Collect information") return;
    if (typeof editingStep.viewId !== "number") return;
    const view = views.find((v) => v.id === editingStep.viewId);
    if (!view) return;
    try {
      const model =
        typeof view.model === "string" ? JSON.parse(view.model) : view.model;
      const nextFields = Array.isArray(model?.fields)
        ? model.fields
            .map((f: { fieldId: number; required?: boolean }) => ({
              fieldId: Number(f.fieldId),
              required: !!f.required,
            }))
            .filter((f: { fieldId: number }) =>
              Number.isFinite(f.fieldId as number),
            )
        : [];
      const currentKey = (editingStep.fields || [])
        .map((f: any) => `${f.fieldId}-${f.required ? 1 : 0}`)
        .join("|");
      const nextKey = nextFields
        .map((f: any) => `${f.fieldId}-${f.required ? 1 : 0}`)
        .join("|");
      if (currentKey !== nextKey) {
        setEditingStep((prev) =>
          prev ? { ...prev, fields: nextFields } : prev,
        );
      }
    } catch {
      // ignore parsing errors
    }
  }, [views, editingStep]);

  // Function to handle edit step - no iframe needed
  const handleEditStep = useCallback(
    (stepData: any) => {
      console.log("🔍 Edit button clicked!", stepData);
      console.log("🔍 Looking for step with ID:", stepData.step.id);
      // Find the stage, process and step based on step data
      for (const stage of stages) {
        for (const process of stage.processes) {
          const candidateId = stepData?.step?.id || stepData?.id;
          const step = process.steps.find(
            (s) =>
              String(s.id) === String(candidateId) || s.name === candidateId,
          );
          if (step) {
            console.log("🔍 Found step:", step);
            let stepFields: any[] = [];
            if (step.type === "Collect information") {
              // Prefer pulling from linked view model if available
              if (typeof (step as any).viewId === "number") {
                const view = views.find((v) => v.id === (step as any).viewId);
                if (view) {
                  try {
                    const model =
                      typeof view.model === "string"
                        ? JSON.parse(view.model)
                        : view.model || {};
                    if (Array.isArray(model.fields)) {
                      stepFields = model.fields
                        .map((f: { fieldId: number; required?: boolean }) => ({
                          fieldId: Number(f.fieldId),
                          required: !!f.required,
                        }))
                        .filter(
                          (f: { fieldId: number }) =>
                            typeof f.fieldId === "number" && !isNaN(f.fieldId),
                        );
                    }
                  } catch {
                    // fallback to step.fields
                    stepFields = step.fields || [];
                  }
                } else {
                  // fallback to step.fields
                  stepFields = step.fields || [];
                }
              } else {
                stepFields = step.fields || [];
              }
              console.log("🔍 Step fields (resolved):", stepFields);
            }
            setEditingStep({
              id: step.id,
              stageId: stage.id,
              processId: process.id,
              stepId: step.id,
              name: step.name,
              fields: stepFields,
              type: step.type,
              viewId:
                typeof (step as any).viewId === "number"
                  ? (step as any).viewId
                  : undefined,
            });
            console.log("🔍 Set editing step with fields:", stepFields);
            return;
          }
        }
      }
      console.log("🔍 No step found for:", stepData.step.id);
    },
    [stages, views],
  );

  // Function to handle delete step
  const handleDeleteStep = useCallback(
    (stepData: any) => {
      console.log("🗑️ Delete button clicked!", stepData);
      // Find the stage, process and step based on step data
      for (const stage of stages) {
        for (const process of stage.processes) {
          const candidateId = stepData?.step?.id || stepData?.id;
          const step = process.steps.find(
            (s) =>
              String(s.id) === String(candidateId) || s.name === candidateId,
          );
          if (step && onDeleteStep) {
            onDeleteStep(stage.id, process.id, step.id);
            return;
          }
        }
      }
    },
    [stages, onDeleteStep],
  );

  const containerStyle: React.CSSProperties = {
    minHeight: 0,
    height: "auto",
    // Allow horizontal scrolling for wide lifecycle diagrams while
    // preventing vertical scrollbars from appearing
    overflowX: "auto",
    overflowY: "hidden",
  };

  // Memoize the stages mapping to prevent unnecessary recalculations
  const mappedStages = useMemo(
    () =>
      stages.map(
        (stage: Stage): StageItemProps => ({
          id: String(stage.id),
          label: stage.name,
          type: "default",
          error: "",
          categories: [
            {
              id: String(stage.id),
              categoryId: String(stage.id),
              tasks: stage.processes.map((process) => ({
                id: String(process.id),
                label: process.name,
                visual: { imgSrc: "" },
                steps: process.steps.map((step) => {
                  const stepTypeData = getStepTypeData(step.type);
                  return {
                    status: {
                      type: "",
                      label: step.name,
                    },
                    id: String(step.id),
                    label: step.name,
                    visual: {
                      imgSrc: "",
                      name: stepTypeData.name,
                      label: stepTypeData.label,
                      category:
                        stepTypeData.category as IconTileProps["category"],
                      inverted: stepTypeData.inverted,
                    },
                  };
                }),
              })),
            },
          ],
        }),
      ),
    [stages],
  );

  // Set up Shadow DOM and render LifeCycle component inside it
  useEffect(() => {
    console.log(
      "🔧 useEffect triggered, containerRef.current:",
      containerRef.current,
    );
    if (!containerRef.current) return;

    let shadowRoot: ShadowRoot;
    let shadowContainer: HTMLDivElement;

    // Create shadow root if it doesn't exist
    if (!shadowRootRef.current) {
      try {
        shadowRoot = containerRef.current.attachShadow({ mode: "open" });
        shadowRootRef.current = shadowRoot;
        console.log("🔧 Created new shadow root:", shadowRoot);
      } catch (_error) {
        // Shadow root already exists, use the existing one
        shadowRoot = containerRef.current.shadowRoot as ShadowRoot;
        shadowRootRef.current = shadowRoot;
        console.log("🔧 Reusing existing shadow root:", shadowRoot);
      }
    } else {
      shadowRoot = shadowRootRef.current;
      console.log("🔧 Using cached shadow root:", shadowRoot);
    }

    // Create or reuse container div inside shadow DOM
    shadowContainer = shadowRoot.querySelector(
      "div.shadow-container",
    ) as HTMLDivElement;
    if (!shadowContainer) {
      shadowContainer = document.createElement("div");
      shadowContainer.className = "shadow-container";
      shadowRoot.appendChild(shadowContainer);
      console.log("🔧 Created new shadow container:", shadowContainer);
    } else {
      console.log("🔧 Reusing existing shadow container:", shadowContainer);
    }

    // Simple CSS reset - much less aggressive
    if (!shadowRoot.querySelector("style[data-shadow-reset]")) {
      const globalStyle = document.createElement("style");
      globalStyle.setAttribute("data-shadow-reset", "true");
      globalStyle.textContent = `
        /* Simple CSS reset for Shadow DOM */
        :host {
          display: block;
        }

        /* Basic reset */
        * {
          box-sizing: border-box;
        }

        /* Make the lifecycle layout left-aligned and horizontally scrollable */
        .shadow-container {
          overflow-x: auto;
          overflow-y: hidden;
          width: 100%;
        }

        .shadow-container > div > div:first-child {
          position: static;
          background: #FFF;
          padding; 0;
          margin:0;
        }

        /* Ensure inner content can extend horizontally */
        .shadow-container > div {
          min-width: max-content;
        }

        .shadow-container article {
          border: 1px solid rgba(0, 0, 0, .2);
        }
      `;

      shadowRoot.insertBefore(globalStyle, shadowRoot.firstChild);
      console.log("🔧 Added simple CSS reset to shadow root");
    }

    // Create React root inside shadow DOM if it doesn't exist
    if (!reactRootRef.current) {
      reactRootRef.current = createRoot(shadowContainer);
      console.log("🔧 Created new React root:", reactRootRef.current);
    } else {
      console.log("🔧 Reusing existing React root:", reactRootRef.current);
    }

    // Render the LifeCycle component inside shadow DOM
    if (shadowRootRef.current && reactRootRef.current) {
      console.log("🔧 Rendering Pega LifeCycle in Shadow DOM");
      // Ensure container does not block modals rendered outside
      shadowContainer.style.background = "#FFF";
      shadowContainer.style.border = "none";
      shadowContainer.style.position = "static";
      shadowContainer.style.overflowX = "auto";
      shadowContainer.style.overflowY = "hidden";
      shadowContainer.style.width = "100%";

      let content = null;
      if (shadowRootRef.current) {
        // Render content
        content = (
          <ErrorBoundary>
            <PegaProviders container={shadowContainer}>
              <PegaLifeCycle
                items={mappedStages}
                stages={stages}
                onStepSelect={onStepSelect}
                activeStage={activeStage}
                activeProcess={activeProcess}
                activeStep={activeStep}
                readOnly={_readOnly}
                stage={{
                  label: "Primary Stages",
                  actions: [
                    {
                      id: "add-process",
                      text: "Add process",
                      visual: <PegaIcon name="gear-play" />,
                      onClick: (data: any) => {
                        const stageKey = data?.id || data?.stage?.id;
                        const stage = stages.find(
                          (s) =>
                            String(s.id) === String(stageKey) ||
                            s.name === stageKey,
                        );
                        if (stage) {
                          setProcessModal({
                            stageId: stage.id,
                            isOpen: true,
                          });
                        }
                      },
                    },
                    {
                      id: "edit-stage",
                      text: "Rename stage",
                      visual: <PegaIcon name="pencil" />,
                      onClick: (data: any) => {
                        const stageKey = data?.id || data?.stage?.id;
                        const stage = stages.find(
                          (s) =>
                            String(s.id) === String(stageKey) ||
                            s.name === stageKey,
                        );
                        if (stage)
                          setStageEdit({
                            id: stage.id,
                            name: stage.name,
                          });
                      },
                    },
                  ],
                  onClick: (data: any) => {
                    const stageKey = data?.id || data?.stage?.id;
                    const stage = stages.find(
                      (s) =>
                        String(s.id) === String(stageKey) ||
                        s.name === stageKey,
                    );
                    if (stage)
                      setStageEdit({
                        id: stage.id,
                        name: stage.name,
                      });
                  },
                }}
                task={[
                  {
                    actions: [
                      {
                        id: "add-step",
                        text: "Add step",
                        visual: <PegaIcon name="plus" />,
                        onClick: (data: any) => {
                          console.log("[LifeCycle] add-step action", data);
                          const stageKey =
                            data?.category?.id ||
                            data?.categoryId ||
                            data?.category?.name ||
                            data?.stage?.id;
                          const processKey =
                            data?.task?.id || data?.id || data?.name;
                          const stage = stages.find(
                            (s) =>
                              String(s.id) === String(stageKey) ||
                              s.name === stageKey,
                          );
                          const process = stage?.processes.find(
                            (p) =>
                              String(p.id) === String(processKey) ||
                              p.name === processKey,
                          );
                          if (stage && process) {
                            console.log("[LifeCycle] opening AddStepModal", {
                              stageId: stage.id,
                              processId: process.id,
                            });
                            setAddStepModal({
                              stageId: stage.id,
                              processId: process.id,
                              isOpen: true,
                            });
                          }
                        },
                      },
                      {
                        id: "edit-process",
                        text: "Rename process",
                        visual: <PegaIcon name="pencil" />,
                        onClick: (data: any) => {
                          console.log("[LifeCycle] edit-process action", data);
                          const stageKey =
                            data?.category?.id ||
                            data?.categoryId ||
                            data?.category?.name ||
                            data?.stage?.id;
                          const processKey =
                            data?.task?.id || data?.id || data?.name;
                          const stage = stages.find(
                            (s) =>
                              String(s.id) === String(stageKey) ||
                              s.name === stageKey,
                          );
                          const process = stage?.processes.find(
                            (p) =>
                              String(p.id) === String(processKey) ||
                              p.name === processKey,
                          );
                          if (stage && process) {
                            setProcessEdit({
                              stageId: stage.id,
                              id: process.id,
                              name: process.name,
                            });
                          }
                        },
                      },
                      {
                        id: "delete-process",
                        text: "Delete process",
                        visual: <PegaIcon name="trash" />,
                        onClick: (data: any) => {
                          console.log(
                            "[LifeCycle] delete-process action",
                            data,
                          );
                          const stageKey =
                            data?.category?.id ||
                            data?.categoryId ||
                            data?.category?.name ||
                            data?.stage?.id;
                          const processKey =
                            data?.task?.id || data?.id || data?.name;
                          const stage = stages.find(
                            (s) =>
                              String(s.id) === String(stageKey) ||
                              s.name === stageKey,
                          );
                          const process = stage?.processes.find(
                            (p) =>
                              String(p.id) === String(processKey) ||
                              p.name === processKey,
                          );
                          if (stage && process && onDeleteProcess) {
                            onDeleteProcess(stage.id, process.id);
                          }
                        },
                      },
                    ],
                    onClick: (data: any) => {
                      console.log("[LifeCycle] process onClick", data);
                      const stageKey =
                        data?.category?.id ||
                        data?.categoryId ||
                        data?.category?.name ||
                        data?.stage?.id;
                      const processKey =
                        data?.task?.id || data?.id || data?.name;
                      const stage = stages.find(
                        (s) =>
                          String(s.id) === String(stageKey) ||
                          s.name === stageKey,
                      );
                      const process = stage?.processes.find(
                        (p) =>
                          String(p.id) === String(processKey) ||
                          p.name === processKey,
                      );
                      if (stage && process) {
                        setProcessEdit({
                          stageId: stage.id,
                          id: process.id,
                          name: process.name,
                        });
                      }
                    },
                  },
                ]}
                step={[
                  {
                    wrap: true,
                    actions: [
                      {
                        id: "edit",
                        text: "Edit",
                        visual: <PegaIcon name="pencil" />,
                        onClick: handleEditStep,
                      },
                      {
                        id: "rename",
                        text: "Rename step",
                        visual: <PegaIcon name="pencil" />,
                        onClick: (data: any) => {
                          for (const stage of stages) {
                            for (const process of stage.processes) {
                              const stepKey = data?.step?.id || data?.id;
                              const step = process.steps.find(
                                (s) =>
                                  String(s.id) === String(stepKey) ||
                                  s.name === stepKey,
                              );
                              if (step) {
                                setStepEdit({
                                  stageId: stage.id,
                                  processId: process.id,
                                  id: step.id,
                                  name: step.name,
                                  stepType: step.type as StepType,
                                });
                                return;
                              }
                            }
                          }
                        },
                      },
                      {
                        id: "delete",
                        text: "Delete",
                        visual: <PegaIcon name="trash" />,
                        onClick: handleDeleteStep,
                      },
                    ],
                    onClick: (stepData: any) => {
                      for (const stage of stages) {
                        for (const process of stage.processes) {
                          const stepKey = stepData?.step?.id || stepData?.id;
                          const step = process.steps.find(
                            (s) =>
                              String(s.id) === String(stepKey) ||
                              s.name === stepKey,
                          );
                          if (step) {
                            onStepSelect(
                              String(stage.id),
                              String(process.id),
                              String(step.id),
                            );
                            return;
                          }
                        }
                      }
                    },
                  },
                ]}
              />
            </PegaProviders>
          </ErrorBoundary>
        );
      }

      reactRootRef.current.render(content);
      console.log("🔧 Pega LifeCycle rendered in Shadow DOM");
    } else {
      console.log("🔧 Cannot render - missing reactRoot or shadowRoot");
    }

    // Cleanup: do not unmount to avoid dev StrictMode double-invoke clearing
    return () => {};
  }, [
    mappedStages,
    stages,
    onStepSelect,
    activeStage,
    activeProcess,
    activeStep,
    handleEditStep,
    handleDeleteStep,
    views,
    _readOnly,
    onDeleteProcess,
  ]);

  return (
    <>
      <div ref={containerRef} style={containerStyle}></div>

      {/* Modal is rendered in the main document */}
      <ModalPortal isOpen={!!editingStep}>
        {editingStep &&
          (() => {
            console.log("🔍 Rendering modal with editingStep:", editingStep);
            console.log("🔍 Available fields:", fields);
            const modalStep = {
              ...editingStep,
              fields: editingStep.fields.map((field: any) => ({
                fieldId: field.fieldId || field.id,
                required: field.required || false,
              })),
            };
            console.log("🔍 Modal step:", modalStep);
            return (
              <StepConfigurationModal
                isOpen={!!editingStep}
                onClose={() => setEditingStep(null)}
                step={modalStep}
                fields={fields}
                onFieldChange={onFieldChange || (() => {})}
                onAddField={async (field) => {
                  if (!onAddField) return "";
                  console.log("🟦 AddField start", { field });
                  const createdFieldName = await onAddField(field);
                  console.log("🟩 AddField created", { createdFieldName });
                  // If step has a linked viewId, add the created field to the view
                  const stepViewId = (editingStep as any)?.viewId as
                    | number
                    | undefined;
                  if (onAddFieldsToView && typeof stepViewId === "number") {
                    console.log("🟪 Attaching to view", { stepViewId });
                    await onAddFieldsToView(stepViewId, [createdFieldName]);
                    console.log("🟪 Attached to view done");
                  }
                  // Optimistically add to the modal's local state with retries while fields refresh
                  const tryUpdateEditingStep = () => {
                    const createdField = fieldsRef.current.find(
                      (f) => f.name === createdFieldName,
                    );
                    if (!createdField || typeof createdField.id !== "number") {
                      console.log("🟨 Created field not yet in fields list");
                      return false;
                    }
                    setEditingStep((prev) => {
                      if (!prev) return prev;
                      const alreadyPresent = (prev.fields || []).some(
                        (fr: any) =>
                          (fr.fieldId ?? fr.id) === (createdField as any).id,
                      );
                      if (alreadyPresent) return prev;
                      const nextFields = [
                        ...((prev.fields as any[]) || []),
                        { fieldId: createdField.id, required: false },
                      ];
                      console.log("🟢 Optimistically appended field to modal", {
                        id: createdField.id,
                      });
                      return { ...prev, fields: nextFields } as any;
                    });
                    return true;
                  };
                  let attempts = 0;
                  const maxAttempts = 25;
                  const intervalMs = 150;
                  if (!tryUpdateEditingStep()) {
                    const timer = setInterval(() => {
                      attempts += 1;
                      if (tryUpdateEditingStep() || attempts >= maxAttempts) {
                        console.log("🟥 Stopping retry loop", { attempts });
                        clearInterval(timer);
                        // If no view to attach to, attach to step directly when field becomes available
                        if (
                          !(typeof stepViewId === "number") &&
                          onAddExistingField
                        ) {
                          const created = fieldsRef.current.find(
                            (f) => f.name === createdFieldName,
                          );
                          if (created && typeof created.id === "number") {
                            console.log("🟧 Attaching to step as fallback", {
                              stepId: (editingStep as any).stepId,
                              id: created.id,
                            });
                            onAddExistingField((editingStep as any).stepId, [
                              created.id,
                            ]);
                          }
                        }
                      }
                    }, intervalMs);
                  }
                  return createdFieldName;
                }}
                onAddExistingField={(
                  stepId: number,
                  numericFieldIds: number[],
                ) => {
                  const stepViewId = (editingStep as any)?.viewId as
                    | number
                    | undefined;
                  const addMissingLocally = (ids: number[]) => {
                    setEditingStep((prev) => {
                      if (!prev) return prev as any;
                      const existing = new Set(
                        (prev.fields || []).map(
                          (fr: any) => fr.fieldId ?? fr.id,
                        ),
                      );
                      const additions = ids
                        .filter((id) => !existing.has(id))
                        .map((id) => ({ fieldId: id, required: false }));
                      if (additions.length === 0) return prev as any;
                      return {
                        ...(prev as any),
                        fields: [...(prev.fields as any[]), ...additions],
                      } as any;
                    });
                  };

                  if (typeof stepViewId === "number" && onAddFieldsToView) {
                    const fieldNames = numericFieldIds
                      .map(
                        (id) =>
                          fieldsRef.current.find((f) => f.id === id)?.name ||
                          null,
                      )
                      .filter((n): n is string => !!n);
                    try {
                      onAddFieldsToView(stepViewId, fieldNames);
                    } finally {
                      addMissingLocally(numericFieldIds);
                    }
                  } else if (onAddExistingField) {
                    try {
                      onAddExistingField(stepId, numericFieldIds);
                    } finally {
                      addMissingLocally(numericFieldIds);
                    }
                  }
                }}
                onUpdateField={onUpdateField || (() => {})}
                onDeleteField={onDeleteField || (() => {})}
              />
            );
          })()}
      </ModalPortal>

      {/* Edit Stage Modal */}
      <ModalPortal isOpen={!!stageEdit}>
        {stageEdit && (
          <EditModal
            isOpen={!!stageEdit}
            onClose={() => setStageEdit(null)}
            type="stage"
            name={stageEdit.name}
            onSubmit={(data: { name: string }) => {
              if (!onStepsUpdate) return;
              const updatedStages = stages.map((s) =>
                s.id === stageEdit.id ? { ...s, name: data.name } : s,
              );
              onStepsUpdate(updatedStages);
            }}
          />
        )}
      </ModalPortal>

      {/* Add Process Modal */}
      <ModalPortal isOpen={processModal.isOpen}>
        {processModal.isOpen && processModal.stageId !== null && (
          <AddProcessModal
            isOpen={processModal.isOpen}
            onClose={() => setProcessModal({ stageId: null, isOpen: false })}
            onAddProcess={({ name }) => {
              if (onAddProcess && processModal.stageId !== null) {
                onAddProcess(processModal.stageId, name);
              }
              setProcessModal({ stageId: null, isOpen: false });
            }}
          />
        )}
      </ModalPortal>

      {/* Edit Process Modal */}
      <ModalPortal isOpen={!!processEdit}>
        {processEdit && (
          <EditModal
            isOpen={!!processEdit}
            onClose={() => setProcessEdit(null)}
            type="process"
            name={processEdit.name}
            onSubmit={(data: { name: string }) => {
              if (!onStepsUpdate) return;
              const updatedStages = stages.map((s) =>
                s.id === processEdit.stageId
                  ? {
                      ...s,
                      processes: s.processes.map((p) =>
                        p.id === processEdit.id ? { ...p, name: data.name } : p,
                      ),
                    }
                  : s,
              );
              onStepsUpdate(updatedStages);
            }}
          />
        )}
      </ModalPortal>

      {/* Rename Step Modal */}
      <ModalPortal isOpen={!!stepEdit}>
        {stepEdit && (
          <EditModal
            isOpen={!!stepEdit}
            onClose={() => setStepEdit(null)}
            type="step"
            name={stepEdit.name}
            stepType={stepEdit.stepType}
            onSubmit={(data: {
              name: string;
              type?: StepType;
              fields?: never[];
            }) => {
              if (!onStepsUpdate) return;
              const updatedStages = stages.map((s) =>
                s.id === stepEdit.stageId
                  ? {
                      ...s,
                      processes: s.processes.map((p) =>
                        p.id === stepEdit.processId
                          ? {
                              ...p,
                              steps: p.steps.map((st) =>
                                st.id === stepEdit.id
                                  ? {
                                      ...st,
                                      name: data.name,
                                      type: (data.type || st.type) as StepType,
                                      ...(data.fields ? { fields: [] } : {}),
                                    }
                                  : st,
                              ),
                            }
                          : p,
                      ),
                    }
                  : s,
              );
              onStepsUpdate(updatedStages);
            }}
          />
        )}
      </ModalPortal>

      {/* Add Step Modal */}
      <ModalPortal isOpen={addStepModal.isOpen}>
        {addStepModal.isOpen &&
          addStepModal.stageId !== null &&
          addStepModal.processId !== null && (
            <AddStepModal
              isOpen={addStepModal.isOpen}
              onClose={() =>
                setAddStepModal({
                  stageId: null,
                  processId: null,
                  isOpen: false,
                })
              }
              onAddStep={(stageId, processId, stepName, stepType) => {
                if (onAddStep) {
                  onAddStep(stageId, processId, stepName, stepType);
                }
                setAddStepModal({
                  stageId: null,
                  processId: null,
                  isOpen: false,
                });
              }}
              stageId={addStepModal.stageId}
              processId={addStepModal.processId}
            />
          )}
      </ModalPortal>
    </>
  );
};

export default WorkflowLifecycleViewImpl;
