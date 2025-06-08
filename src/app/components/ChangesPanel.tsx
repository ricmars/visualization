import { Checkpoint } from "../types";

interface ChangesPanelProps {
  checkpoints: Checkpoint[];
  onRestoreCheckpoint: (checkpoint: Checkpoint) => void;
  onClearCheckpoints: () => void;
}

export default function ChangesPanel({
  checkpoints,
  onRestoreCheckpoint,
  onClearCheckpoints,
}: ChangesPanelProps) {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Changes History
        </h2>
        {checkpoints.length > 0 && (
          <button
            onClick={onClearCheckpoints}
            className="px-3 py-1 text-sm text-gray-600 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 rounded-lg ring-1 ring-gray-200 dark:ring-gray-700 hover:ring-red-200 dark:hover:ring-red-800 focus:outline-none focus:ring-2 focus:ring-red-500 dark:focus:ring-red-500 active:bg-red-50 dark:active:bg-red-900/20 transition-colors"
          >
            Clear All
          </button>
        )}
      </div>
      <div className="space-y-4">
        {checkpoints.map((checkpoint) => (
          <div
            key={checkpoint.id}
            className="p-4 rounded-lg border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {new Date(checkpoint.timestamp).toLocaleString()}
                </p>
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  {checkpoint.description}
                </p>
              </div>
              <button
                onClick={() => onRestoreCheckpoint(checkpoint)}
                className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
              >
                Restore
              </button>
            </div>
          </div>
        ))}
        {checkpoints.length === 0 && (
          <p className="text-center text-gray-500 dark:text-gray-400">
            No changes have been made yet.
          </p>
        )}
      </div>
    </div>
  );
}
