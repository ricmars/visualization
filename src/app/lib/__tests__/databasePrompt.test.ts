import {
  buildDatabaseSystemPrompt,
  getCompleteToolsContext,
} from "../databasePrompt";

describe("Database Prompt", () => {
  describe("buildDatabaseSystemPrompt", () => {
    // Removed the test for prompt length as requested

    it("should mention that tools are self-documenting", () => {
      const prompt = buildDatabaseSystemPrompt();
      expect(prompt).toContain("self-documenting");
    });

    it("should mention tool descriptions contain information", () => {
      const prompt = buildDatabaseSystemPrompt();
      expect(prompt).toContain("tool");
    });

    it("should include view guidance and constraints concisely", () => {
      const prompt = buildDatabaseSystemPrompt();
      expect(prompt).toContain("One view per workflow step");
      expect(prompt).toContain("unique viewId");
      expect(prompt).toContain("IDs as integers");
    });
  });

  describe("getCompleteToolsContext", () => {
    it("should include full tool descriptions", () => {
      const mockTools = [
        {
          name: "createCase",
          description:
            "STEP 1: Creates a new case with only name and description. Returns the case ID that you MUST use for all subsequent operations (saveField, saveView). This is the FIRST tool to call when creating a new workflow.",
        },
        {
          name: "saveField",
          description:
            "STEP 2: Creates a new field or updates an existing field. Use the caseid returned from createCase. Fields store the business data that will be collected in views. Only create fields - do not include them in the workflow model.",
        },
      ];

      const context = getCompleteToolsContext(mockTools);

      expect(context).toContain("Available tools:");
      expect(context).toContain("createCase");
      expect(context).toContain("saveField");
      expect(context).toContain("STEP 1:");
      expect(context).toContain("STEP 2:");
      expect(context).toContain(
        "Use these tools to complete workflow creation tasks",
      );
      expect(context).toContain(
        "Each tool contains detailed instructions for proper usage",
      );
    });

    it("should include the full description for each tool", () => {
      const mockTools = [
        {
          name: "testTool",
          description:
            "This is a complete description that should be included in full",
        },
      ];

      const context = getCompleteToolsContext(mockTools);

      expect(context).toContain(
        "This is a complete description that should be included in full",
      );
    });
  });
});
