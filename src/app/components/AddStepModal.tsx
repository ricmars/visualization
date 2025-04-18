import React, { useState, useEffect, useRef } from "react";
import { StepType } from "../types";

interface AddStepModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddStep: (data: { name: string; type: StepType }) => void;
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
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        {children}
      </div>
    </>
  );
};

const AddStepModal: React.FC<AddStepModalProps> = ({
  isOpen,
  onClose,
  onAddStep,
}) => {
  const [name, setName] = useState("");
  const [stepType, setStepType] = useState<StepType>("Collect information");
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onAddStep({
      name: name.trim(),
      type: stepType,
    });

    setName("");
    setStepType("Collect information");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Add New Step
          </h3>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Step Name
                </label>
                <input
                  ref={nameInputRef}
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter step name"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Step Type
                </label>
                <select
                  value={stepType}
                  onChange={(e) => setStepType(e.target.value as StepType)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-colors"
                >
                  <option value="Collect information">
                    Collect Information
                  </option>
                  <option value="Approve/Reject">Approve/Reject</option>
                  <option value="Automation">Automation</option>
                  <option value="Create Case">Create Case</option>
                  <option value="Decision">Decision</option>
                  <option value="Generate Document">Generate Document</option>
                  <option value="Generative AI">Generative AI</option>
                  <option value="Robotic Automation">Robotic Automation</option>
                  <option value="Send Notification">Send Notification</option>
                </select>
              </div>
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
                Add Step
              </button>
            </div>
          </form>
        </div>
      </div>
    </Modal>
  );
};

export default AddStepModal;
