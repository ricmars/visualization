import React, { useState, useEffect, JSX, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaClipboardList,
  FaCheckCircle,
  FaRobot,
  FaFolder,
  FaQuestionCircle,
} from "react-icons/fa";
import { IoDocumentText } from "react-icons/io5";
import { RiBrainFill } from "react-icons/ri";
import { MdNotifications } from "react-icons/md";
import { BsGearFill } from "react-icons/bs";
import { StepType } from "../types";

interface AddStepModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddStep: (stepData: { name: string; type: StepType }) => void;
}

export interface StepTypeOption {
  type: StepType;
  icon: JSX.Element;
  color: string;
}

export const stepTypes: StepTypeOption[] = [
  {
    type: "Collect information",
    icon: <FaClipboardList />,
    color: "text-blue-500",
  },
  {
    type: "Approve/Reject",
    icon: <FaCheckCircle />,
    color: "text-green-500",
  },
  {
    type: "Automation",
    icon: <BsGearFill />,
    color: "text-purple-500",
  },
  {
    type: "Create Case",
    icon: <FaFolder />,
    color: "text-yellow-500",
  },
  {
    type: "Decision",
    icon: <FaQuestionCircle />,
    color: "text-orange-500",
  },
  {
    type: "Generate Document",
    icon: <IoDocumentText />,
    color: "text-gray-500",
  },
  {
    type: "Generative AI",
    icon: <RiBrainFill />,
    color: "text-pink-500",
  },
  {
    type: "Robotic Automation",
    icon: <FaRobot />,
    color: "text-indigo-500",
  },
  {
    type: "Send Notification",
    icon: <MdNotifications />,
    color: "text-red-500",
  },
];

const AddStepModal: React.FC<AddStepModalProps> = ({
  isOpen,
  onClose,
  onAddStep,
}) => {
  const [name, setName] = useState("");
  const [type, setType] = useState(stepTypes[0].type);
  const [error, setError] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 100);
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  const handleSubmit = () => {
    if (!name.trim()) {
      setError("Step name is required");
      return;
    }
    onAddStep({ name: name.trim(), type });
    setName("");
    setType(stepTypes[0].type);
    setError("");
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === "Tab") {
      const focusableElements = modalRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );

      if (!focusableElements) return;

      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[
        focusableElements.length - 1
      ] as HTMLElement;

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            ref={modalRef}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6"
            onKeyDown={handleKeyDown}
            tabIndex={-1}
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
                    value={type}
                    onChange={(e) => setType(e.target.value as StepType)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-colors"
                  >
                    {stepTypes.map((stepType) => (
                      <option
                        key={stepType.type}
                        value={stepType.type}
                        className="flex items-center gap-2 py-2"
                      >
                        {stepType.type}
                      </option>
                    ))}
                  </select>
                  <div className="mt-2 p-2 border border-gray-200 dark:border-gray-600 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xl ${
                          stepTypes.find((st) => st.type === type)?.color
                        }`}
                      >
                        {stepTypes.find((st) => st.type === type)?.icon}
                      </span>
                      <span className="text-sm text-gray-600 dark:text-gray-300">
                        Selected: {type}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleSubmit}
                  className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                >
                  Add Step
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default AddStepModal;
