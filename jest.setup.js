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
