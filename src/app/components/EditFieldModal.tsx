import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Field } from "../types";
import Tooltip from "./Tooltip";
import { getAllFieldTypes, getFieldTypeDisplayName } from "../utils/fieldTypes";

interface EditFieldModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (updates: Partial<Field>) => void;
  field: Field;
}

const EditFieldModal: React.FC<EditFieldModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  field,
}) => {
  const [label, setLabel] = useState(field.label);
  const [type, setType] = useState(field.type);
  const [isPrimary, setIsPrimary] = useState(field.primary || false);
  const [isRequired, setIsRequired] = useState(field.required || false);
  const [options, setOptions] = useState("");
  const [sampleValue, setSampleValue] = useState<string>("");
  const [error, setError] = useState("");
  const modalRef = useRef<HTMLDivElement>(null);
  const labelInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      setTimeout(() => {
        labelInputRef.current?.focus();
      }, 100);
      // Set initial values when modal opens
      setLabel(field.label);
      setType(field.type);
      setIsPrimary(field.primary || false);
      setIsRequired(field.required || false);
      // Parse options from field.options (could be string or array)
      const parsedOptions = field.options
        ? Array.isArray(field.options)
          ? field.options
          : (() => {
              try {
                return JSON.parse(field.options);
              } catch {
                return [];
              }
            })()
        : [];
      setOptions(parsedOptions.join(", "));
      // Initialize sample value as string for editing
      const dv: any = (field as any).sampleValue;
      if (dv === null || dv === undefined) {
        setSampleValue("");
      } else if (typeof dv === "string") {
        setSampleValue(dv);
      } else {
        try {
          setSampleValue(JSON.stringify(dv));
        } catch {
          setSampleValue(String(dv));
        }
      }
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen, field]);

  const handleSubmit = () => {
    if (!label.trim()) {
      setError("Field label is required");
      return;
    }
    const parsedOptions = options.trim()
      ? options
          .split(",")
          .map((opt) => opt.trim())
          .filter((opt) => opt.length > 0)
      : [];
    onSubmit({
      name: field.name,
      label: label.trim(),
      type,
      primary: isPrimary,
      required: isRequired,
      options: parsedOptions,
      sampleValue: sampleValue,
    });
    setError("");
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
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
            className="absolute inset-0 bg-black/50 backdrop-blur-sm z-40"
            onClick={onClose}
          />
          <motion.div
            ref={modalRef}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 z-50"
            onKeyDown={handleKeyDown}
            tabIndex={-1}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Edit Field
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
                    Field Label
                  </label>
                  <input
                    ref={labelInputRef}
                    type="text"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="Enter field label"
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Field Type
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as Field["type"])}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-colors"
                  >
                    {getAllFieldTypes().map((fieldType) => (
                      <option key={fieldType} value={fieldType}>
                        {getFieldTypeDisplayName(fieldType as any)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isPrimary"
                    checked={isPrimary}
                    onChange={(e) => setIsPrimary(e.target.checked)}
                    className="rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                  />
                  <label
                    htmlFor="isPrimary"
                    className="text-sm text-gray-700 dark:text-gray-300"
                  >
                    Primary Field
                  </label>
                  <Tooltip content="Primary fields are used as identifiers and are displayed prominently in the workflow">
                    <span className="text-gray-400 hover:text-gray-500 cursor-help">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </span>
                  </Tooltip>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isRequired"
                    checked={isRequired}
                    onChange={(e) => setIsRequired(e.target.checked)}
                    className="rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                  />
                  <label
                    htmlFor="isRequired"
                    className="text-sm text-gray-700 dark:text-gray-300"
                  >
                    Required Field
                  </label>
                  <Tooltip content="Required fields must be filled out before proceeding">
                    <span className="text-gray-400 hover:text-gray-500 cursor-help">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </span>
                  </Tooltip>
                </div>

                {(type === "Dropdown" ||
                  type === "RadioButtons" ||
                  type === "Status" ||
                  type === "ReferenceValues") && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Options (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={options}
                      onChange={(e) => setOptions(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-colors"
                      placeholder="Option 1, Option 2, Option 3"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Sample value
                  </label>
                  <input
                    type="text"
                    value={sampleValue}
                    onChange={(e) => setSampleValue(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-colors"
                    placeholder="Enter sample value"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <Tooltip content="Cancel editing">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                  >
                    Cancel
                  </button>
                </Tooltip>
                <Tooltip content="Save changes">
                  <button
                    onClick={handleSubmit}
                    className="px-4 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                  >
                    Save Changes
                  </button>
                </Tooltip>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default EditFieldModal;
