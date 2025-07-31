module.exports = {
  testEnvironment: "jsdom",
  transform: {
    "^.+\\.(ts|tsx|js|jsx)$": ["babel-jest", { configFile: "./babel.config.test.js" }],
  },
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  testMatch: ["**/__tests__/**/*.test.ts", "**/__tests__/**/*.test.tsx"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "\\.(css|less|scss|sass)$": "identity-obj-proxy",
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
  // Transform ignore patterns - allow transformation of ES modules
  transformIgnorePatterns: [
    "node_modules/(?!(next|@next|react|@react|@testing-library|react-markdown|remark-|rehype-|unified|bail|is-plain-obj|trough|vfile|unist-|mdast-|micromark|decode-named-character-reference|character-entities|property-information|hast-util-|space-separated-tokens|comma-separated-tokens|pretty-bytes|ccount|devlop|hast-util-to-jsx-runtime|estree-util-is-identifier-name|hast-util-whitespace|unist-util-|unist-util-position|vfile-)/)",
  ],
};
