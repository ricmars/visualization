import React, { useState, useEffect, useRef, MutableRefObject } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import StepForm from './StepForm';
import { Field, FieldValue } from '../types';
import AddFieldModal from './AddFieldModal';
import Tooltip from './Tooltip';

interface StepConfigurationModalProps {
  isOpen: boolean;
  onClose: () => void;
  step: {
    id: string;
    name: string;
    type: string;
    fields: FieldValue[];
  };
  fields: Field[];
  onAddField: (field: { label: string; type: Field['type']; options?: string[]; required?: boolean; isPrimary?: boolean }) => string;
  onUpdateField?: (updates: Partial<Field>) => void;
  onDeleteField: (fieldId: string) => void;
  onFieldsReorder?: (stepId: string, fieldIds: string[]) => void;
  onAddExistingFieldToStep?: (stepId: string, fieldIds: string[]) => void;
}

const StepConfigurationModal: React.FC<StepConfigurationModalProps> = ({
  isOpen,
  onClose,
  step,
  fields,
  onAddField,
  onUpdateField,
  onDeleteField,
  onFieldsReorder,
  onAddExistingFieldToStep
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const addFieldButtonRef = useRef<HTMLButtonElement>(null) as MutableRefObject<HTMLButtonElement>;
  const [isAddFieldOpen, setIsAddFieldOpen] = useState(false);
  const [editingField, setEditingField] = useState<Field | null>(null);

  // Filter fields to only show those associated with this step
  const stepFieldIds = step.fields.map(f => f.id);
  const filteredFields = fields.filter(field => stepFieldIds.includes(field.id));

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setTimeout(() => {
        modalRef.current?.focus();
      }, 100);
    } else {
      document.body.style.overflow = 'unset';
      setEditingField(null);
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (editingField) {
        setEditingField(null);
      } else {
        onClose();
      }
    }
  };

  const handleEditField = (field: Field) => {
    setEditingField({
      ...field,
      required: field.required ?? false // Set default value if undefined
    });
  };

  const handleEditSubmit = (updates: { label: string; type: Field['type']; options?: string[]; required?: boolean }) => {
    if (editingField && onUpdateField) {
      onUpdateField({
        id: editingField.id,
        ...updates
      });
      setEditingField(null);
    }
  };

  const handleReorderFields = (startIndex: number, endIndex: number) => {
    if (!onFieldsReorder || !step) return;
    
    const reorderedFields = Array.from(filteredFields);
    const [removed] = reorderedFields.splice(startIndex, 1);
    reorderedFields.splice(endIndex, 0, removed);
    
    onFieldsReorder(step.id, reorderedFields.map(field => field.id));
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => editingField ? setEditingField(null) : onClose()}
          />
          <motion.div
            ref={modalRef}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6"
            onKeyDown={handleKeyDown}
            tabIndex={-1}
          >
            <div className="flex flex-col">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                    Configure Step: {step.name}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  {step.type === 'Collect information' && (
                    <Tooltip content="Add new field">
                      <motion.button
                        ref={addFieldButtonRef}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setIsAddFieldOpen(true)}
                        className="inline-flex items-center px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 shadow-sm text-sm"
                        aria-label="Add new field"
                      >
                        <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add Field
                      </motion.button>
                    </Tooltip>
                  )}
                  <Tooltip content="Close modal">
                    <button
                      onClick={onClose}
                      className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                      aria-label="Close modal"
                    >
                      <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </Tooltip>
                </div>
              </div>

              <div className="mt-4 max-h-[calc(100vh-14rem)] overflow-y-auto">
                {step.type !== 'Collect information' ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      This step type does not support custom fields.
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Only steps of type "Collect information" can have fields.
                    </p>
                  </div>
                ) : filteredFields.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      No fields added yet. Click "Add Field" to get started.
                    </p>
                  </div>
                ) : (
                  <div className="relative">
                    <StepForm
                      fields={filteredFields}
                      onFieldChange={(_id, _value) => {
                        // Implementation of onFieldChange
                      }}
                      onDeleteField={onDeleteField}
                      onEditField={handleEditField}
                      onReorderFields={handleReorderFields}
                    />
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          <AddFieldModal
            isOpen={isAddFieldOpen}
            onClose={() => setIsAddFieldOpen(false)}
            onAddField={(field) => onAddField({ ...field, isPrimary: field.isPrimary ?? false })}
            buttonRef={addFieldButtonRef}
            existingFields={fields}
            stepFieldIds={step.fields.map(f => f.id)}
            onAddExistingField={(fieldIds) => {
              if (onAddExistingFieldToStep) {
                onAddExistingFieldToStep(step.id, fieldIds);
              }
            }}
          />

          <AnimatePresence>
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
                      onChange={(e) => setEditingField({ ...editingField, label: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="required"
                      checked={editingField?.required ?? false}
                      onChange={(e) => setEditingField({ ...editingField, required: e.target.checked })}
                      className="rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                    />
                    <label htmlFor="required" className="text-sm text-gray-700 dark:text-gray-300">
                      Required
                    </label>
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
                              required: editingField.required
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
          </AnimatePresence>
        </>
      )}
    </AnimatePresence>
  );
};

export default StepConfigurationModal; 