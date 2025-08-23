"use client";

import React, { RefObject } from "react";

type FieldsHeaderProps = {
  onAddField: () => void;
  buttonRef?: RefObject<HTMLButtonElement>;
  count: number;
};

export default function FieldsHeader({
  onAddField,
  buttonRef,
  count,
}: FieldsHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center">
        Fields{" "}
        <span className="ml-2 font-normal text-gray-500 dark:text-gray-400">
          ({count})
        </span>
      </h2>
      <button
        ref={buttonRef}
        onClick={onAddField}
        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
      >
        Add Field
      </button>
    </div>
  );
}
