import {
  databaseSystemPrompt,
  getCompleteToolsContext,
} from "../databasePrompt";

describe("Database Prompt", () => {
  describe("databaseSystemPrompt", () => {
    it("should be much shorter than the previous complex prompt", () => {
      // The new prompt should be significantly shorter
      expect(databaseSystemPrompt.length).toBeLessThan(2000);
    });

    it("should mention that tools are self-documenting", () => {
      expect(databaseSystemPrompt).toContain("self-documenting");
    });

    it("should mention tool descriptions contain information", () => {
      expect(databaseSystemPrompt).toContain("tool description");
    });

    it("should mention step sequence", () => {
      expect(databaseSystemPrompt).toContain("sequence");
    });

    it("should mention critical rules", () => {
      expect(databaseSystemPrompt).toContain("critical rules");
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
            "STEP 2: Creates a new field or updates an existing field. Use the caseID returned from createCase. Fields store the business data that will be collected in views. Only create fields - do not include them in the workflow model.",
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
