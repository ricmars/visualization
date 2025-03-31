import React, { useState, useEffect, useRef, MutableRefObject } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import StepForm from './StepForm';
import { Field } from '../types';
import { FaPencilAlt } from 'react-icons/fa';
import AddFieldModal from './AddFieldModal';
import Tooltip from './Tooltip';

interface StepConfigurationModalProps {
  isOpen: boolean;
  onClose: () => void;
  fields: Field[];
  onFieldChange: (fieldId: string, value: string | number | boolean) => void;
  onAddField: () => void;
  stepName: string;
  onUpdateField?: (fieldId: string, updates: Partial<Field>) => void;
  onDeleteField?: (fieldId: string) => void;
}

const FIELD_TYPES = ['text', 'number', 'select', 'checkbox', 'email', 'textarea'] as const;
type FieldType = typeof FIELD_TYPES[number];

const StepConfigurationModal: React.FC<StepConfigurationModalProps> = ({
  isOpen,
  onClose,
  fields,
  onFieldChange,
  onAddField,
  stepName,
  onUpdateField,
  onDeleteField
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null) as MutableRefObject<HTMLInputElement>;
  const addFieldButtonRef = useRef<HTMLButtonElement>(null) as MutableRefObject<HTMLButtonElement>;
  const [isAddFieldOpen, setIsAddFieldOpen] = useState(false);
  const [editingField, setEditingField] = useState<Field | null>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setTimeout(() => {
        if (fields.length > 0) {
          firstFieldRef.current?.focus();
        } else {
          modalRef.current?.focus();
        }
      }, 100);
    } else {
      document.body.style.overflow = 'unset';
      setEditingField(null);
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, fields.length]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (editingField) {
        setEditingField(null);
      } else {
        onClose();
      }
    }
  };

  const handleAddFieldSubmit = (field: { label: string; type: string }) => {
    onAddField();
    setIsAddFieldOpen(false);
  };

  const handleEditField = (field: Field) => {
    setEditingField(field);
  };

  const handleUpdateField = (updates: Partial<Field>) => {
    if (editingField && onUpdateField) {
      onUpdateField(editingField.id, updates);
      setEditingField(null);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <div
            className="fixed inset-0 bg-black bg-opacity-25 backdrop-blur-sm"
            onClick={() => editingField ? setEditingField(null) : onClose()}
          />
          <motion.div
            ref={modalRef}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-white dark:bg-gray-800 rounded-xl shadow-xl"
            onKeyDown={handleKeyDown}
            tabIndex={-1}
          >
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Configure Step: {stepName}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <Tooltip content="Add new field">
                    <motion.button
                      ref={addFieldButtonRef}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setIsAddFieldOpen(true)}
                      className="inline-flex items-center px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 shadow-sm"
                      aria-label="Add new field"
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add Field
                    </motion.button>
                  </Tooltip>
                  <Tooltip content="Close modal">
                    <button
                      onClick={onClose}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                      aria-label="Close modal"
                    >
                      <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </Tooltip>
                </div>
              </div>
            </div>

            <div className="p-6 max-h-[calc(100vh-16rem)] overflow-y-auto">
              {fields.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500 dark:text-gray-400">
                    No fields added yet. Click "Add Field" to get started.
                  </p>
                </div>
              ) : (
                <StepForm
                  fields={fields}
                  onFieldChange={onFieldChange}
                  onDeleteField={onDeleteField}
                  onEditField={handleEditField}
                  firstFieldRef={firstFieldRef}
                />
              )}
            </div>
          </motion.div>

          <AddFieldModal
            isOpen={isAddFieldOpen}
            onClose={() => setIsAddFieldOpen(false)}
            onAddField={handleAddFieldSubmit}
            buttonRef={addFieldButtonRef}
          />

          <AnimatePresence>
            {editingField && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white dark:bg-gray-800 rounded-xl shadow-xl z-50"
              >
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Edit Field
                  </h3>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Label
                    </label>
                    <input
                      type="text"
                      value={editingField.label}
                      onChange={(e) => setEditingField({ ...editingField, label: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Type
                    </label>
                    <select
                      value={editingField.type}
                      onChange={(e) => setEditingField({ ...editingField, type: e.target.value as FieldType })}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    >
                      {FIELD_TYPES.map(type => (
                        <option key={type} value={type}>
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="checkbox"
                      id="required"
                      checked={editingField.required}
                      onChange={(e) => setEditingField({ ...editingField, required: e.target.checked })}
                      className="rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                    />
                    <label htmlFor="required" className="text-sm text-gray-700 dark:text-gray-300">
                      Required
                    </label>
                  </div>
                  <div className="flex justify-end gap-3 mt-6">
                    <Tooltip content="Cancel editing">
                      <button
                        onClick={() => setEditingField(null)}
                        className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg"
                      >
                        Cancel
                      </button>
                    </Tooltip>
                    <Tooltip content="Save field changes">
                      <button
                        onClick={() => handleUpdateField({
                          label: editingField.label,
                          type: editingField.type,
                          required: editingField.required
                        })}
                        className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
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