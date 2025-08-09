import { useState } from "react";

interface CreateWorkflowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, description: string) => Promise<void>;
  isCreating: boolean;
  creationProgress?: string;
  creationError?: string | null;
}

/**
 * Modal component for creating a new workflow
 * @param isOpen - Whether the modal is open
 * @param onClose - Function to call when the modal should close
 * @param onCreate - Function to call when the form is submitted
 * @param isCreating - Whether a workflow is currently being created
 */
export const CreateWorkflowModal: React.FC<CreateWorkflowModalProps> = ({
  isOpen,
  onClose,
  onCreate,
  isCreating,
  creationProgress,
  creationError,
}) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    if (!name.trim() || !description.trim()) {
      setError("Name and description are required.");
      setIsSubmitting(false);
      return;
    }
    try {
      const trimmedDescription = description.trim().slice(0, 500);
      await onCreate(name.trim(), trimmedDescription);
      // Don't close the modal here - let the parent component handle it
      // The modal will be closed when navigation happens or on error
    } catch (_error) {
      setIsSubmitting(false);
      return;
    }
    // Reset form only on success
    setName("");
    setDescription("");
  };

  const handleDescriptionChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    const value = e.target.value;
    if (value.length <= 500) {
      setDescription(value);
    }
  };

  if (!isOpen) return null;

  const remainingChars = 500 - description.length;

  return (
    <div
      className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50"
      onClick={isCreating ? undefined : onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit} className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            Create new workflow
          </h2>
          <div className="space-y-4">
            {creationError && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <div className="flex items-center mb-2">
                  <span className="text-sm font-medium text-red-800">
                    Error creating workflow
                  </span>
                </div>
                <div className="text-sm text-red-700">{creationError}</div>
              </div>
            )}
            {isCreating && creationProgress && (
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <div className="flex items-center mb-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent mr-2"></div>
                  <span className="text-sm font-medium text-blue-800">
                    Creating workflow...
                  </span>
                </div>
                <div className="text-sm text-blue-700 whitespace-pre-line max-h-32 overflow-y-auto">
                  {creationProgress}
                </div>
              </div>
            )}
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-gray-700"
              >
                Name
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
                disabled={isSubmitting || isCreating}
              />
            </div>
            <div>
              <label
                htmlFor="description"
                className="block text-sm font-medium text-gray-700"
              >
                Description
              </label>
              <div className="mt-1 relative">
                <textarea
                  id="description"
                  value={description}
                  onChange={handleDescriptionChange}
                  rows={3}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                  disabled={isSubmitting || isCreating}
                />
                <div className="absolute right-2 text-sm text-gray-500">
                  {remainingChars} characters remaining
                </div>
              </div>
            </div>
          </div>
          <div className="mt-6 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              disabled={isSubmitting || isCreating}
            >
              {isCreating ? "Creating..." : "Cancel"}
            </button>
            <button
              type="submit"
              disabled={
                isSubmitting ||
                isCreating ||
                !name.trim() ||
                !description.trim()
              }
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
            >
              {(isSubmitting || isCreating) && (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
              )}
              <span>
                {isCreating
                  ? "Creating workflow..."
                  : isSubmitting
                  ? "Creating..."
                  : "Create"}
              </span>
            </button>
          </div>
          {error && <div className="text-red-500 text-sm mt-2">{error}</div>}
        </form>
      </div>
    </div>
  );
};
