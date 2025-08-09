import React from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
  DroppableProvided,
  DraggableProvided,
} from "@hello-pangea/dnd";
import { FaGripVertical, FaTrash, FaPencilAlt } from "react-icons/fa";
import { Field } from "../types";
import { getFieldTypeDisplayName } from "../utils/fieldTypes";

interface FieldsListProps {
  fields: Field[];
  onDeleteField: (field: Field) => void;
  onReorderFields: (startIndex: number, endIndex: number) => void;
  onEditField: (field: Field) => void;
}

const FieldsList: React.FC<FieldsListProps> = ({
  fields,
  onDeleteField,
  onReorderFields,
  onEditField,
}) => {
  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;

    if (sourceIndex !== destinationIndex) {
      onReorderFields(sourceIndex, destinationIndex);
    }
  };

  return (
    <div className="space-y-2">
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="fields-list">
          {(provided: DroppableProvided) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="space-y-1"
            >
              {fields.map((field, index) => (
                <Draggable
                  key={`field-${field.id ?? field.name}`}
                  draggableId={`field-${field.id ?? field.name}`}
                  index={index}
                >
                  {(provided: DraggableProvided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className="flex items-center space-x-3 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:shadow-md transition-shadow"
                      data-fieldid={field.id}
                    >
                      <div
                        {...provided.dragHandleProps}
                        className="flex items-center justify-center w-6 h-6 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-grab active:cursor-grabbing"
                      >
                        <FaGripVertical className="w-4 h-4" />
                      </div>
                      <div className="flex-grow min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
                            {field.label}
                          </div>
                          {field.primary && (
                            <span className="px-1.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 rounded">
                              Primary
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          Type: {getFieldTypeDisplayName(field.type as any)}
                        </div>
                      </div>
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => onEditField(field)}
                          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                          title="Edit field"
                        >
                          <FaPencilAlt className="w-4 h-4 text-blue-500" />
                        </button>
                        <button
                          onClick={() => onDeleteField(field)}
                          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                          title="Delete field"
                        >
                          <FaTrash className="w-4 h-4 text-red-500" />
                        </button>
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
    </div>
  );
};

export default FieldsList;
