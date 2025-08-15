import React, { useState } from "react";
import { StepType } from "../utils/stepTypes";
import { motion, AnimatePresence } from "framer-motion";
import { getAllStepTypes, getStepTypeDisplayName } from "../utils/stepTypes";

interface AddStepModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddStep: (
    stageId: number,
    processId: number,
    stepName: string,
    stepType: StepType,
  ) => void;
  stageId: number;
  processId: number;
}

const AddStepModal: React.FC<AddStepModalProps> = ({
  isOpen,
  onClose,
  onAddStep,
  stageId,
  processId,
}) => {
  const [stepName, setStepName] = useState("");
  const [stepType, setStepType] = useState<StepType>("Collect information");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    console.log("AddStepModal handleSubmit:", { stepName, stepType });
    if (!stepName.trim()) {
      setError("Step name is required");
      return;
    }
    onAddStep(stageId, processId, stepName.trim(), stepType);
    setStepName("");
    setStepType("Collect information");
    setError(null);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm z-[80] modal-overlay"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 z-[90]"
            role="dialog"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Add New Step
                </h3>
                <button
                  onClick={onClose}
                  className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                  aria-label="Close modal"
                >
                  <svg
                    className="w-5 h-5 text-gray-500 dark:text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
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

              {error && <p className="text-sm text-red-500">{error}</p>}

              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="stepName"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Step Name
                  </label>
                  <input
                    type="text"
                    id="stepName"
                    value={stepName}
                    onChange={(e) => setStepName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-colors"
                    placeholder="Enter step name"
                  />
                </div>

                <div>
                  <label
                    htmlFor="stepType"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Step Type
                  </label>
                  <select
                    id="stepType"
                    value={stepType}
                    onChange={(e) => setStepType(e.target.value as StepType)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-colors"
                  >
                    {getAllStepTypes().map((type) => (
                      <option key={type} value={type}>
                        {getStepTypeDisplayName(type)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={handleSubmit}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                  >
                    Add Step
                  </button>
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default AddStepModal;
