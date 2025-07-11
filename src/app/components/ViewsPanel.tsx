import React, { useState, useMemo, useRef, MutableRefObject } from "react";
import { Stage, Field, FieldReference } from "../types";
import AddFieldModal from "./AddFieldModal";
import StepForm from "./StepForm";
import Tooltip from "./Tooltip";
import { motion } from "framer-motion";

interface ViewsPanelProps {
  stages: Stage[];
  fields: Field[];
  views: View[];
  onAddField?: (field: {
    label: string;
    type: Field["type"];
    options?: string[];
    required?: boolean;
    primary?: boolean;
  }) => string;
  onUpdateField?: (updates: Partial<Field>) => void;
  onDeleteField?: (field: Field) => void;
  onAddFieldsToView?: (viewId: number, fieldNames: string[]) => void;
  onAddFieldsToStep?: (stepId: number, fieldNames: string[]) => void;
  onFieldsReorder?: (stepId: number, fieldIds: string[]) => void;
  selectedView?: string | null;
  onViewSelect?: (view: string | null) => void;
}

interface View {
  id: number;
  name: string;
  model: string;
  caseID: number;
}

interface CollectStep {
  id: string;
  name: string;
  stageName: string;
  fields: FieldReference[];
  isDatabaseView?: boolean;
  viewData?: View;
}

