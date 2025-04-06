import React, { useState, useMemo } from "react";
import { Stage, Field, FieldReference } from "../types";
import { getFieldTypeDisplayName } from "../utils/fieldTypes";

interface ViewsPanelProps {
  stages: Stage[];
  fields: Field[];
}

interface CollectStep {
  name: string;
  stageName: string;
  fields: FieldReference[];
}

const ViewsPanel: React.FC<ViewsPanelProps> = ({ stages, fields }) => {
  const [selectedView, setSelectedView] = useState<string | null>(null);

  // Get all steps of type 'Collect information' and sort them alphabetically
  const collectSteps = useMemo(() => {
    const steps: CollectStep[] = [];
    stages.forEach((stage) => {
      stage.steps.forEach((step) => {
        if (step.type === "Collect information") {
          steps.push({
            name: step.name,
            stageName: stage.name,
            fields: step.fields || [],
          });
        }
      });
    });
    return steps.sort((a, b) => a.name.localeCompare(b.name));
  }, [stages]);

  // Get the fields for the selected view
  const selectedViewFields = useMemo(() => {
    if (!selectedView) return [];
    const step = collectSteps.find((s) => s.name === selectedView);
    if (!step) return [];

    return step.fields
      .map((fieldRef) => {
        const field = fields.find((f) => f.name === fieldRef.name);
        return field ? { ...field, ...fieldRef } : null;
      })
      .filter((f): f is Field => f !== null);
  }, [selectedView, collectSteps, fields]);

  return (
    <div className="flex h-full">
      {/* Master View - List of Collect Information Steps */}
      <div className="w-1/3 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
        <div className="p-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
            Views
          </h3>
          <div className="space-y-2">
            {collectSteps.map((step) => (
              <button
                key={step.name}
                onClick={() => setSelectedView(step.name)}
                className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                  selectedView === step.name
                    ? "bg-blue-50 dark:bg-blue-900/20 border-blue-500"
                    : "hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}
              >
                <div className="font-medium text-gray-900 dark:text-gray-100">
                  {step.name}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {step.stageName}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Detail View - Fields List */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          {selectedView ? (
            <>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
                {selectedView} Fields
              </h3>
              <div className="space-y-4">
                {selectedViewFields.map((field) => (
                  <div
                    key={field.name}
                    className="p-4 rounded-lg border border-gray-200 dark:border-gray-700"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-gray-900 dark:text-gray-100">
                          {field.label}
                        </h4>
                        {field.primary && (
                          <span className="px-1.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 rounded">
                            Primary
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Type: {getFieldTypeDisplayName(field.type)}
                    </p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center text-gray-500 dark:text-gray-400 mt-8">
              Select a view to see its fields
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ViewsPanel;
