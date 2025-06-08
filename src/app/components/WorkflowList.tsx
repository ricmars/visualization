import { Case } from "@/app/types";
import { FaTrash } from "react-icons/fa";

interface WorkflowListProps {
  cases: Case[] | undefined;
  onDelete: (name: string) => void;
  onSelect: (workflow: Case) => void;
}

/**
 * Component for displaying a list of workflows
 * @param cases - Array of workflow cases to display
 * @param onDelete - Function to call when a workflow is deleted
 * @param onSelect - Function to call when a workflow is selected
 */
export default function WorkflowList({
  cases,
  onDelete,
  onSelect,
}: WorkflowListProps) {
  if (!cases) {
    return (
      <div className="text-center text-gray-500 py-8">Loading workflows...</div>
    );
  }

  if (cases.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        No workflows found. Create your first workflow to get started.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {cases.map((workflow) => (
        <div
          key={workflow.name}
          className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
        >
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {workflow.name}
            </h3>
            <button
              onClick={() => onDelete(workflow.name)}
              className="text-gray-400 hover:text-red-500 transition-colors"
              aria-label="Delete workflow"
            >
              <FaTrash />
            </button>
          </div>
          <p className="text-gray-600 mb-4 line-clamp-2">
            {workflow.description || "No description provided"}
          </p>
          <button
            onClick={() => onSelect(workflow)}
            className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
          >
            Open Workflow
          </button>
        </div>
      ))}
    </div>
  );
}
