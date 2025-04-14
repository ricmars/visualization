import React, { useRef, useEffect, useState, useMemo } from "react";
import Frame from "react-frame-component";
import { LifeCycle, StageItemProps } from "@pega/cosmos-react-build";
import {
  Configuration,
  LiveLog,
  PopoverManager,
  Toaster,
  ModalManager,
} from "@pega/cosmos-react-core";
import { Stage } from "../types";

interface WorkflowLifecycleViewProps {
  stages: Stage[];
  onStepSelect: (stageId: string, processId: string, stepId: string) => void;
  activeStage?: string;
  activeProcess?: string;
  activeStep?: string;
}

const WorkflowLifecycleViewImpl: React.FC<WorkflowLifecycleViewProps> = ({
  stages,
  onStepSelect,
  activeStage,
  activeProcess,
  activeStep,
}) => {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [frameBody, setFrameBody] = useState<HTMLElement | null>(null);

  const containerStyle: React.CSSProperties = {
    height: "calc(100vh - 130px)",
    overflow: "auto",
  };

  const frameStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    border: "none",
    display: "block",
  };

  useEffect(() => {
    const initializeFrame = () => {
      const frame = frameRef.current;
      if (!frame) return;

      const updateFrameBody = () => {
        const body = frame.contentDocument?.body;
        if (body && body !== frameBody) {
          setFrameBody(body);
        }
      };

      // Initial check
      updateFrameBody();

      // Listen for iframe load event
      frame.addEventListener("load", updateFrameBody);

      return () => {
        frame.removeEventListener("load", updateFrameBody);
      };
    };

    initializeFrame();
  }, [frameBody]);

  // Memoize the stages mapping to prevent unnecessary recalculations
  const mappedStages = useMemo(
    () =>
      stages.map(
        (stage: Stage): StageItemProps => ({
          id: stage.name,
          label: stage.name,
          type: "default",
          error: "",
          categories: [
            {
              id: stage.name,
              categoryId: stage.name,
              tasks: stage.processes.map((process) => ({
                id: process.name,
                label: process.name,
                visual: { imgSrc: "" },
                steps: process.steps.map((step) => ({
                  status: {
                    type: "",
                    label: step.name,
                  },
                  id: step.name,
                  label: step.name,
                  visual: {
                    imgSrc: "",
                    name: "user-document",
                    label: "review",
                    category: "task",
                    inverted: false,
                  },
                })),
              })),
            },
          ],
        }),
      ),
    [stages],
  );
  console.log(mappedStages);

  const initialContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          html, body {
            margin: 0;
            padding: 6px;
            height: 100%;
            overflow: auto;
          }

        </style>
      </head>
      <body>
        <div class="frame-root"></div>
      </body>
    </html>
  `;

  // Memoize the frame content to prevent unnecessary rerenders
  const frameContent = useMemo(
    () => (
      <Configuration styleSheetTarget={frameBody || undefined}>
        <LiveLog maxLength={50}>
          <PopoverManager>
            <Toaster dismissAfter={5000}>
              <ModalManager>
                <LifeCycle
                  items={mappedStages}
                  stages={stages}
                  onStepSelect={onStepSelect}
                  activeStage={activeStage}
                  activeProcess={activeProcess}
                  activeStep={activeStep}
                />
              </ModalManager>
            </Toaster>
          </PopoverManager>
        </LiveLog>
      </Configuration>
    ),
    [
      frameBody,
      mappedStages,
      stages,
      activeStage,
      activeProcess,
      activeStep,
      onStepSelect,
    ],
  );

  return (
    <div style={containerStyle}>
      <Frame ref={frameRef} style={frameStyle} initialContent={initialContent}>
        {frameContent}
      </Frame>
    </div>
  );
};

export default WorkflowLifecycleViewImpl;
