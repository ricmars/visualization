import React from 'react';
import { Field } from '../types';
import { FaTrash, FaPencilAlt, FaGripVertical } from 'react-icons/fa';
import Tooltip from './Tooltip';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

interface StepFormProps {
  fields: Field[];
  onFieldChange: (fieldId: string, value: string | number | boolean) => void;
  onDeleteField?: (fieldId: string) => void;
  onEditField?: (field: Field) => void;
  onReorderFields?: (startIndex: number, endIndex: number) => void;
}

const StepForm: React.FC<StepFormProps> = ({
  fields,
  onFieldChange: _onFieldChange,
  onDeleteField,
  onEditField,
  onReorderFields
}) => {
  const handleDragEnd = (result: DropResult) => {
    if (!result.destination || !onReorderFields) return;
    onReorderFields(result.source.index, result.destination.index);
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Droppable droppableId="fields" direction="vertical">
        {(provided, snapshot) => (
          <div 
            className={`space-y-2 relative ${snapshot.isDraggingOver ? 'bg-blue-50/50 dark:bg-blue-900/10 rounded-lg' : ''}`}
            {...provided.droppableProps} 
            ref={provided.innerRef}
          >
            {fields.map((field, index) => (
              <Draggable 
                key={field.id} 
                draggableId={field.id} 
                index={index}
              >
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    style={{
                      ...provided.draggableProps.style,
                      position: snapshot.isDragging ? 'absolute' : 'relative',
                      zIndex: snapshot.isDragging ? 9999 : 'auto',
                    }}
                    className={`relative group p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 ${
                      snapshot.isDragging ? 'shadow-lg ring-2 ring-blue-500 ring-opacity-50' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1">
                        <div
                          {...provided.dragHandleProps}
                          className="cursor-grab active:cursor-grabbing p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                        >
                          <FaGripVertical className="w-4 h-4 text-gray-400" />
                        </div>
                        <div className="flex-1">
                          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                            {field.label}
                            {field.required && <span className="text-red-500">*</span>}
                            {field.isPrimary && (
                              <span className="px-1.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 rounded">
                                Primary
                              </span>
                            )}
                            <span className="text-xs text-gray-500 dark:text-gray-400 font-normal">
                              ({field.type})
                            </span>
                          </h4>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {onEditField && (
                          <Tooltip content={`Edit ${field.label}`}>
                            <button
                              onClick={() => onEditField(field)}
                              className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-all focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                              aria-label={`Edit ${field.label}`}
                            >
                              <FaPencilAlt className="w-3.5 h-3.5 text-gray-500" />
                            </button>
                          </Tooltip>
                        )}
                        {onDeleteField && (
                          <Tooltip content={`Delete ${field.label}`}>
                            <button
                              onClick={() => onDeleteField(field.id)}
                              className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-all focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                              aria-label={`Delete ${field.label}`}
                            >
                              <FaTrash className="w-3.5 h-3.5 text-gray-500" />
                            </button>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
};

export default StepForm; 