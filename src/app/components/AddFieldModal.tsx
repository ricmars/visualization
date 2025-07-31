import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Field } from "../types";
import Tooltip from "./Tooltip";
import { getAllFieldTypes, getFieldTypeDisplayName } from "../utils/fieldTypes";

interface AddFieldModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddField: (field: {
    label: string;
    type: Field["type"];
    options?: string[];
    required: boolean;
    primary?: boolean;
  }) => void;
  buttonRef?: React.RefObject<HTMLButtonElement>;
  existingFields?: Field[];
  stepFieldIds?: string[];
  onAddExistingField?: (fieldIds: string[]) => void;
  allowExistingFields?: boolean;
}

const AddFieldModal: React.FC<AddFieldModalProps> = ({
  isOpen,
  onClose,
  onAddField,
  buttonRef,
  existingFields = [],
  stepFieldIds = [],
  onAddExistingField,
  allowExistingFields = true,
}) => {
  const [mode, setMode] = useState<"new" | "existing">(
    allowExistingFields ? "existing" : "new",
  );
  const [label, setLabel] = useState("");
  const [type, setType] = useState<Field["type"]>("Text");
  const [required, setRequired] = useState(false);
  const [isPrimary, setIsPrimary] = useState(false);
  const [selectedFieldIds, setSelectedFieldIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const labelInputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Filter out fields that are already in the step
  const availableFields = existingFields.filter(
    (field) => !stepFieldIds.includes(field.id?.toString() || ""),
  );

  useEffect(() => {
    if (isOpen && buttonRef?.current) {
      const buttonRect = buttonRef.current.getBoundingClientRect();
      setPosition({
        top: buttonRect.bottom + 8,
        left: buttonRect.left,
      });

      // Set focus on label input when overlay opens
      setTimeout(() => {
        if (mode === "new") {
          labelInputRef.current?.focus();
        }
      }, 100);
    }
  }, [isOpen, buttonRef, mode]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        overlayRef.current &&
        !overlayRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  const handleSubmit = () => {
    if (mode === "existing") {
      if (selectedFieldIds.length === 0) {
        setError("Please select at least one field");
        return;
      }
      if (onAddExistingField) {
        onAddExistingField(selectedFieldIds);
      }
    } else {
      if (!label.trim()) {
        setError("Label is required");
        return;
      }
      onAddField({ label, type, required, primary: isPrimary });
    }
    setLabel("");
    setType("Text");
    setRequired(false);
    setIsPrimary(false);
    setSelectedFieldIds([]);
    setError("");
    onClose();
  };

  const toggleFieldSelection = (fieldId: string) => {
    setSelectedFieldIds((prev: string[]) =>
      prev.includes(fieldId)
        ? prev.filter((id: string) => id !== fieldId)
        : [...prev, fieldId],
    );
    setError("");
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
        <motion.div
          ref={overlayRef}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          style={{
            position: "fixed",
            top: position.top,
            left: position.left,
            zIndex: 1000,
          }}
          className="w-96 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700"
          onKeyDown={handleKeyDown}
        >
          <div className="p-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Add Field
                </h3>
              </div>

              <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-700 rounded-lg">
                {allowExistingFields && (
                  <button
                    onClick={() => setMode("existing")}
                    className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      mode === "existing"
                        ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm"
                        : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                    }`}
                  >
                    Select Existing
                  </button>
                )}
                <button
                  onClick={() => setMode("new")}
                  className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    mode === "new"
                      ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm"
                      : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                  }`}
                >
                  Add New
                </button>
              </div>

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-1 text-sm text-red-500"
                >
                  {error}
                </motion.p>
              )}

              <div className="space-y-4">
                {mode === "existing" ? (
                  <div>
                    {availableFields.length === 0 ? (
                      <div className="text-center py-4">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          No available fields to add.
                        </p>
                        <button
                          onClick={() => setMode("new")}
                          className="mt-2 text-sm text-blue-500 hover:text-blue-600 dark:hover:text-blue-400"
                        >
                          Create a new field instead
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {availableFields
                          .sort((a, b) => a.label.localeCompare(b.label))
                          .map((field) => (
                            <label
                              key={field.id.toString()}
                              className={`flex items-center p-3 rounded-lg border ${
                                selectedFieldIds.includes(
                                  field.id?.toString() || "",
                                )
                                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                                  : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                              } cursor-pointer transition-colors`}
                            >
                              <input
                                type="checkbox"
                                checked={selectedFieldIds.includes(
                                  field.id?.toString() || "",
                                )}
                                onChange={() =>
                                  toggleFieldSelection(
                                    field.id?.toString() || "",
                                  )
                                }
                                className="rounded border-gray-300 text-blue-500 focus:ring-blue-500 mr-3"
                              />
                              <div className="flex-1">
                                <div className="font-medium text-gray-900 dark:text-gray-100">
                                  {field.label}
                                </div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                  Type:{" "}
                                  {getFieldTypeDisplayName(field.type as any)}
                                </div>
                              </div>
                            </label>
                          ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Label
                      </label>
                      <input
                        ref={labelInputRef}
                        type="text"
                        value={label}
                        onChange={(e) => {
                          setLabel(e.target.value);
                          setError("");
                        }}
                        className={`w-full px-3 py-2 rounded-lg border ${
                          error
                            ? "border-red-500 focus:ring-red-500"
                            : "border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                        } focus:outline-none focus:ring-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-colors`}
                        placeholder="Enter field label"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Type
                      </label>
                      <select
                        value={type}
                        onChange={(e) =>
                          setType(e.target.value as Field["type"])
                        }
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
                        id="required"
                        checked={required}
                        onChange={(e) => setRequired(e.target.checked)}
                        className="rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                      />
                      <label
                        htmlFor="required"
                        className="text-sm text-gray-700 dark:text-gray-300"
                      >
                        Required
                      </label>
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
                  </>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleSubmit}
                  className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                >
                  {mode === "existing"
                    ? `Add Selected Field${
                        selectedFieldIds.length !== 1 ? "s" : ""
                      } (${selectedFieldIds.length})`
                    : "Add New Field"}
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AddFieldModal;
