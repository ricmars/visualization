import React, { useEffect, useState } from "react";

interface Field {
  id: string;
  type: string;
  name: string;
}

interface View {
  id: string;
  name: string;
  model: string;
}

const DatabasePanel: React.FC = () => {
  const [fields, setFields] = useState<Field[]>([]);
  const [views, setViews] = useState<View[]>([]);
  const [activeTable, setActiveTable] = useState<"fields" | "views">("fields");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch data for both tables in parallel
        const [fieldsResponse, viewsResponse] = await Promise.all([
          fetch("/api/database?table=fields"),
          fetch("/api/database?table=views"),
        ]);

        if (!fieldsResponse.ok || !viewsResponse.ok) {
          throw new Error("Failed to fetch data");
        }

        const fieldsData = await fieldsResponse.json();
        const viewsData = await viewsResponse.json();

        setFields(fieldsData.data);
        setViews(viewsData.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <div className="flex h-full">
      {/* Table Selection Sidebar */}
      <div className="w-1/4 border-r border-gray-200 dark:border-gray-700 p-4">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
          Tables
        </h3>
        <div className="space-y-2">
          <button
            onClick={() => setActiveTable("fields")}
            className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
              activeTable === "fields"
                ? "bg-blue-50 dark:bg-blue-900/20 border-blue-500"
                : "hover:bg-gray-50 dark:hover:bg-gray-800"
            }`}
          >
            Fields
          </button>
          <button
            onClick={() => setActiveTable("views")}
            className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
              activeTable === "views"
                ? "bg-blue-50 dark:bg-blue-900/20 border-blue-500"
                : "hover:bg-gray-50 dark:hover:bg-gray-800"
            }`}
          >
            Views
          </button>
        </div>
      </div>

      {/* Table Content */}
      <div className="flex-1 p-6">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : error ? (
          <div className="text-red-500 dark:text-red-400">{error}</div>
        ) : (
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">
              {activeTable === "fields" ? "Fields" : "Views"}
            </h2>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead>
                  <tr>
                    <th className="px-6 py-3 bg-gray-50 dark:bg-gray-800 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      ID
                    </th>
                    {activeTable === "fields" ? (
                      <>
                        <th className="px-6 py-3 bg-gray-50 dark:bg-gray-800 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Type
                        </th>
                        <th className="px-6 py-3 bg-gray-50 dark:bg-gray-800 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Name
                        </th>
                      </>
                    ) : (
                      <>
                        <th className="px-6 py-3 bg-gray-50 dark:bg-gray-800 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Name
                        </th>
                        <th className="px-6 py-3 bg-gray-50 dark:bg-gray-800 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Model
                        </th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                  {activeTable === "fields"
                    ? fields.map((field) => (
                        <tr key={field.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                            {field.id}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                            {field.type}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                            {field.name}
                          </td>
                        </tr>
                      ))
                    : views.map((view) => (
                        <tr key={view.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                            {view.id}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                            {view.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                            {view.model}
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DatabasePanel;
