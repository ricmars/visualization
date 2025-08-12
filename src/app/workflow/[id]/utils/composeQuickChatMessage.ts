export type MinimalField = { id: number; name: string };
export type MinimalView = { id: number; name: string };

export type MinimalStep = { id: number; name: string } & Record<
  string,
  unknown
>;
export type MinimalProcess = { id: number; name: string; steps: MinimalStep[] };
export type MinimalStage = {
  id: number;
  name: string;
  processes: MinimalProcess[];
};

type ComposeQuickChatMessageArgs = {
  quickChatText: string;
  selectedFieldIds: number[];
  selectedViewIds: number[];
  selectedStageIds: number[];
  selectedProcessIds: number[];
  selectedStepIds: number[];
  fields: MinimalField[];
  views: MinimalView[];
  stages: MinimalStage[];
};

export function composeQuickChatMessage({
  quickChatText,
  selectedFieldIds,
  selectedViewIds,
  selectedStageIds,
  selectedProcessIds,
  selectedStepIds,
  fields,
  views,
  stages,
}: ComposeQuickChatMessageArgs): string {
  const chosenFields = fields.filter((f) => selectedFieldIds.includes(f.id));
  const fieldNames = chosenFields.map((f) => f.name);

  const chosenViews = views.filter((v) => selectedViewIds.includes(v.id));
  const viewNames = chosenViews.map((v) => v.name);

  const chosenStages = stages.filter((s) => selectedStageIds.includes(s.id));
  const stageNames = chosenStages.map((s) => s.name);

  const processMap: { ids: number[]; names: string[] } = { ids: [], names: [] };
  for (const stage of stages) {
    for (const process of stage.processes) {
      if (selectedProcessIds.includes(process.id)) {
        processMap.ids.push(process.id);
        processMap.names.push(process.name);
      }
    }
  }

  const stepMap: { ids: number[]; names: string[] } = { ids: [], names: [] };
  for (const stage of stages) {
    for (const process of stage.processes) {
      for (const step of process.steps) {
        if (selectedStepIds.includes(step.id)) {
          stepMap.ids.push(step.id);
          stepMap.names.push(step.name);
        }
      }
    }
  }

  const contextPrefix = `Context:\nSelected fieldIds=${JSON.stringify(
    selectedFieldIds,
  )}\nSelected fieldNames=${JSON.stringify(
    fieldNames,
  )}\nSelected viewIds=${JSON.stringify(
    selectedViewIds,
  )}\nSelected viewNames=${JSON.stringify(
    viewNames,
  )}\nSelected stageIds=${JSON.stringify(
    selectedStageIds,
  )}\nSelected stageNames=${JSON.stringify(
    stageNames,
  )}\nSelected processIds=${JSON.stringify(
    processMap.ids,
  )}\nSelected processNames=${JSON.stringify(
    processMap.names,
  )}\nSelected stepIds=${JSON.stringify(
    stepMap.ids,
  )}\nSelected stepNames=${JSON.stringify(stepMap.names)}\n`;

  const composedMessage = `${contextPrefix}\nInstruction: ${quickChatText.trim()}`;
  return composedMessage;
}
