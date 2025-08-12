import { Stage, Process, Step } from "../../../types";

export function validateModelIds(stages: Partial<Stage>[]): Stage[] {
  return stages.map((stage, stageIndex) => {
    if (!stage.id) {
      throw new Error(`Stage at index ${stageIndex} is missing an ID`);
    }

    return {
      ...stage,
      processes: (stage.processes || []).map(
        (process: Partial<Process>, processIndex: number) => {
          if (!process.id) {
            throw new Error(
              `Process at index ${processIndex} in stage "${stage.name}" is missing an ID`,
            );
          }

          return {
            ...process,
            steps: (process.steps || []).map(
              (step: Partial<Step>, stepIndex: number) => {
                if (!step.id) {
                  throw new Error(
                    `Step at index ${stepIndex} in process "${process.name}" of stage "${stage.name}" is missing an ID`,
                  );
                }
                return step as Step;
              },
            ),
          } as Process;
        },
      ),
    } as Stage;
  });
}
