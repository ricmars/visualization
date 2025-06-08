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

interface StepFormProps {
  fields: Field[];
  onDeleteField: (field: Field) => void;
  onReorderFields: (startIndex: number, endIndex: number) => void;
  onEditField: (field: Field) => void;
}

const StepForm: React.FC<StepFormProps> = ({
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
    <div className="space-y-4">
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="step-fields">
          {(provided: DroppableProvided) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="space-y-2"
            >
              {fields.map((field, index) => (
                <Draggable
                  key={`field-${field.name}`}
                  draggableId={`field-${field.name}`}
                  index={index}
                >
                  {(provided: DraggableProvided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className="flex items-center space-x-2 p-2 bg-white border rounded-lg"
                    >
                      <div {...provided.dragHandleProps}>
                        <FaGripVertical className="text-gray-400" />
                      </div>
                      <span className="flex-grow">{field.name}</span>
                      <button
                        onClick={() => onEditField(field)}
                        className="p-1 hover:bg-gray-100 rounded"
                      >
                        <FaPencilAlt className="text-blue-500" />
                      </button>
                      <button
                        onClick={() => onDeleteField(field)}
                        className="p-1 hover:bg-gray-100 rounded"
                      >
                        <FaTrash className="text-red-500" />
                      </button>
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

export default StepForm;
