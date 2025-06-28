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

  describe("createCase", () => {
    it("should create a case successfully", async () => {
      const mockResult = {
        rows: [
          {
            id: 1,
            name: "Test Case",
            description: "Test Description",
            model: '{"stages": []}',
          },
        ],
      };
      mockQuery.mockResolvedValue(mockResult);

      const createCaseTool = databaseTools.find(
        (tool) => tool.name === "createCase",
      );
      expect(createCaseTool).toBeDefined();

      const result = await (
        createCaseTool!.execute as unknown as (
          params: unknown,
        ) => Promise<unknown>
      )({
        name: "Test Case",
        description: "Test Description",
        model: { stages: [] },
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO "Cases"'),
        expect.arrayContaining(["Test Case", "Test Description"]),
      );
      const callArgs = mockQuery.mock.calls[0][1];
      expect(JSON.parse(callArgs[2])).toEqual({ stages: [] });
      expect(result).toEqual({
        id: 1,
        name: "Test Case",
        description: "Test Description",
        model: '{"stages": []}',
        message: 'Successfully created case "Test Case" with ID 1',
      });
    });

    it("should throw error when model is missing stages", async () => {
      const createCaseTool = databaseTools.find(
        (tool) => tool.name === "createCase",
      );
      expect(createCaseTool).toBeDefined();

      await expect(
        (
          createCaseTool!.execute as unknown as (
            params: unknown,
          ) => Promise<unknown>
        )({
          name: "Test Case",
          description: "Test Description",
          model: {},
        }),
      ).rejects.toThrow("Model must include stages array");
    });

    it("should throw error when model is null", async () => {
      const createCaseTool = databaseTools.find(
        (tool) => tool.name === "createCase",
      );
      expect(createCaseTool).toBeDefined();

      await expect(
        (
          createCaseTool!.execute as unknown as (
            params: unknown,
          ) => Promise<unknown>
        )({
          name: "Test Case",
          description: "Test Description",
          model: null,
        }),
      ).rejects.toThrow("Model must include stages array");
    });
  });

  describe("updateCase", () => {
    it("should update a case successfully", async () => {
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

      const updateCaseTool = databaseTools.find(
        (tool) => tool.name === "updateCase",
      );
      expect(updateCaseTool).toBeDefined();

      const result = await (
        updateCaseTool!.execute as unknown as (
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

    it("should throw error when model is missing stages", async () => {
      const updateCaseTool = databaseTools.find(
        (tool) => tool.name === "updateCase",
      );
      expect(updateCaseTool).toBeDefined();

      await expect(
        (
          updateCaseTool!.execute as unknown as (
            params: unknown,
          ) => Promise<unknown>
        )({
          id: 1,
          name: "Test Case",
          description: "Test Description",
          model: {},
        }),
      ).rejects.toThrow("Model must include stages array");
    });

    it("should throw error when case is not found", async () => {
      mockQuery.mockResolvedValue({
        rows: [],
        rowCount: 0,
      });

      const updateCaseTool = databaseTools.find(
        (tool) => tool.name === "updateCase",
      );
      expect(updateCaseTool).toBeDefined();

      await expect(
        (
          updateCaseTool!.execute as unknown as (
            params: unknown,
          ) => Promise<unknown>
        )({
          id: 999,
          name: "Test Case",
          description: "Test Description",
          model: { stages: [] },
        }),
      ).rejects.toThrow("No case found with id 999");
    });

    it("should validate collect_information steps have viewId", async () => {
      const updateCaseTool = databaseTools.find(
        (tool) => tool.name === "updateCase",
      );
      expect(updateCaseTool).toBeDefined();

      await expect(
        (
          updateCaseTool!.execute as unknown as (
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
        }),
      ).rejects.toThrow(
        'Step "Step 1" of type "Collect information" must have a viewId',
      );
    });

    it("should validate viewId uniqueness", async () => {
      const updateCaseTool = databaseTools.find(
        (tool) => tool.name === "updateCase",
      );
      expect(updateCaseTool).toBeDefined();

      await expect(
        (
          updateCaseTool!.execute as unknown as (
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
  });

  describe("createField", () => {
    it("should create a field successfully", async () => {
      const mockResult = {
        rows: [
          {
            id: 1,
            name: "Test Field",
            type: "Text",
            caseid: 1,
            primary: false,
            required: true,
            label: "Test Field",
            description: "Test Description",
            order: 1,
            options: "[]",
            defaultValue: null,
          },
        ],
      };
      mockQuery.mockResolvedValue(mockResult);

      const createFieldTool = databaseTools.find(
        (tool) => tool.name === "createField",
      );
      expect(createFieldTool).toBeDefined();

      const result = await (
        createFieldTool!.execute as unknown as (
          params: unknown,
        ) => Promise<unknown>
      )({
        name: "Test Field",
        type: "Text",
        caseID: 1,
        label: "Test Field",
        description: "Test Description",
        required: true,
        order: 1,
        options: [],
        defaultValue: null,
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO "Fields"'),
        [
          "Test Field",
          "Text",
          false,
          1,
          true,
          "Test Field",
          "Test Description",
          1,
          "[]",
          null,
        ],
      );
      expect(result).toEqual(mockResult.rows[0]);
    });

    it("should throw error when case does not exist", async () => {
      mockQuery.mockResolvedValue({
        rows: [],
        rowCount: 0,
      });

      const createFieldTool = databaseTools.find(
        (tool) => tool.name === "createField",
      );
      expect(createFieldTool).toBeDefined();

      await expect(
        (
          createFieldTool!.execute as unknown as (
            params: unknown,
          ) => Promise<unknown>
        )({
          name: "Test Field",
          type: "Text",
          caseID: 999,
          label: "Test Field",
        }),
      ).rejects.toThrow("No case found with id 999");
    });

    it("should use default values when optional parameters are not provided", async () => {
      const mockResult = {
        rows: [
          {
            id: 1,
            name: "Test Field",
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
      };
      mockQuery.mockResolvedValue(mockResult);

      const createFieldTool = databaseTools.find(
        (tool) => tool.name === "createField",
      );
      expect(createFieldTool).toBeDefined();

      const result = await (
        createFieldTool!.execute as unknown as (
          params: unknown,
        ) => Promise<unknown>
      )({
        name: "Test Field",
        type: "Text",
        caseID: 1,
        label: "Test Field",
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO "Fields"'),
        [
          "Test Field",
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
  });

  describe("createView", () => {
    it("should create a view successfully", async () => {
      const mockResult = {
        rows: [
          {
            id: 1,
            name: "TestViewForm",
            caseid: 1,
            model: '{"fields":[],"layout":{"type":"form","columns":1}}',
          },
        ],
      };
      mockQuery.mockResolvedValue(mockResult);

      const createViewTool = databaseTools.find(
        (tool) => tool.name === "createView",
      );
      expect(createViewTool).toBeDefined();

      const result = await (
        createViewTool!.execute as unknown as (
          params: unknown,
        ) => Promise<unknown>
      )({
        name: "TestViewForm",
        caseID: 1,
        stepName: "TestView",
        model: {
          fields: [],
          layout: { type: "form", columns: 1 },
        },
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO "Views"'),
        [
          "TestViewForm",
          1,
          '{"fields":[],"layout":{"type":"form","columns":1}}',
        ],
      );
      expect(result).toEqual(mockResult.rows[0]);
    });

    it("should throw error when case does not exist", async () => {
      mockQuery.mockResolvedValue({
        rows: [],
        rowCount: 0,
      });

      const createViewTool = databaseTools.find(
        (tool) => tool.name === "createView",
      );
      expect(createViewTool).toBeDefined();

      await expect(
        (
          createViewTool!.execute as unknown as (
            params: unknown,
          ) => Promise<unknown>
        )({
          name: "TestViewForm",
          caseID: 999,
          stepName: "TestView",
          model: {
            fields: [],
            layout: { type: "form", columns: 1 },
          },
        }),
      ).rejects.toThrow("No case found with id 999");
    });

    it("should validate view name pattern", async () => {
      const createViewTool = databaseTools.find(
        (tool) => tool.name === "createView",
      );
      expect(createViewTool).toBeDefined();

      await expect(
        (
          createViewTool!.execute as unknown as (
            params: unknown,
          ) => Promise<unknown>
        )({
          name: "WrongName", // Should end with "Form"
          caseID: 1,
          stepName: "TestView",
          model: {
            fields: [],
            layout: { type: "form", columns: 1 },
          },
        }),
      ).rejects.toThrow("View name must follow the pattern: TestViewForm");
    });

    it("should validate field references exist", async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 }) // Case exists
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // Field does not exist

      const createViewTool = databaseTools.find(
        (tool) => tool.name === "createView",
      );
      expect(createViewTool).toBeDefined();

      await expect(
        (
          createViewTool!.execute as unknown as (
            params: unknown,
          ) => Promise<unknown>
        )({
          name: "TestViewForm",
          caseID: 1,
          stepName: "TestView",
          model: {
            fields: [{ fieldId: 999, required: true }],
            layout: { type: "form", columns: 1 },
          },
        }),
      ).rejects.toThrow("Field with id 999 not found in case 1");
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
