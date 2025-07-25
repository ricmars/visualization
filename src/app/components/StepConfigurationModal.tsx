import React, { useState, useEffect, useRef, useMemo } from "react";
import { Field, FieldReference } from "../types";
import AddFieldModal from "./AddFieldModal";
import EditFieldModal from "./EditFieldModal";
import StepForm from "./StepForm";

interface StepConfigurationModalProps {
  isOpen: boolean;
  onClose: () => void;
  step: {
    id: number;
    stageId: number;
    processId: number;
    stepId: number;
    name: string;
    fields: FieldReference[];
    type: string;
  };
  fields: Field[];
  onFieldChange: (fieldId: number, value: string | number | boolean) => void;
  onAddField: (field: {
    label: string;
    type: Field["type"];
    options?: string[];
    required?: boolean;
    primary?: boolean;
  }) => string;
  onAddExistingField: (stepId: number, fieldIds: number[]) => void;
  onUpdateField: (updates: Partial<Field>) => void;
  onDeleteField: (field: Field) => void;
}

const StepConfigurationModal: React.FC<StepConfigurationModalProps> = ({
  isOpen,
  onClose,
  step,
  fields,
  onFieldChange,
  onAddField,
  onAddExistingField,
  onUpdateField,
  onDeleteField,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const [isAddFieldOpen, setIsAddFieldOpen] = useState(false);
  const [editingField, setEditingField] = useState<Field | null>(null);
  const addFieldButtonRef = useRef<HTMLButtonElement>(
    null,
  ) as React.MutableRefObject<HTMLButtonElement>;

  // Map field references to actual fields using fieldId
  const stepFields = useMemo(() => {
    return step.fields
      .map((fieldRef) => {
        const field = fields.find((f) => f.id === fieldRef.fieldId);
        return field ? { ...field, required: fieldRef.required } : null;
      })
      .filter((f): f is Field & { required: boolean } => f !== null);
  }, [step.fields, fields]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      setTimeout(() => {
        modalRef.current?.focus();
      }, 100);
    } else {
      document.body.style.overflow = "unset";
      setIsAddFieldOpen(false);
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  // Update stepFields when a field is edited
  useEffect(() => {
    if (editingField) {
      const updatedFields = stepFields.map((field) =>
        field.id === editingField.id ? { ...field, ...editingField } : field,
      );
      onAddExistingField(
        step.id,
        updatedFields.map((field) => field.id!),
      );
    }
  }, [editingField, stepFields, step.id, onAddExistingField]);

  const handleReorderFields = (startIndex: number, endIndex: number) => {
    const reorderedFields = Array.from(stepFields);
    const [removed] = reorderedFields.splice(startIndex, 1);
    reorderedFields.splice(endIndex, 0, removed);

    onAddExistingField(
      step.id,
      reorderedFields.map((field) => field.id!),
    );
  };

  const handleRemoveField = (field: Field) => {
    onDeleteField(field);
  };

  if (!isOpen) return null;

  const stepFieldIds = stepFields.map((field) => field.id!);

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full mx-4"
        onClick={(e) => e.stopPropagation()}
        ref={modalRef}
      >
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Configure Step: {step.name}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="p-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                Fields
              </h3>
              {step.type === "Collect information" ? (
                <button
                  ref={addFieldButtonRef}
                  onClick={() => setIsAddFieldOpen(true)}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Add Field
                </button>
              ) : null}
            </div>

            {step.type === "Collect information" ? (
              stepFields.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No fields added yet. Click "Add Field" to get started.
                  </p>
                </div>
              ) : (
                <div className="relative">
                  <StepForm
                    fields={stepFields}
                    onFieldChange={(
                      fieldId: string,
                      value: string | number | boolean,
                    ) => {
                      const numericFieldId = parseInt(fieldId, 10);
                      if (!isNaN(numericFieldId)) {
                        onFieldChange(numericFieldId, value);
                      }
                    }}
                    onDeleteField={handleRemoveField}
                    onReorderFields={handleReorderFields}
                    onEditField={(field) => setEditingField(field)}
                  />
                </div>
              )
            ) : (
              <div className="text-center py-8">
                <div className="inline-block px-4 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    Only "Collect information" steps can have fields
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <AddFieldModal
          isOpen={isAddFieldOpen}
          onClose={() => setIsAddFieldOpen(false)}
          onAddField={(field) => {
            const newFieldName = onAddField({
              ...field,
              primary: field.primary ?? false,
            });
            // Convert field name to field ID for the step
            const newField = fields.find((f) => f.name === newFieldName);
            if (newField?.id) {
              onAddExistingField(step.id, [newField.id]);
            }
          }}
          buttonRef={addFieldButtonRef}
          existingFields={fields}
          stepFieldIds={stepFieldIds.map(String)}
          onAddExistingField={(fieldIds) => {
            // Convert string field IDs back to numbers
            const numericFieldIds = fieldIds
              .map((id) => parseInt(id, 10))
              .filter((id) => !isNaN(id));
            onAddExistingField(step.id, numericFieldIds);
          }}
        />

        {editingField && (
          <EditFieldModal
            isOpen={!!editingField}
            onClose={() => setEditingField(null)}
            onSubmit={(updates) => {
              onUpdateField(updates);
              setEditingField(null);
            }}
            field={editingField}
          />
        )}
      </div>
    </div>
  );
};

export default StepConfigurationModal;
