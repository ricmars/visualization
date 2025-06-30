module.exports = {
  testEnvironment: "node",
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.json",
      },
    ],
  },
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  testMatch: ["**/__tests__/**/*.test.ts"],
  setupFiles: ["<rootDir>/jest.setup.js"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  testPathIgnorePatterns: ["/node_modules/", "/.next/"],
  verbose: true,
  testTimeout: 10000,
  // Force Jest to exit after tests complete
  forceExit: true,
  // Clear mocks between tests
  clearMocks: true,
  // Reset modules between tests
  resetModules: false,
  // Restore mocks between tests
  restoreMocks: true,
  // Detect open handles
  detectOpenHandles: true,
};
