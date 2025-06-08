import React, { useState, useMemo, useRef, MutableRefObject } from "react";
import { Stage, Field, FieldReference } from "../types";
import AddFieldModal from "./AddFieldModal";
import StepForm from "./StepForm";
import Tooltip from "./Tooltip";
import { motion } from "framer-motion";

interface ViewsPanelProps {
  stages: Stage[];
  fields: Field[];
  onAddField?: (field: {
    label: string;
    type: Field["type"];
    options?: string[];
    required?: boolean;
    primary?: boolean;
  }) => string;
  onUpdateField?: (updates: Partial<Field>) => void;
  onDeleteField?: (field: Field) => void;
  onAddExistingFieldToStep?: (stepId: string, fieldIds: string[]) => void;
  onFieldsReorder?: (stepId: string, fieldIds: string[]) => void;
  selectedView?: string | null;
  onViewSelect?: (view: string | null) => void;
}

interface CollectStep {
  name: string;
  stageName: string;
  fields: FieldReference[];
}

const ViewsPanel: React.FC<ViewsPanelProps> = ({
  stages,
  fields,
  onAddField,
  onUpdateField,
  onDeleteField,
  onAddExistingFieldToStep,
  onFieldsReorder,
  selectedView,
  onViewSelect,
}) => {
  const [isAddFieldOpen, setIsAddFieldOpen] = useState(false);
  const [editingField, setEditingField] = useState<Field | null>(null);
  const addFieldButtonRef = useRef<HTMLButtonElement>(
    null,
  ) as MutableRefObject<HTMLButtonElement>;

  // Get all steps of type 'Collect information' and sort them alphabetically
  const collectSteps = useMemo(() => {
    const steps: CollectStep[] = [];
    stages.forEach((stage) => {
      stage.processes.forEach((process) => {
        process.steps.forEach((step) => {
          if (step.type === "Collect information") {
            steps.push({
              name: step.name,
              stageName: stage.name,
              fields: step.fields || [],
            });
          }
        });
      });
    });
    return steps.sort((a, b) => a.name.localeCompare(b.name));
  }, [stages]);

  // Get the fields for the selected view
  const selectedViewFields = useMemo(() => {
    if (!selectedView) return [];
    const step = collectSteps.find((s) => s.name === selectedView);
    if (!step) return [];

    // Create a map to store unique fields by name
    const uniqueFieldsMap = new Map<string, Field>();

    step.fields.forEach((fieldRef) => {
      // Only add the field if it hasn't been added yet
      if (!uniqueFieldsMap.has(fieldRef.name)) {
        const field = fields.find((f) => f.name === fieldRef.name);
        if (field) {
          uniqueFieldsMap.set(fieldRef.name, { ...field, ...fieldRef });
        }
      }
    });

    return Array.from(uniqueFieldsMap.values());
  }, [selectedView, collectSteps, fields]);

  // Get the field IDs that are already in the selected view
  const selectedViewFieldIds = useMemo(() => {
    if (!selectedView) return [];
    const step = collectSteps.find((s) => s.name === selectedView);
    if (!step) return [];
    return step.fields.map((f) => f.name);
  }, [selectedView, collectSteps]);

  const handleEditField = (field: Field) => {
    setEditingField({
      ...field,
    });
  };

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

  const handleReorderFields = (startIndex: number, endIndex: number) => {
    if (!onFieldsReorder || !selectedView) return;

    // Create a new array with unique field references
    const uniqueFieldsMap = new Map<string, Field>();

    // First, add all fields to the map to ensure uniqueness
    selectedViewFields.forEach((field) => {
      if (!uniqueFieldsMap.has(field.name)) {
        uniqueFieldsMap.set(field.name, field);
      }
    });

    const uniqueFields = Array.from(uniqueFieldsMap.values());
    const reorderedFields = Array.from(uniqueFields);
    const [removed] = reorderedFields.splice(startIndex, 1);
    reorderedFields.splice(endIndex, 0, removed);

    onFieldsReorder(
      selectedView,
      reorderedFields.map((field) => field.name),
    );
  };

  // Update the click handler to use the prop
  const handleViewSelect = (viewName: string) => {
    if (onViewSelect) {
      onViewSelect(viewName);
    }
  };

  const handleFieldChange = (id: string, value: string) => {
    // Implementation of onFieldChange
  };

  const handleFieldsReorder = (startIndex: number, endIndex: number) => {
    // Implementation of onFieldsReorder
  };

  const onEditField = (field: Field) => {
    // Implementation of onEditField
  };

  return (
    <div className="flex h-full">
      {/* Master View - List of Collect Information Steps */}
      <div className="w-1/3 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
        <div className="p-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
            Views
          </h3>
          <div className="space-y-2">
            {collectSteps.map((step) => (
              <button
                key={step.name}
                onClick={() => handleViewSelect(step.name)}
                className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                  selectedView === step.name
                    ? "bg-blue-50 dark:bg-blue-900/20 border-blue-500"
                    : "hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}
              >
                <div className="font-medium text-gray-900 dark:text-gray-100">
                  {step.name}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {step.stageName}
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
                {selectedView}
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
                  onDeleteField={onDeleteField}
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
        onAddField={(field) => {
          if (onAddField) {
            const newFieldName = onAddField({
              ...field,
              primary: field.primary ?? false,
            });
            if (selectedView && onAddExistingFieldToStep) {
              onAddExistingFieldToStep(selectedView, [newFieldName]);
            }
          }
        }}
        buttonRef={addFieldButtonRef}
        existingFields={fields}
        stepFieldIds={selectedViewFieldIds}
        onAddExistingField={(fieldIds) => {
          if (selectedView && onAddExistingFieldToStep) {
            onAddExistingFieldToStep(selectedView, fieldIds);
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
