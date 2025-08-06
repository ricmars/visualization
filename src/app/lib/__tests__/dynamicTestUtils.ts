import { ruleTypeRegistry } from "../../types/ruleTypeRegistry";

/**
 * Dynamic test utilities for working with any rule type
 * These utilities don't hardcode rule types and work with the registry system
 */

export interface MockRuleType {
  id: string;
  tableName: string;
  sampleData: any;
  validationSchema: any;
}

export const mockRuleTypes: MockRuleType[] = [
  {
    id: "case",
    tableName: "Cases",
    sampleData: {
      name: "Test Case",
      description: "Test Description",
      model: JSON.stringify({ stages: [] }),
    },
    validationSchema: {
      parse: jest.fn(),
    },
  },
  {
    id: "field",
    tableName: "Fields",
    sampleData: {
      name: "testField",
      type: "Text",
      caseid: 1,
      label: "Test Field",
      description: "Test Description",
      order: 0,
      options: [],
      required: false,
      primary: false,
    },
    validationSchema: {
      parse: jest.fn(),
    },
  },
  {
    id: "view",
    tableName: "Views",
    sampleData: {
      name: "Test View",
      caseid: 1,
      model: {
        fields: [{ fieldId: 1, required: true, order: 1 }],
      },
    },
    validationSchema: {
      parse: jest.fn(),
    },
  },
];

/**
 * Get a mock rule type by ID
 */
export function getMockRuleType(ruleTypeId: string): MockRuleType | undefined {
  return mockRuleTypes.find((rt) => rt.id === ruleTypeId);
}

/**
 * Get table name for a rule type dynamically
 */
export function getTableNameForRuleType(ruleTypeId: string): string {
  const mockRuleType = getMockRuleType(ruleTypeId);
  return mockRuleType?.tableName || ruleTypeId;
}

/**
 * Get sample data for a rule type
 */
export function getSampleDataForRuleType(ruleTypeId: string): any {
  const mockRuleType = getMockRuleType(ruleTypeId);
  return mockRuleType?.sampleData || {};
}

/**
 * Mock the rule type registry for tests
 */
export function mockRuleTypeRegistry() {
  return jest.mocked(ruleTypeRegistry, { shallow: true });
}

/**
 * Set up rule type registry mocks for all known rule types
 */
export function setupRuleTypeRegistryMocks() {
  const mockRegistry = {
    get: jest.fn((id: string) => {
      const mockRuleType = getMockRuleType(id);
      if (!mockRuleType) return undefined;

      return {
        id: mockRuleType.id,
        name:
          mockRuleType.id.charAt(0).toUpperCase() + mockRuleType.id.slice(1),
        databaseSchema: {
          tableName: mockRuleType.tableName,
        },
        validationSchema: mockRuleType.validationSchema,
      };
    }),
    getAll: jest.fn(() =>
      mockRuleTypes.map((rt) => ({
        id: rt.id,
        name: rt.id.charAt(0).toUpperCase() + rt.id.slice(1),
        databaseSchema: { tableName: rt.tableName },
        validationSchema: rt.validationSchema,
      })),
    ),
  };

  return mockRegistry;
}

/**
 * Create a mock database operation result
 */
export function createMockDatabaseResult<T>(data: T, success = true) {
  return {
    success,
    data,
    affectedRows: success ? 1 : 0,
    error: success ? undefined : "Mock error",
  };
}

/**
 * Create a mock database query result (for pool.query mocks)
 */
export function createMockQueryResult<T>(rows: T[], rowCount?: number) {
  return {
    rows,
    rowCount: rowCount ?? rows.length,
  };
}

/**
 * Generate dynamic API endpoint URL for a rule type
 */
export function getDynamicApiUrl(ruleTypeId: string, id?: number): string {
  let url = `/api/dynamic?ruleType=${ruleTypeId}`;
  if (id) {
    url += `&id=${id}`;
  }
  return url;
}

/**
 * Create dynamic API request body
 */
export function createDynamicApiRequestBody(
  ruleTypeId: string,
  data: any,
  id?: number,
) {
  const body: any = {
    ruleType: ruleTypeId,
    data,
  };

  if (id) {
    body.id = id;
  }

  return body;
}

/**
 * Test helper: run a test for each rule type
 */
export function testForEachRuleType(
  testName: string,
  testFn: (
    ruleTypeId: string,
    mockRuleType: MockRuleType,
  ) => void | Promise<void>,
) {
  mockRuleTypes.forEach((mockRuleType) => {
    it(`${testName} - ${mockRuleType.id}`, async () => {
      await testFn(mockRuleType.id, mockRuleType);
    });
  });
}

/**
 * Create a comprehensive mock for fetch that handles dynamic API calls
 */
export function createDynamicApiMock() {
  return jest.fn(async (url: string, init?: RequestInit) => {
    const urlObj = new URL(url, "http://localhost");

    if (urlObj.pathname === "/api/dynamic") {
      const ruleType = urlObj.searchParams.get("ruleType");
      const id = urlObj.searchParams.get("id");

      if (!ruleType) {
        return {
          ok: false,
          status: 400,
          json: async () => ({ success: false, error: "ruleType is required" }),
        };
      }

      const mockRuleType = getMockRuleType(ruleType);
      if (!mockRuleType) {
        return {
          ok: false,
          status: 404,
          json: async () => ({
            success: false,
            error: `Rule type '${ruleType}' not found`,
          }),
        };
      }

      // Handle different HTTP methods
      switch (init?.method?.toUpperCase()) {
        case "GET":
          if (id) {
            // Read single record
            return {
              ok: true,
              json: async () => ({
                success: true,
                data: { id: Number(id), ...mockRuleType.sampleData },
              }),
            };
          } else {
            // List records
            return {
              ok: true,
              json: async () => ({
                success: true,
                data: [{ id: 1, ...mockRuleType.sampleData }],
              }),
            };
          }

        case "POST":
          // Create record
          const createBody = JSON.parse(init.body as string);
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: { id: 1, ...createBody.data },
            }),
          };

        case "PUT":
          // Update record
          const updateBody = JSON.parse(init.body as string);
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: { id: updateBody.id, ...updateBody.data },
            }),
          };

        case "DELETE":
          // Delete record
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: { id: Number(id) },
            }),
          };

        default:
          return {
            ok: false,
            status: 405,
            json: async () => ({ success: false, error: "Method not allowed" }),
          };
      }
    }

    // Default response for other endpoints
    return {
      ok: true,
      json: async () => ({}),
    };
  });
}

/**
 * Reset all mocks used by dynamic test utilities
 */
export function resetDynamicTestMocks() {
  jest.clearAllMocks();
  mockRuleTypes.forEach((rt) => {
    rt.validationSchema.parse.mockClear();
  });
}
