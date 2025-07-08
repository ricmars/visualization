import { createSharedTools } from "../sharedTools";
import { pool } from "../db";
import { LLMTool } from "../toolTypes";
import { waitForPendingPromises, cleanupTimers } from "../testUtils";

// Mock the database types
jest.mock("../../types/database", () => ({
  DB_TABLES: {
    CASES: "Cases",
    FIELDS: "Fields",
    VIEWS: "Views",
  },
  validateFieldType: jest.fn().mockReturnValue(true),
  FIELD_TYPES: {
    TEXT: "Text",
    DATE: "Date",
    EMAIL: "Email",
    BOOLEAN: "Checkbox",
  },
}));

// Mock the database pool
jest.mock("../db", () => ({
  pool: {
    query: jest.fn(),
  },
}));

const mockQuery = pool.query as jest.MockedFunction<typeof pool.query>;

describe("llmTools", () => {
  let databaseTools: LLMTool[];

  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockReset();
    databaseTools = createSharedTools(pool) as unknown as LLMTool[];
  });

  afterEach(async () => {
    // Clean up after each test
    await waitForPendingPromises();
    cleanupTimers();
  });

  afterAll(async () => {
    // Final cleanup
    const cleanupFn = (
      global as { cleanupTestEnvironment?: () => Promise<void> }
    ).cleanupTestEnvironment;
    if (cleanupFn) {
      await cleanupFn();
    }
  });

  describe("createCase", () => {
    it("should create a new case successfully", async () => {
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
      mockQuery.mockResolvedValueOnce(mockResult);

      const createCaseTool = databaseTools.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (tool: any) => tool.name === "createCase",
      );
      expect(createCaseTool).toBeDefined();

      const result =
        await // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (createCaseTool!.execute as any)({
          name: "Test Case",
          description: "Test Description",
        });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO "Cases"'),
        ["Test Case", "Test Description", expect.any(String)],
      );
      expect(result).toEqual({
        id: 1,
        name: "Test Case",
        description: "Test Description",
        model: { stages: [] },
      });
    });

    it("should throw error for missing name", async () => {
      const createCaseTool = databaseTools.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (tool: any) => tool.name === "createCase",
      );
      expect(createCaseTool).toBeDefined();

      await expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (createCaseTool!.execute as any)({
          description: "Test Description",
        }),
      ).rejects.toThrow("Case name is required for createCase");
    });

    it("should throw error for missing description", async () => {
      const createCaseTool = databaseTools.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (tool: any) => tool.name === "createCase",
      );
      expect(createCaseTool).toBeDefined();

      await expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (createCaseTool!.execute as any)({
          name: "Test Case",
        }),
      ).rejects.toThrow("Case description is required for createCase");
    });
  });

  describe("saveCase", () => {
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
      // Mock the viewId validation query (no viewIds to check)
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // Mock the update query
      mockQuery.mockResolvedValueOnce(mockResult);

      const saveCaseTool = databaseTools.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (tool: any) => tool.name === "saveCase",
      );
      expect(saveCaseTool).toBeDefined();

      const result =
        await // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (saveCaseTool!.execute as any)({
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
      expect(result).toEqual({
        id: 1,
        name: "Updated Case",
        description: "Updated Description",
        model: { stages: [] },
      });
    });

    it("should throw error when id is missing", async () => {
      const saveCaseTool = databaseTools.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (tool: any) => tool.name === "saveCase",
      );
      expect(saveCaseTool).toBeDefined();

      await expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (saveCaseTool!.execute as any)({
          name: "Test Case",
          description: "Test Description",
          model: { stages: [] },
        }),
      ).rejects.toThrow(
        "Case ID is required for saveCase - use the ID returned from createCase",
      );
    });

    it("should reject case with fields arrays in steps", async () => {
      // Mock the viewId validation query (no viewIds to check)
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const saveCaseTool = databaseTools.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (tool: any) => tool.name === "saveCase",
      );
      expect(saveCaseTool).toBeDefined();

      await expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (saveCaseTool!.execute as any)({
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (tool: any) => tool.name === "saveCase",
      );
      expect(saveCaseTool).toBeDefined();

      await expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (saveCaseTool!.execute as any)({
          id: 1,
          name: "Test Case",
          description: "Test Description",
          model: { stages: "not an array" }, // Invalid stages type
        }),
      ).rejects.toThrow("Model stages must be an array");
    });

    it("should throw error when model is null", async () => {
      const saveCaseTool = databaseTools.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (tool: any) => tool.name === "saveCase",
      );
      expect(saveCaseTool).toBeDefined();

      await expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (saveCaseTool!.execute as any)({
          id: 1,
          name: "Test Case",
          description: "Test Description",
          model: null,
        }),
      ).rejects.toThrow("Case model is required for saveCase");
    });

    it("should validate collect_information steps have viewId", async () => {
      // Mock the viewId validation query (no viewIds to check)
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // Mock the update query
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            name: "Test Case",
            description: "Test Description",
            model: '{"stages": []}',
          },
        ],
      });

      const saveCaseTool = databaseTools.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (tool: any) => tool.name === "saveCase",
      );
      expect(saveCaseTool).toBeDefined();

      // Spy on console.warn
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation();

      await // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (saveCaseTool!.execute as any)({
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
                      // Missing viewId - should trigger warning
                    },
                  ],
                },
              ],
            },
          ],
        },
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Step "Step 1" is a collect_information step but doesn\'t have a viewId. Add a viewId to reference the view containing the fields.',
      );

      consoleSpy.mockRestore();
    });

    it("should validate viewId uniqueness", async () => {
      // Mock the viewId validation query (viewIds exist)
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }] });
      // Mock the update query
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            name: "Test Case",
            description: "Test Description",
            model: '{"stages": []}',
          },
        ],
      });

      const saveCaseTool = databaseTools.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (tool: any) => tool.name === "saveCase",
      );
      expect(saveCaseTool).toBeDefined();

      await // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (saveCaseTool!.execute as any)({
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
                      viewId: 1,
                    },
                    {
                      id: "step2",
                      type: "Collect information",
                      name: "Step 2",
                      order: 2,
                      viewId: 2,
                    },
                  ],
                },
              ],
            },
          ],
        },
      });

      // Should not throw error for unique viewIds
    });

    it("should throw error when viewId does not exist in database", async () => {
      // Mock the viewId validation query (viewId 999 does not exist)
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const saveCaseTool = databaseTools.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (tool: any) => tool.name === "saveCase",
      );
      expect(saveCaseTool).toBeDefined();

      await expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (saveCaseTool!.execute as any)({
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
                        viewId: 999, // Non-existent viewId
                      },
                    ],
                  },
                ],
              },
            ],
          },
        }),
      ).rejects.toThrow(
        "The following viewId values do not exist in the database: 999. Make sure to use the actual IDs returned from saveView calls.",
      );
    });

    it("should allow empty processes arrays", async () => {
      // Mock the viewId validation query (no viewIds to check)
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // Mock the update query
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            name: "Test Case",
            description: "Test Description",
            model: JSON.stringify({
              stages: [
                {
                  id: "stage1",
                  name: "Stage 1",
                  order: 1,
                  processes: [], // Empty processes array
                },
              ],
            }),
          },
        ],
      });

      const saveCaseTool = databaseTools.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (tool: any) => tool.name === "saveCase",
      );
      expect(saveCaseTool).toBeDefined();

      const inputModel = {
        stages: [
          {
            id: "stage1",
            name: "Stage 1",
            order: 1,
            processes: [], // Empty processes array
          },
        ],
      };

      const result =
        await // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (saveCaseTool!.execute as any)({
          id: 1,
          name: "Test Case",
          description: "Test Description",
          model: inputModel,
        });

      expect(result).toEqual({
        id: 1,
        name: "Test Case",
        description: "Test Description",
        model: inputModel,
      });
    });

    it("should allow empty models and provide default structure", async () => {
      // Mock the viewId validation query (no viewIds to check)
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // Mock the update query
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            name: "Test Case",
            description: "Test Description",
            model: '{"stages": []}',
          },
        ],
      });

      const saveCaseTool = databaseTools.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (tool: any) => tool.name === "saveCase",
      );
      expect(saveCaseTool).toBeDefined();

      const result =
        await // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (saveCaseTool!.execute as any)({
          id: 1,
          name: "Test Case",
          description: "Test Description",
          model: { stages: [] },
        });

      expect(result).toEqual({
        id: 1,
        name: "Test Case",
        description: "Test Description",
        model: { stages: [] },
      });
    });
  });

  describe("saveField", () => {
    it("should create a new field successfully", async () => {
      // Mock existing field check (no existing field with same name)
      mockQuery.mockResolvedValueOnce({ rowCount: 0 });
      // Mock insert result
      const mockResult = {
        rows: [
          {
            id: 1,
            name: "testField",
            type: "Text",
            caseID: 1,
            primary: false,
            required: false,
            label: "Test Field",
            description: "Test Description",
            order: 0,
            options: "[]",
          },
        ],
        rowCount: 1,
      };
      mockQuery.mockResolvedValueOnce(mockResult);

      const saveFieldTool = databaseTools.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (tool: any) => tool.name === "saveField",
      );
      expect(saveFieldTool).toBeDefined();

      const result =
        await // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (saveFieldTool!.execute as any)({
          name: "testField",
          type: "Text",
          caseID: 1,
          label: "Test Field",
          description: "Test Description",
        });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO "Fields"'),
        [
          "testField",
          "Text",
          1,
          "Test Field",
          "Test Description",
          0,
          "[]",
          false,
          false,
        ],
      );
      expect(result).toEqual({
        ...mockResult.rows[0],
        options: [],
        defaultValue: null,
      });
    });

    it("should update an existing field successfully", async () => {
      // Mock existing field check (no existing field with same name)
      mockQuery.mockResolvedValueOnce({ rowCount: 0 });
      // Mock update result
      const mockResult = {
        rows: [
          {
            id: 1,
            name: "updatedField",
            type: "Text",
            caseID: 1,
            primary: true,
            required: true,
            label: "Updated Field",
            description: "Updated description",
            order: 1,
            options: "[]",
          },
        ],
        rowCount: 1,
      };
      mockQuery.mockResolvedValueOnce(mockResult);

      const saveFieldTool = databaseTools.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (tool: any) => tool.name === "saveField",
      );
      expect(saveFieldTool).toBeDefined();

      const result =
        await // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (saveFieldTool!.execute as any)({
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
          1,
          "Updated Field",
          "Updated description",
          1,
          "[]",
          true,
          true,
          1,
        ],
      );
      expect(result).toEqual({
        ...mockResult.rows[0],
        options: [],
        defaultValue: null,
      });
    });

    it("should throw error for invalid field type", async () => {
      // Mock existing field check (no existing field with same name)
      mockQuery.mockResolvedValueOnce({ rowCount: 0 });
      // Mock insert result
      const mockResult = {
        rows: [
          {
            id: 1,
            name: "testField",
            type: "InvalidType",
            caseID: 1,
            primary: false,
            required: false,
            label: "Test Field",
            description: "",
            order: 0,
            options: "[]",
          },
        ],
        rowCount: 1,
      };
      mockQuery.mockResolvedValueOnce(mockResult);

      const saveFieldTool = databaseTools.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (tool: any) => tool.name === "saveField",
      );
      expect(saveFieldTool).toBeDefined();

      await expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (saveFieldTool!.execute as any)({
          name: "testField",
          type: "InvalidType",
          caseID: 1,
          label: "Test Field",
        }),
      ).rejects.toThrow('Invalid field type "InvalidType"');
    });

    it("should create a field with Stage prefix successfully", async () => {
      // Mock existing field check (no existing field with same name)
      mockQuery.mockResolvedValueOnce({ rowCount: 0 });
      // Mock insert result
      const mockResult = {
        rows: [
          {
            id: 1,
            name: "Stage1",
            type: "Text",
            caseID: 1,
            primary: false,
            required: false,
            label: "Test Field",
            description: "",
            order: 0,
            options: "[]",
          },
        ],
        rowCount: 1,
      };
      mockQuery.mockResolvedValueOnce(mockResult);

      const saveFieldTool = databaseTools.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (tool: any) => tool.name === "saveField",
      );
      expect(saveFieldTool).toBeDefined();

      const result =
        await // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (saveFieldTool!.execute as any)({
          name: "Stage1",
          type: "Text",
          caseID: 1,
          label: "Test Field",
        });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO "Fields"'),
        ["Stage1", "Text", 1, "Test Field", "", 0, "[]", false, false],
      );
      expect(result).toEqual({
        ...mockResult.rows[0],
        options: [],
        defaultValue: null,
      });
    });

    it("should throw error for missing required parameters", async () => {
      // Mock existing field check (no existing field with same name)
      mockQuery.mockResolvedValueOnce({ rowCount: 0 });
      // Mock insert result
      const mockResult = {
        rows: [
          {
            id: 1,
            name: "",
            type: "Text",
            caseID: 1,
            primary: false,
            required: false,
            label: "Test Field",
            description: "",
            order: 0,
            options: "[]",
          },
        ],
        rowCount: 1,
      };
      mockQuery.mockResolvedValueOnce(mockResult);

      const saveFieldTool = databaseTools.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (tool: any) => tool.name === "saveField",
      );
      expect(saveFieldTool).toBeDefined();

      await expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (saveFieldTool!.execute as any)({
          // Missing required parameters
        }),
      ).rejects.toThrow("Field name is required for saveField");
    });

    it("should return existing field for duplicate field name", async () => {
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
            caseID: 1,
            primary: false,
            required: false,
            label: "Existing Field",
            description: "Test Description",
            order: 0,
            options: "[]",
          },
        ],
      });

      const saveFieldTool = databaseTools.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (tool: any) => tool.name === "saveField",
      );
      expect(saveFieldTool).toBeDefined();

      const result =
        await // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (saveFieldTool!.execute as any)({
          name: "existingField",
          type: "Text",
          caseID: 1,
          label: "Existing Field",
          description: "Test Description",
        });

      expect(result).toEqual({
        id: 1,
        name: "existingField",
        type: "Text",
        caseID: 1,
        label: "Existing Field",
        description: "Test Description",
        order: 0,
        options: [],
        required: false,
        primary: false,
        defaultValue: null,
      });
    });
  });

  describe("saveView", () => {
    it("should create a new view successfully", async () => {
      const mockResult = {
        rows: [
          {
            id: 1,
            name: "Test View",
            caseID: 1,
            model: '{"fields":[]}',
          },
        ],
      };
      mockQuery.mockResolvedValueOnce(mockResult);

      const saveViewTool = databaseTools.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (tool: any) => tool.name === "saveView",
      );
      expect(saveViewTool).toBeDefined();

      const result =
        await // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (saveViewTool!.execute as any)({
          name: "Test View",
          caseID: 1,
          model: { fields: [] },
        });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO "Views"'),
        ["Test View", 1, expect.any(String)],
      );
      expect(result).toEqual({
        id: 1,
        name: "Test View",
        caseID: 1,
        model: { fields: [] },
      });
    });

    it("should update an existing view successfully", async () => {
      const mockResult = {
        rows: [
          {
            id: 1,
            name: "Updated View",
            caseID: 1,
            model: '{"fields":[]}',
          },
        ],
        rowCount: 1,
      };
      mockQuery.mockResolvedValueOnce(mockResult);

      const saveViewTool = databaseTools.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (tool: any) => tool.name === "saveView",
      );
      expect(saveViewTool).toBeDefined();

      const result =
        await // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (saveViewTool!.execute as any)({
          id: 1,
          name: "Updated View",
          caseID: 1,
          model: { fields: [] },
        });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE "Views"'),
        ["Updated View", 1, expect.any(String), 1],
      );
      expect(result).toEqual({
        id: 1,
        name: "Updated View",
        caseID: 1,
        model: { fields: [] },
      });
    });

    it("should throw error for missing required parameters", async () => {
      const saveViewTool = databaseTools.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (tool: any) => tool.name === "saveView",
      );
      expect(saveViewTool).toBeDefined();

      await expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (saveViewTool!.execute as any)({
          // Missing required parameters
        }),
      ).rejects.toThrow("View name is required for saveView");
    });
  });

  describe("deleteCase", () => {
    it("should delete a case successfully", async () => {
      // Mock the three delete operations: fields, views, case
      mockQuery.mockResolvedValueOnce({ rowCount: 0 }); // delete fields
      mockQuery.mockResolvedValueOnce({ rowCount: 0 }); // delete views
      mockQuery.mockResolvedValueOnce({ rowCount: 1 }); // delete case

      const deleteCaseTool = databaseTools.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (tool: any) => tool.name === "deleteCase",
      );
      expect(deleteCaseTool).toBeDefined();

      const result =
        await // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (deleteCaseTool!.execute as any)({ id: 1 });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM "Fields"'),
        [1],
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM "Views"'),
        [1],
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM "Cases"'),
        [1],
      );
      expect(result).toEqual({ success: true, deletedId: 1 });
    });

    it("should throw error when case does not exist", async () => {
      // Mock the three delete operations: fields, views, case
      mockQuery.mockResolvedValueOnce({ rowCount: 0 }); // delete fields
      mockQuery.mockResolvedValueOnce({ rowCount: 0 }); // delete views
      mockQuery.mockResolvedValueOnce({ rowCount: 0 }); // delete case - no rows affected

      const deleteCaseTool = databaseTools.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (tool: any) => tool.name === "deleteCase",
      );
      expect(deleteCaseTool).toBeDefined();

      await expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (deleteCaseTool!.execute as any)({ id: 999 }),
      ).rejects.toThrow("No case found with id 999");
    });
  });

  describe("deleteField", () => {
    it("should delete a field successfully", async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });

      const deleteFieldTool = databaseTools.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (tool: any) => tool.name === "deleteField",
      );
      expect(deleteFieldTool).toBeDefined();

      const result =
        await // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (deleteFieldTool!.execute as any)({ id: 1 });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM "Fields"'),
        [1],
      );
      expect(result).toEqual({ success: true, deletedId: 1 });
    });

    it("should throw error when field does not exist", async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 0 });

      const deleteFieldTool = databaseTools.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (tool: any) => tool.name === "deleteField",
      );
      expect(deleteFieldTool).toBeDefined();

      await expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (deleteFieldTool!.execute as any)({ id: 999 }),
      ).rejects.toThrow("No field found with id 999");
    });
  });
});
