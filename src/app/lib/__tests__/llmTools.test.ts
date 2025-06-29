import { getDatabaseTools } from "../llmTools";
import { Pool } from "pg";

// Mock the database types
jest.mock("../../types/database", () => ({
  DB_TABLES: {
    CASES: "Cases",
    FIELDS: "Fields",
    VIEWS: "Views",
  },
  validateFieldType: jest.fn().mockReturnValue(true),
  FIELD_TYPES: {
    TEXT: "text",
    DATE: "date",
    BOOLEAN: "boolean",
  },
}));

describe("llmTools", () => {
  let mockQuery: jest.Mock;
  let databaseTools: ReturnType<typeof getDatabaseTools>;

  beforeEach(() => {
    mockQuery = jest.fn();
    const mockPool = { query: mockQuery } as unknown as Pool;
    databaseTools = getDatabaseTools(mockPool);
    jest.clearAllMocks();
  });

  describe("saveCase", () => {
    it("should create a new case successfully", async () => {
      const mockResult = {
        rows: [
          {
            id: 1,
            name: "Test Case",
            description: "Test Description",
            model: '{"stages":[]}',
          },
        ],
        rowCount: 1,
      };
      mockQuery.mockResolvedValueOnce(mockResult);

      const saveCaseTool = databaseTools.find(
        (tool) => tool.name === "saveCase",
      );
      expect(saveCaseTool).toBeDefined();

      const result = await (
        saveCaseTool!.execute as unknown as (
          params: unknown,
        ) => Promise<unknown>
      )({
        name: "Test Case",
        description: "Test Description",
        model: {
          stages: [
            {
              id: "stage1",
              name: "Stage 1",
              order: 1,
              processes: [
                {
                  id: "process1",
                  name: "Process 1",
                  order: 1,
                  steps: [
                    {
                      id: "step1",
                      type: "Collect information",
                      name: "Step 1",
                      order: 1,
                    },
                  ],
                },
              ],
            },
          ],
        },
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO "Cases"'),
        ["Test Case", "Test Description", expect.any(String)],
      );
      expect(result).toEqual(mockResult.rows[0]);
    });

    it("should update an existing case successfully when id is provided", async () => {
      const mockResult = {
        rows: [
          {
            id: 1,
            name: "Updated Case",
            description: "Updated Description",
            model: '{"stages": []}',
          },
        ],
      };
      mockQuery.mockResolvedValue(mockResult);

      const saveCaseTool = databaseTools.find(
        (tool) => tool.name === "saveCase",
      );
      expect(saveCaseTool).toBeDefined();

      const result = await (
        saveCaseTool!.execute as unknown as (
          params: unknown,
        ) => Promise<unknown>
      )({
        id: 1,
        name: "Updated Case",
        description: "Updated Description",
        model: { stages: [] },
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE "Cases"'),
        expect.arrayContaining(["Updated Case", "Updated Description", 1]),
      );
      const callArgs = mockQuery.mock.calls[0][1];
      expect(JSON.parse(callArgs[2])).toEqual({ stages: [] });
      expect(result).toEqual(mockResult.rows[0]);
    });

    it("should reject case with fields arrays in steps", async () => {
      const saveCaseTool = databaseTools.find(
        (tool) => tool.name === "saveCase",
      );
      expect(saveCaseTool).toBeDefined();

      await expect(
        (
          saveCaseTool!.execute as unknown as (
            params: unknown,
          ) => Promise<unknown>
        )({
          name: "Test Case",
          description: "Test Description",
          model: {
            stages: [
              {
                id: "stage1",
                name: "Stage 1",
                order: 1,
                processes: [
                  {
                    id: "process1",
                    name: "Process 1",
                    order: 1,
                    steps: [
                      {
                        id: "step1",
                        type: "Collect information",
                        name: "Step 1",
                        order: 1,
                        fields: [{ id: 1, required: true }], // ❌ Fields in step
                      },
                    ],
                  },
                ],
              },
            ],
          },
        }),
      ).rejects.toThrow(
        'Step "Step 1" contains a fields array. Fields should be stored in views, not in steps. Remove the fields array from the step.',
      );
    });

    it("should throw error when model is missing stages", async () => {
      const saveCaseTool = databaseTools.find(
        (tool) => tool.name === "saveCase",
      );
      expect(saveCaseTool).toBeDefined();

      await expect(
        (
          saveCaseTool!.execute as unknown as (
            params: unknown,
          ) => Promise<unknown>
        )({
          name: "Test Case",
          description: "Test Description",
          model: { stages: "not an array" }, // Invalid stages type
        }),
      ).rejects.toThrow("Model stages must be an array");
    });

    it("should throw error when model is null", async () => {
      const saveCaseTool = databaseTools.find(
        (tool) => tool.name === "saveCase",
      );
      expect(saveCaseTool).toBeDefined();

      await expect(
        (
          saveCaseTool!.execute as unknown as (
            params: unknown,
          ) => Promise<unknown>
        )({
          name: "Test Case",
          description: "Test Description",
          model: null,
        }),
      ).rejects.toThrow("Case model is required for saveCase");
    });

    it("should validate collect_information steps have viewId", async () => {
      // Mock the case existence check and update query
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ id: 1 }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 1,
              name: "Test Case",
              description: "Test Description",
              model: "{}",
            },
          ],
          rowCount: 1,
        });

      const saveCaseTool = databaseTools.find(
        (tool) => tool.name === "saveCase",
      );
      expect(saveCaseTool).toBeDefined();

      // This should not throw an error, just log a warning
      const result = await (
        saveCaseTool!.execute as unknown as (
          params: unknown,
        ) => Promise<unknown>
      )({
        id: 1,
        name: "Test Case",
        description: "Test Description",
        model: {
          stages: [
            {
              id: "stage1",
              name: "Stage 1",
              order: 1,
              processes: [
                {
                  id: "process1",
                  name: "Process 1",
                  order: 1,
                  steps: [
                    {
                      id: "step1",
                      type: "Collect information",
                      name: "Step 1",
                      order: 1,
                      // Missing viewId
                    },
                  ],
                },
              ],
            },
          ],
        },
      });

      expect(result).toBeDefined();
      expect(mockQuery).toHaveBeenCalled();
    });

    it("should validate viewId uniqueness", async () => {
      const saveCaseTool = databaseTools.find(
        (tool) => tool.name === "saveCase",
      );
      expect(saveCaseTool).toBeDefined();

      await expect(
        (
          saveCaseTool!.execute as unknown as (
            params: unknown,
          ) => Promise<unknown>
        )({
          id: 1,
          name: "Test Case",
          description: "Test Description",
          model: {
            stages: [
              {
                id: "stage1",
                name: "Stage 1",
                order: 1,
                processes: [
                  {
                    id: "process1",
                    name: "Process 1",
                    order: 1,
                    steps: [
                      {
                        id: "step1",
                        type: "Collect information",
                        name: "Step 1",
                        order: 1,
                        viewId: "view1",
                      },
                      {
                        id: "step2",
                        type: "Collect information",
                        name: "Step 2",
                        order: 2,
                        viewId: "view1", // Duplicate viewId
                      },
                    ],
                  },
                ],
              },
            ],
          },
        }),
      ).rejects.toThrow('Duplicate viewId "view1" found in steps');
    });

    it("should allow empty processes arrays", async () => {
      // Mock the case creation query
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            name: "Test Case",
            description: "Test Description",
            model:
              '{"stages":[{"id":"stage1","name":"Stage 1","order":1,"processes":[]}]}',
          },
        ],
        rowCount: 1,
      });

      const saveCaseTool = databaseTools.find(
        (tool) => tool.name === "saveCase",
      );
      expect(saveCaseTool).toBeDefined();

      // This should not throw an error - empty processes arrays are now allowed
      const result = await (
        saveCaseTool!.execute as unknown as (
          params: unknown,
        ) => Promise<unknown>
      )({
        name: "Test Case",
        description: "Test Description",
        model: {
          stages: [
            {
              id: "stage1",
              name: "Stage 1",
              order: 1,
              processes: [], // Empty processes array should be allowed
            },
          ],
        },
      });

      expect(result).toBeDefined();
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO "Cases"'),
        ["Test Case", "Test Description", expect.any(String)],
      );
    });

    it("should allow empty models and provide default structure", async () => {
      // Mock the case creation query
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            name: "Test Case",
            description: "Test Description",
            model: '{"stages":[]}',
          },
        ],
        rowCount: 1,
      });

      const saveCaseTool = databaseTools.find(
        (tool) => tool.name === "saveCase",
      );
      expect(saveCaseTool).toBeDefined();

      // This should not throw an error - empty models should be allowed
      const result = await (
        saveCaseTool!.execute as unknown as (
          params: unknown,
        ) => Promise<unknown>
      )({
        name: "Test Case",
        description: "Test Description",
        model: {}, // Empty model should be allowed and converted to { stages: [] }
      });

      expect(result).toBeDefined();
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO "Cases"'),
        ["Test Case", "Test Description", '{"stages":[]}'],
      );
    });
  });

  describe("saveField", () => {
    it("should create a new field successfully", async () => {
      // Mock case exists check
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });
      // Mock existing field check (no existing field with same name)
      mockQuery.mockResolvedValueOnce({ rowCount: 0 });
      // Mock insert result
      const mockResult = {
        rows: [
          {
            id: 1,
            name: "testField",
            type: "Text",
            caseid: 1,
            primary: false,
            required: false,
            label: "Test Field",
            description: "",
            order: 0,
            options: "[]",
            defaultValue: null,
          },
        ],
        rowCount: 1,
      };
      mockQuery.mockResolvedValueOnce(mockResult);

      const saveFieldTool = databaseTools.find(
        (tool) => tool.name === "saveField",
      );
      expect(saveFieldTool).toBeDefined();

      const result = await (
        saveFieldTool!.execute as unknown as (
          params: unknown,
        ) => Promise<unknown>
      )({
        name: "testField",
        type: "Text",
        caseID: 1,
        label: "Test Field",
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO "Fields"'),
        [
          "testField",
          "Text",
          false,
          1,
          false,
          "Test Field",
          "",
          0,
          "[]",
          undefined,
        ],
      );
      expect(result).toEqual(mockResult.rows[0]);
    });

    it("should update an existing field successfully", async () => {
      // Mock case exists check
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });
      // Mock update result
      const mockResult = {
        rows: [
          {
            id: 1,
            name: "updatedField",
            type: "Text",
            caseid: 1,
            primary: true,
            required: true,
            label: "Updated Field",
            description: "Updated description",
            order: 1,
            options: "[]",
            defaultValue: null,
          },
        ],
        rowCount: 1,
      };
      mockQuery.mockResolvedValueOnce(mockResult);

      const saveFieldTool = databaseTools.find(
        (tool) => tool.name === "saveField",
      );
      expect(saveFieldTool).toBeDefined();

      const result = await (
        saveFieldTool!.execute as unknown as (
          params: unknown,
        ) => Promise<unknown>
      )({
        id: 1,
        name: "updatedField",
        type: "Text",
        caseID: 1,
        label: "Updated Field",
        primary: true,
        required: true,
        description: "Updated description",
        order: 1,
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE "Fields"'),
        [
          "updatedField",
          "Text",
          true,
          1,
          true,
          "Updated Field",
          "Updated description",
          1,
          "[]",
          undefined,
          1,
        ],
      );
      expect(result).toEqual(mockResult.rows[0]);
    });

    it("should throw error for invalid field type", async () => {
      const saveFieldTool = databaseTools.find(
        (tool) => tool.name === "saveField",
      );
      expect(saveFieldTool).toBeDefined();

      await expect(
        (
          saveFieldTool!.execute as unknown as (
            params: unknown,
          ) => Promise<unknown>
        )({
          name: "testField",
          type: "InvalidType",
          caseID: 1,
          label: "Test Field",
        }),
      ).rejects.toThrow('Invalid field type "InvalidType"');
    });

    it("should throw error for invalid field name", async () => {
      const saveFieldTool = databaseTools.find(
        (tool) => tool.name === "saveField",
      );
      expect(saveFieldTool).toBeDefined();

      await expect(
        (
          saveFieldTool!.execute as unknown as (
            params: unknown,
          ) => Promise<unknown>
        )({
          name: "Stage1",
          type: "Text",
          caseID: 1,
          label: "Test Field",
        }),
      ).rejects.toThrow('Invalid field name "Stage1"');
    });

    it("should throw error for missing required parameters", async () => {
      const saveFieldTool = databaseTools.find(
        (tool) => tool.name === "saveField",
      );
      expect(saveFieldTool).toBeDefined();

      await expect(
        (
          saveFieldTool!.execute as unknown as (
            params: unknown,
          ) => Promise<unknown>
        )({
          // Missing required parameters
        }),
      ).rejects.toThrow("Field name is required for saveField");
    });

    it("should return existing field for duplicate field name", async () => {
      // Mock case exists check
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });
      // Mock existing field check (field with same name exists)
      mockQuery.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: 1, name: "existingField" }],
      });
      // Mock full field data query
      mockQuery.mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            id: 1,
            name: "existingField",
            type: "Text",
            caseid: 1,
            primary: false,
            required: false,
            label: "Existing Field",
            description: "",
            order: 0,
            options: "[]",
            defaultValue: null,
          },
        ],
      });

      const saveFieldTool = databaseTools.find(
        (tool) => tool.name === "saveField",
      );
      expect(saveFieldTool).toBeDefined();

      const result = await (
        saveFieldTool!.execute as unknown as (
          params: unknown,
        ) => Promise<unknown>
      )({
        name: "existingField",
        type: "Text",
        caseID: 1,
        label: "Test Field",
      });

      expect(result).toEqual({
        id: 1,
        name: "existingField",
        type: "Text",
        caseid: 1,
        primary: false,
        required: false,
        label: "Existing Field",
        description: "",
        order: 0,
        options: "[]",
        defaultValue: null,
      });
    });
  });

  describe("saveView", () => {
    it("should create a new view successfully", async () => {
      // Mock case exists check
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });
      // Mock available fields check
      mockQuery.mockResolvedValueOnce({ rowCount: 0 });
      // Mock insert result
      const mockResult = {
        rows: [
          {
            id: 1,
            name: "testView",
            caseid: 1,
            model: '{"fields":[],"layout":{"type":"form","columns":1}}',
          },
        ],
        rowCount: 1,
      };
      mockQuery.mockResolvedValueOnce(mockResult);

      const saveViewTool = databaseTools.find(
        (tool) => tool.name === "saveView",
      );
      expect(saveViewTool).toBeDefined();

      const result = await (
        saveViewTool!.execute as unknown as (
          params: unknown,
        ) => Promise<unknown>
      )({
        name: "testView",
        caseID: 1,
        model: {
          fields: [],
          layout: { type: "form", columns: 1 },
        },
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO "Views"'),
        ["testView", 1, '{"fields":[],"layout":{"type":"form","columns":1}}'],
      );
      expect(result).toEqual(mockResult.rows[0]);
    });

    it("should update an existing view successfully", async () => {
      // Mock view exists check
      mockQuery.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ name: "oldView" }],
      });
      // Mock name conflict check
      mockQuery.mockResolvedValueOnce({ rowCount: 0 });
      // Mock update result
      const mockResult = {
        rows: [
          {
            id: 1,
            name: "updatedView",
            caseid: 1,
            model: '{"fields":[],"layout":{"type":"form","columns":1}}',
          },
        ],
        rowCount: 1,
      };
      mockQuery.mockResolvedValueOnce(mockResult);

      const saveViewTool = databaseTools.find(
        (tool) => tool.name === "saveView",
      );
      expect(saveViewTool).toBeDefined();

      const result = await (
        saveViewTool!.execute as unknown as (
          params: unknown,
        ) => Promise<unknown>
      )({
        id: 1,
        name: "updatedView",
        caseID: 1,
        model: {
          fields: [],
          layout: { type: "form", columns: 1 },
        },
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE "Views"'),
        [
          "updatedView",
          1,
          '{"fields":[],"layout":{"type":"form","columns":1}}',
          1,
        ],
      );
      expect(result).toEqual(mockResult.rows[0]);
    });

    it("should throw error for missing required parameters", async () => {
      const saveViewTool = databaseTools.find(
        (tool) => tool.name === "saveView",
      );
      expect(saveViewTool).toBeDefined();

      await expect(
        (
          saveViewTool!.execute as unknown as (
            params: unknown,
          ) => Promise<unknown>
        )({
          // Missing required parameters
        }),
      ).rejects.toThrow("View name is required for saveView");
    });
  });

  describe("deleteCase", () => {
    it("should delete a case successfully", async () => {
      const mockResult = {
        rows: [{ id: 1, name: "Test Case" }],
      };
      mockQuery.mockResolvedValue(mockResult);

      const deleteCaseTool = databaseTools.find(
        (tool) => tool.name === "deleteCase",
      );
      expect(deleteCaseTool).toBeDefined();

      const result = await (
        deleteCaseTool!.execute as unknown as (
          params: unknown,
        ) => Promise<unknown>
      )({ id: 1 });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM "Cases"'),
        [1],
      );
      expect(result).toEqual({
        id: 1,
        name: "Test Case",
        message: 'Successfully deleted case "Test Case" with ID 1',
      });
    });

    it("should throw error when case does not exist", async () => {
      mockQuery.mockResolvedValue({
        rows: [],
        rowCount: 0,
      });

      const deleteCaseTool = databaseTools.find(
        (tool) => tool.name === "deleteCase",
      );
      expect(deleteCaseTool).toBeDefined();

      await expect(
        (
          deleteCaseTool!.execute as unknown as (
            params: unknown,
          ) => Promise<unknown>
        )({ id: 999 }),
      ).rejects.toThrow("No case found with id 999");
    });
  });

  describe("deleteField", () => {
    it("should delete a field successfully", async () => {
      const mockResult = {
        rows: [{ id: 1, name: "Test Field" }],
      };
      mockQuery.mockResolvedValue(mockResult);

      const deleteFieldTool = databaseTools.find(
        (tool) => tool.name === "deleteField",
      );
      expect(deleteFieldTool).toBeDefined();

      const result = await (
        deleteFieldTool!.execute as unknown as (
          params: unknown,
        ) => Promise<unknown>
      )({ id: 1 });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM "Fields"'),
        [1],
      );
      expect(result).toEqual({
        id: 1,
        name: "Test Field",
        message: 'Successfully deleted field "Test Field" with ID 1',
      });
    });

    it("should throw error when field does not exist", async () => {
      mockQuery.mockResolvedValue({
        rows: [],
        rowCount: 0,
      });

      const deleteFieldTool = databaseTools.find(
        (tool) => tool.name === "deleteField",
      );
      expect(deleteFieldTool).toBeDefined();

      await expect(
        (
          deleteFieldTool!.execute as unknown as (
            params: unknown,
          ) => Promise<unknown>
        )({ id: 999 }),
      ).rejects.toThrow("No field found with id 999");
    });
  });
});
