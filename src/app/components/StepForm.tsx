import React from 'react';

interface Field {
  id: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'checkbox';
  value?: any;
  options?: string[];
}

interface StepFormProps {
  fields: Field[];
  onFieldChange: (fieldId: string, value: any) => void;
}

export const StepForm: React.FC<StepFormProps> = ({ fields, onFieldChange }) => {
  const renderField = (field: Field) => {
    switch (field.type) {
      case 'text':
        return (
          <input
            type="text"
            value={field.value || ''}
            onChange={(e) => onFieldChange(field.id, e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-700"
          />
        );
      case 'number':
        return (
          <input
            type="number"
            value={field.value || ''}
            onChange={(e) => onFieldChange(field.id, e.target.valueAsNumber)}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-700"
          />
        );
      case 'select':
        return (
          <select
            value={field.value || ''}
            onChange={(e) => onFieldChange(field.id, e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-700"
          >
            <option value="">Select an option</option>
            {field.options?.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        );
      case 'checkbox':
        return (
          <input
            type="checkbox"
            checked={field.value || false}
            onChange={(e) => onFieldChange(field.id, e.target.checked)}
            className="w-5 h-5 border rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-700"
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {fields.map((field) => (
        <div key={field.id} className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {field.label}
          </label>
          {renderField(field)}
        </div>
      ))}
    </div>
  );
}; 