const ViewsPanel: React.FC<ViewsPanelProps> = ({
  stages,
  fields,
  views: _views,
  onAddField,
  onUpdateField,
  onDeleteField,
  onAddFieldsToView,
  onAddFieldsToStep,
  selectedView,
  onViewSelect,
  onFieldsReorder,
}) => {
  const [isAddFieldOpen, setIsAddFieldOpen] = useState(false);
  const [editingField, setEditingField] = useState<Field | null>(null);
  const addFieldButtonRef = useRef<HTMLButtonElement>(
    null,
  ) as MutableRefObject<HTMLButtonElement>;

  // Get all steps of type 'Collect information' that have corresponding database views
  const collectSteps = useMemo(() => {
    const steps: CollectStep[] = [];
    stages.forEach((stage) => {
      stage.processes.forEach((process) => {
        process.steps.forEach((step) => {
          if (step.type === "Collect information" && step.viewId) {
            steps.push({
              id: `${stage.name}-${step.name}`, // Create unique ID for steps
              name: step.name,
              stageName: stage.name,
              fields: step.fields || [],
            });
          }
        });
      });
    });
    return steps;
  }, [stages]);

  // Get all views from database
  const databaseViews = useMemo(() => {
    if (!_views || _views.length === 0) return [];

    return _views.map((view) => ({
      id: `db-${view.id}`, // Use database ID for database views
      name: view.name,
      stageName: "Database View",
      fields: [], // We'll parse these from the view model
      isDatabaseView: true,
      viewData: view,
    }));
  }, [_views]);

  // Combine database views and linked steps, prioritizing database views
  const allViews = useMemo(() => {
    // Create a map of database view names to avoid duplicates
    const databaseViewNames = new Set(databaseViews.map((v) => v.name));

    // Add steps that don't have corresponding database views (should be rare)
    const unlinkedSteps = collectSteps.filter(
      (step) => !databaseViewNames.has(step.name),
    );

    // Sort database views alphabetically, but keep workflow steps in their natural order
    const sortedDatabaseViews = databaseViews.sort((a, b) =>
      a.name.localeCompare(b.name),
    );

    // Only include database views and unlinked steps
    const combined = [...sortedDatabaseViews, ...unlinkedSteps];
    return combined;
  }, [collectSteps, databaseViews]);

  // Get the fields for the selected view
  const selectedViewFields = useMemo(() => {
    if (!selectedView) return [];

    // First try to find it as a database view
    const databaseView = allViews.find(
      (v) => v.id.toString() === selectedView && v.isDatabaseView,
    );
    if (databaseView && databaseView.viewData) {
      try {
        const viewModel = JSON.parse(databaseView.viewData.model);
        if (viewModel.fields && Array.isArray(viewModel.fields)) {
          // Map fieldIds to actual field objects
          const viewFields: Field[] = [];
          viewModel.fields.forEach(
            (fieldRef: {
              fieldId: number;
              required?: boolean;
              order?: number;
            }) => {
              const field = fields.find((f) => f.id === fieldRef.fieldId);
              if (field) {
                viewFields.push({
                  ...field,
                  required: fieldRef.required || false,
                  order: fieldRef.order || 0,
                });
              }
            },
          );
          return viewFields.sort((a, b) => (a.order || 0) - (b.order || 0));
        }
      } catch (error) {
        console.error("Error parsing view model:", error);
      }
    }

    // If not found as a database view, try to find it as a linked step
    const step = collectSteps.find((s) => s.id === selectedView);
    if (step) {
      // Create a map to store unique fields by fieldId
      const uniqueFieldsMap = new Map<number, Field>();

      step.fields.forEach((fieldRef) => {
        // Only add the field if it hasn't been added yet
        if (!uniqueFieldsMap.has(fieldRef.fieldId)) {
          const field = fields.find((f) => f.id === fieldRef.fieldId);
          if (field) {
            uniqueFieldsMap.set(fieldRef.fieldId, { ...field, ...fieldRef });
          }
        }
      });

      // Sort fields by their order from the database
      return Array.from(uniqueFieldsMap.values()).sort((a, b) => {
        const orderA = a.order || 0;
        const orderB = b.order || 0;
        return orderA - orderB;
      });
    }

    return [];
  }, [selectedView, collectSteps, fields, allViews]);

  // Get the field IDs that are already in the selected view
  const selectedViewFieldIds = useMemo(() => {
    if (!selectedView) return [];

    // First try to find it as a database view
    const databaseView = allViews.find(
      (v) => v.id.toString() === selectedView && v.isDatabaseView,
    );
    if (databaseView && databaseView.viewData) {
      try {
        const viewModel = JSON.parse(databaseView.viewData.model);
        if (viewModel.fields && Array.isArray(viewModel.fields)) {
          const fieldIds: number[] = [];
          viewModel.fields.forEach((fieldRef: { fieldId: number }) => {
            if (typeof fieldRef.fieldId === "number") {
              fieldIds.push(fieldRef.fieldId);
            }
          });
          return fieldIds;
        }
      } catch (error) {
        console.error("Error parsing view model:", error);
      }
    }

    // If not found as a database view, try to find it as a linked step
    const step = collectSteps.find((s) => s.id === selectedView);
    if (step) {
      return step.fields.map((f) => f.fieldId);
    }

    return [];
  }, [selectedView, collectSteps, allViews]);

  const handleEditSubmit = (updates: {
    label: string;
    type: Field["type"];
    options?: string[];
    required?: boolean;
  }) => {
    if (editingField && onUpdateField) {
      onUpdateField({
        name: editingField.name,
        label: updates.label,
        type: updates.type,
        options: updates.options,
        primary: editingField.primary,
      });
      setEditingField(null);
    }
  };

  // Update the click handler to use the prop
  const handleViewSelect = (viewId: string) => {
    if (onViewSelect) {
      onViewSelect(viewId);
    }
  };

  const handleFieldChange = () => {
    // Implementation of onFieldChange
  };

  const handleFieldsReorder = (startIndex: number, endIndex: number) => {
    if (!selectedView || !onFieldsReorder) return;

    // Get the current field order
    const currentFieldIds = selectedViewFields.map((field) => field.id);

    // Reorder the fields
    const reorderedFieldIds = Array.from(currentFieldIds);
    const [removed] = reorderedFieldIds.splice(startIndex, 1);
    reorderedFieldIds.splice(endIndex, 0, removed);

    // Call the parent handler with the reordered field IDs, converting selectedView to number
    onFieldsReorder(Number(selectedView), reorderedFieldIds.map(String));
  };

  const onEditField = (field: Field) => {
    setEditingField(field);
  };

  return (
    <div className="flex h-full">
      {/* Master View - List of Collect Information Steps */}
      <div className="w-1/3 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              Views
            </h3>
          </div>
          <div className="space-y-2">
            {allViews.map((view) => (
              <button
                key={view.id}
                onClick={() => handleViewSelect(view.id.toString())}
                className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                  selectedView === view.id.toString()
                    ? "bg-blue-50 dark:bg-blue-900/20 border-blue-500"
                    : "hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}
              >
                <div className="font-medium text-gray-900 dark:text-gray-100">
                  {view.name}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {view.stageName}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Detail View - Fields List */}
      <div className="flex-1 p-4 overflow-y-auto">
        {selectedView ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                {allViews.find((v) => v.id.toString() === selectedView)?.name ||
                  selectedView}
              </h3>
              <Tooltip content="Add new field">
                <motion.button
                  ref={addFieldButtonRef}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setIsAddFieldOpen(true)}
                  className="inline-flex items-center px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 shadow-sm text-sm"
                  aria-label="Add new field"
                >
                  <svg
                    className="w-4 h-4 mr-1.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  Add Field
                </motion.button>
              </Tooltip>
            </div>

            {selectedViewFields.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No fields added yet. Click "Add Field" to get started.
                </p>
              </div>
            ) : (
              <div className="relative">
                <StepForm
                  fields={selectedViewFields}
                  onFieldChange={handleFieldChange}
                  onDeleteField={onDeleteField ?? (() => {})}
                  onEditField={onEditField}
                  onReorderFields={handleFieldsReorder}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="text-center text-gray-500 dark:text-gray-400 mt-8">
            Select a view to see its fields
          </div>
        )}
      </div>

      <AddFieldModal
        isOpen={isAddFieldOpen}
        onClose={() => setIsAddFieldOpen(false)}
        onAddField={async (field) => {
          if (onAddField) {
            const fieldName = onAddField({
              ...field,
              primary: field.primary ?? false,
            });
            if (selectedView) {
              // Check if this is a database view or a workflow step
              const databaseView = allViews.find(
                (v) => v.id.toString() === selectedView && v.isDatabaseView,
              );
              if (databaseView && onAddFieldsToView) {
                // It's a database view
                onAddFieldsToView(databaseView.viewData!.id, [fieldName]);
              } else if (onAddFieldsToStep) {
                // It's a workflow step - find the step ID
                const step = collectSteps.find((s) => s.id === selectedView);
                if (step) {
                  // Find the actual step in the workflow
                  let stepId: number | undefined;
                  stages.forEach((stage) => {
                    stage.processes.forEach((process) => {
                      process.steps.forEach((step) => {
                        if (
                          step.name === step.name &&
                          step.type === "Collect information"
                        ) {
                          stepId = step.id;
                        }
                      });
                    });
                  });
                  if (stepId) {
                    onAddFieldsToStep(stepId, [fieldName]);
                  }
                }
              }
            }
          }
        }}
        buttonRef={addFieldButtonRef}
        existingFields={fields}
        stepFieldIds={selectedViewFieldIds.map(String)}
        onAddExistingField={(fieldIds) => {
          if (selectedView) {
            // Check if this is a database view or a workflow step
            const databaseView = allViews.find(
              (v) => v.id.toString() === selectedView && v.isDatabaseView,
            );
            if (databaseView && onAddFieldsToView) {
              // It's a database view
              onAddFieldsToView(databaseView.viewData!.id, fieldIds);
            } else if (onAddFieldsToStep) {
              // It's a workflow step - find the step ID
              const step = collectSteps.find((s) => s.id === selectedView);
              if (step) {
                // Find the actual step in the workflow
                let stepId: number | undefined;
                stages.forEach((stage) => {
                  stage.processes.forEach((process) => {
                    process.steps.forEach((step) => {
                      if (
                        step.name === step.name &&
                        step.type === "Collect information"
                      ) {
                        stepId = step.id;
                      }
                    });
                  });
                });
                if (stepId) {
                  onAddFieldsToStep(stepId, fieldIds);
                }
              }
            }
          }
        }}
      />

      {editingField && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white dark:bg-gray-800 rounded-xl shadow-xl z-50"
        >
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Edit Field
            </h3>
          </div>
          <div className="p-4 space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Label
              </label>
              <input
                type="text"
                value={editingField.label}
                onChange={(e) =>
                  setEditingField({
                    ...editingField,
                    label: e.target.value,
                  })
                }
                className="w-full px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
              />
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <Tooltip content="Cancel editing">
                <button
                  onClick={() => setEditingField(null)}
                  className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg"
                >
                  Cancel
                </button>
              </Tooltip>
              <Tooltip content="Save field changes">
                <button
                  onClick={() => {
                    if (editingField) {
                      handleEditSubmit({
                        label: editingField.label,
                        type: editingField.type,
                      });
                    }
                  }}
                  className="px-4 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                >
                  Save Changes
                </button>
              </Tooltip>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default ViewsPanel;
