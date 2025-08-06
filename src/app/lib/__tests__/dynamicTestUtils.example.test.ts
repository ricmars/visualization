import {
  testForEachRuleType,
  getMockRuleType,
  getSampleDataForRuleType,
  createDynamicApiMock,
  getDynamicApiUrl,
  createDynamicApiRequestBody,
  setupRuleTypeRegistryMocks,
  resetDynamicTestMocks,
} from "./dynamicTestUtils";

// Example test demonstrating how to use dynamic test utilities
describe("Dynamic Test Utils Example", () => {
  let mockFetch: jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    resetDynamicTestMocks();
    mockFetch = createDynamicApiMock() as jest.MockedFunction<typeof fetch>;
    global.fetch = mockFetch;

    // Set up rule type registry mocks
    setupRuleTypeRegistryMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("Dynamic API Operations", () => {
    // Test that works for any rule type without hardcoding
    testForEachRuleType(
      "should create a record via dynamic API",
      async (ruleTypeId, _mockRuleType) => {
        const sampleData = getSampleDataForRuleType(ruleTypeId);
        const url = getDynamicApiUrl(ruleTypeId);
        const body = createDynamicApiRequestBody(ruleTypeId, sampleData);

        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        expect(response.ok).toBe(true);
        const result = await response.json();
        expect(result.success).toBe(true);
        expect(result.data).toMatchObject(sampleData);
      },
    );

    testForEachRuleType(
      "should read a record via dynamic API",
      async (ruleTypeId, _mockRuleType) => {
        const url = getDynamicApiUrl(ruleTypeId, 1);

        const response = await fetch(url, {
          method: "GET",
        });

        expect(response.ok).toBe(true);
        const result = await response.json();
        expect(result.success).toBe(true);
        expect(result.data).toHaveProperty("id", 1);
      },
    );

    testForEachRuleType(
      "should list records via dynamic API",
      async (ruleTypeId, _mockRuleType) => {
        const url = getDynamicApiUrl(ruleTypeId);

        const response = await fetch(url, {
          method: "GET",
        });

        expect(response.ok).toBe(true);
        const result = await response.json();
        expect(result.success).toBe(true);
        expect(Array.isArray(result.data)).toBe(true);
      },
    );

    testForEachRuleType(
      "should update a record via dynamic API",
      async (ruleTypeId, _mockRuleType) => {
        const sampleData = getSampleDataForRuleType(ruleTypeId);
        const url = getDynamicApiUrl(ruleTypeId);
        const body = createDynamicApiRequestBody(ruleTypeId, sampleData, 1);

        const response = await fetch(url, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        expect(response.ok).toBe(true);
        const result = await response.json();
        expect(result.success).toBe(true);
        expect(result.data.id).toBe(1);
      },
    );

    testForEachRuleType(
      "should delete a record via dynamic API",
      async (ruleTypeId, _mockRuleType) => {
        const url = getDynamicApiUrl(ruleTypeId, 1);

        const response = await fetch(url, {
          method: "DELETE",
        });

        expect(response.ok).toBe(true);
        const result = await response.json();
        expect(result.success).toBe(true);
        expect(result.data.id).toBe(1);
      },
    );
  });

  describe("Error Handling", () => {
    it("should return error for unknown rule type", async () => {
      const url = getDynamicApiUrl("unknown-rule-type");

      const response = await fetch(url, {
        method: "GET",
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(404);
      const result = await response.json();
      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("should return error when ruleType is missing", async () => {
      const response = await fetch("/api/dynamic", {
        method: "GET",
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
      const result = await response.json();
      expect(result.success).toBe(false);
      expect(result.error).toContain("ruleType is required");
    });
  });

  describe("Utility Functions", () => {
    it("should get mock rule type by ID", () => {
      const caseRuleType = getMockRuleType("case");
      expect(caseRuleType).toBeDefined();
      expect(caseRuleType?.id).toBe("case");
      expect(caseRuleType?.tableName).toBe("Cases");

      const unknownRuleType = getMockRuleType("unknown");
      expect(unknownRuleType).toBeUndefined();
    });

    it("should get sample data for rule types", () => {
      const caseSampleData = getSampleDataForRuleType("case");
      expect(caseSampleData).toHaveProperty("name");
      expect(caseSampleData).toHaveProperty("description");

      const fieldSampleData = getSampleDataForRuleType("field");
      expect(fieldSampleData).toHaveProperty("name");
      expect(fieldSampleData).toHaveProperty("type");
      expect(fieldSampleData).toHaveProperty("caseid");

      const viewSampleData = getSampleDataForRuleType("view");
      expect(viewSampleData).toHaveProperty("name");
      expect(viewSampleData).toHaveProperty("model");
    });

    it("should generate correct API URLs", () => {
      expect(getDynamicApiUrl("case")).toBe("/api/dynamic?ruleType=case");
      expect(getDynamicApiUrl("field", 123)).toBe(
        "/api/dynamic?ruleType=field&id=123",
      );
    });

    it("should create correct request bodies", () => {
      const sampleData = { name: "Test", value: "test" };

      const createBody = createDynamicApiRequestBody("case", sampleData);
      expect(createBody).toEqual({
        ruleType: "case",
        data: sampleData,
      });

      const updateBody = createDynamicApiRequestBody("case", sampleData, 123);
      expect(updateBody).toEqual({
        ruleType: "case",
        data: sampleData,
        id: 123,
      });
    });
  });
});
