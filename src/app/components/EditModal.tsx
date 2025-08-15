import React, { useEffect, useRef, useState } from "react";
import { StepType } from "../utils/stepTypes";
import { getAllStepTypes, getStepTypeDisplayName } from "../utils/stepTypes";

interface EditModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: "stage" | "process" | "step";
  name: string;
  stepType?: StepType;
  onSubmit: (data: { name: string; type?: StepType; fields?: never[] }) => void;
}

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children }) => {
  if (!isOpen) return null;

  return (
    <>
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm z-[80] modal-overlay"
        onClick={onClose}
      />
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[90]"
        role="dialog"
      >
        {children}
      </div>
    </>
  );
};

const EditModal: React.FC<EditModalProps> = ({
  isOpen,
  onClose,
  type,
  name,
  stepType,
  onSubmit,
}) => {
  const [editedName, setEditedName] = useState(name);
  const [editedType, setEditedType] = useState<StepType>(
    stepType || "Collect information",
  );
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editedName.trim()) return;

    // If changing from "Collect information" to another type, submit with empty fields array
    if (
      type === "step" &&
      stepType === "Collect information" &&
      editedType !== "Collect information"
    ) {
      onSubmit({
        name: editedName.trim(),
        type: editedType,
        fields: [], // This will signal to the parent to remove all fields
      });
    } else {
      onSubmit({
        name: editedName.trim(),
        type: editedType,
      });
    }
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Edit{" "}
            {type === "stage"
              ? "Stage"
              : type === "process"
              ? "Process"
              : "Step"}
          </h3>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {type === "stage"
                    ? "Stage"
                    : type === "process"
                    ? "Process"
                    : "Step"}{" "}
                  Name
                </label>
                <input
                  ref={nameInputRef}
                  type="text"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  placeholder={`Enter ${type} name`}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-colors"
                />
              </div>

              {type === "step" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Step Type
                  </label>
                  <select
                    value={editedType}
                    onChange={(e) => setEditedType(e.target.value as StepType)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-colors"
                  >
                    {getAllStepTypes().map((type) => (
                      <option key={type} value={type}>
                        {getStepTypeDisplayName(type)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      </div>
    </Modal>
  );
};

export default EditModal;
