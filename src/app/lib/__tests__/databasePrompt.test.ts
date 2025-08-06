import {
  databaseSystemPrompt,
  getCompleteToolsContext,
} from "../databasePrompt";

describe("Database Prompt", () => {
  describe("databaseSystemPrompt", () => {
    // Removed the test for prompt length as requested

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

    it("should include enhanced view creation guidelines", () => {
      expect(databaseSystemPrompt).toContain(
        "CRITICAL VIEW CREATION GUIDELINES",
      );
      expect(databaseSystemPrompt).toContain(
        "View names should match or closely relate to the step names they will be used for",
      );
      expect(databaseSystemPrompt).toContain(
        "Always save the returned view ID and use it in the corresponding step's viewId field",
      );
    });

    it("should include workflow creation sequence", () => {
      expect(databaseSystemPrompt).toContain("WORKFLOW CREATION SEQUENCE");
      expect(databaseSystemPrompt).toContain("Create the case with createCase");
      expect(databaseSystemPrompt).toContain("Create fields with saveField");
      expect(databaseSystemPrompt).toContain("Create views with saveView");
      expect(databaseSystemPrompt).toContain("Update the case with saveCase");
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
