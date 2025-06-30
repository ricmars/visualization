// Set test environment variables
process.env.NODE_ENV = "test";

// Add any global test setup here

// Mock next/config for serverRuntimeConfig
jest.mock("next/config", () => () => ({
  serverRuntimeConfig: {
    DATABASE_URL: "postgres://user:pass@localhost:5432/testdb",
  },
}));

// Mock ReadableStream
global.ReadableStream = require("stream/web").ReadableStream;

// Mock TextDecoder
global.TextDecoder = class TextDecoder {
  decode(value) {
    return Buffer.from(value).toString("utf-8");
  }
};

// Mock console methods to keep test output clean
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

// Add expect to global scope
global.expect = require("expect");

// Global cleanup function that can be called from individual test files
global.cleanupTestEnvironment = async () => {
  try {
    const { pool } = require("./src/app/lib/db");
    if (pool && typeof pool.end === "function") {
      await pool.end();
    }
  } catch (e) {
    // Ignore if pool is not available
  }

  // Force garbage collection to clean up any remaining handles
  if (global.gc) {
    global.gc();
  }

  // Clear any remaining timers
  jest.clearAllTimers();
};

// Process cleanup on exit
process.on("exit", () => {
  global.cleanupTestEnvironment?.();
});

process.on("SIGINT", () => {
  global.cleanupTestEnvironment?.();
  process.exit(0);
});

process.on("SIGTERM", () => {
  global.cleanupTestEnvironment?.();
  process.exit(0);
});
