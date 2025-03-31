import React, { RefObject } from 'react';
import { Field } from '../types';
import { FaTrash, FaPencilAlt } from 'react-icons/fa';
import Tooltip from './Tooltip';

interface StepFormProps {
  fields: Field[];
  onFieldChange: (fieldId: string, value: string | number | boolean) => void;
  onDeleteField?: (fieldId: string) => void;
  onEditField?: (field: Field) => void;
  firstFieldRef: RefObject<HTMLInputElement>;
}

const StepForm: React.FC<StepFormProps> = ({
  fields,
  onFieldChange,
  onDeleteField,
  onEditField,
  firstFieldRef
}) => {
  return (
    <div className="space-y-4">
      {fields.map((field, index) => (
        <div key={field.id} className="relative group p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </h4>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Type: {field.type}
              </p>
              {field.description && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {field.description}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {onEditField && (
                <Tooltip content={`Edit ${field.label}`}>
                  <button
                    onClick={() => onEditField(field)}
                    className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-all focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                    aria-label={`Edit ${field.label}`}
                  >
                    <FaPencilAlt className="w-4 h-4 text-gray-500" />
                  </button>
                </Tooltip>
              )}
              {onDeleteField && (
                <Tooltip content={`Delete ${field.label}`}>
                  <button
                    onClick={() => onDeleteField(field.id)}
                    className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-all focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                    aria-label={`Delete ${field.label}`}
                  >
                    <FaTrash className="w-4 h-4 text-gray-500" />
                  </button>
                </Tooltip>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default StepForm; 