import { WorkflowModel } from "./toolTypes";

/**
 * Removes references to a given view (by id) from all steps in the provided case model.
 * This function does not delete steps; it only clears the `viewId` property when it matches.
 *
 * Returns the updated model (same object, mutated) and the number of steps updated.
 */
export function removeViewReferencesFromCaseModel(
  model: WorkflowModel | any,
  viewId: number,
): { model: WorkflowModel | any; updatedStepsCount: number } {
  let updatedStepsCount = 0;
  if (!model || !Array.isArray(model.stages)) {
    return { model, updatedStepsCount };
  }

  for (const stage of model.stages) {
    for (const process of stage.processes || []) {
      for (const step of process.steps || []) {
        if (typeof step.viewId === "number" && step.viewId === viewId) {
          delete step.viewId;
          updatedStepsCount++;
        }
      }
    }
  }

  return { model, updatedStepsCount };
}

/**
 * Removes a field by id from a view model's fields array.
 * Returns the updated model (same object, mutated) and whether any removal occurred.
 */
export function removeFieldFromViewModel(
  viewModel: any,
  fieldId: number,
): { viewModel: any; removed: boolean; removedCount: number } {
  const model = viewModel || {};
  const current = Array.isArray(model.fields) ? model.fields : [];
  const originalCount = current.length;
  model.fields = current.filter(
    (f: { fieldId: number }) => f.fieldId !== fieldId,
  );
  const removedCount = originalCount - model.fields.length;
  return { viewModel: model, removed: removedCount > 0, removedCount };
}

/**
 * Adds a field reference to a view model if not already present.
 * If present, it's a no-op unless `forceUpdateOrder` is set to true.
 */
export function addFieldToViewModel(
  viewModel: any,
  fieldId: number,
  options?: { required?: boolean; order?: number; forceUpdateOrder?: boolean },
): { viewModel: any; added: boolean } {
  const model = viewModel || {};
  const required = options?.required ?? false;
  const forceUpdateOrder = options?.forceUpdateOrder ?? false;
  const fields = Array.isArray(model.fields) ? model.fields : [];

  const existingIndex = fields.findIndex(
    (f: { fieldId: number }) => f.fieldId === fieldId,
  );
  if (existingIndex !== -1) {
    if (forceUpdateOrder && typeof options?.order === "number") {
      fields[existingIndex] = {
        ...fields[existingIndex],
        order: options.order,
      };
    }
    model.fields = fields;
    return { viewModel: model, added: false };
  }

  const nextOrder =
    typeof options?.order === "number"
      ? options.order
      : (fields.length || 0) + 1;
  model.fields = [...fields, { fieldId, required, order: nextOrder }];
  return { viewModel: model, added: true };
}

/**
 * Sets or clears `viewId` for a given step by numeric `stepId` within a case model.
 * If `viewId` is undefined/null, the property will be removed.
 */
export function setStepViewReferenceInCaseModel(
  model: WorkflowModel | any,
  stepId: number,
  viewId?: number,
): { model: WorkflowModel | any; updated: boolean } {
  if (!model || !Array.isArray(model.stages)) {
    return { model, updated: false };
  }
  for (const stage of model.stages) {
    for (const process of stage.processes || []) {
      for (const step of process.steps || []) {
        if (typeof step.id === "number" && step.id === stepId) {
          if (typeof viewId === "number") {
            step.viewId = viewId;
          } else {
            delete step.viewId;
          }
          return { model, updated: true };
        }
      }
    }
  }
  return { model, updated: false };
}
