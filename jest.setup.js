// Set test environment variables
process.env.NODE_ENV = "test";

// Import React testing utilities
require("@testing-library/jest-dom");

// Add any global test setup here

// Polyfill setImmediate for Node.js environment
global.setImmediate =
  global.setImmediate || ((fn, ...args) => setTimeout(fn, 0, ...args));

// Polyfill TextEncoder and TextDecoder
global.TextEncoder = global.TextEncoder || require("util").TextEncoder;
global.TextDecoder = global.TextDecoder || require("util").TextDecoder;

// Polyfill TransformStream
global.TransformStream =
  global.TransformStream || require("stream/web").TransformStream;

// Mock Next.js Request and Response
global.Request = class Request {
  constructor(input, init = {}) {
    const url = typeof input === "string" ? input : input.url;
    Object.defineProperty(this, "url", {
      value: url,
      writable: false,
      configurable: true,
    });
    this.method = init.method || "GET";
    this.headers = new Map(Object.entries(init.headers || {}));
    this.body = init.body;
  }
};

global.Response = class Response {
  constructor(body, init = {}) {
    this.body = body;
    this.status = init.status || 200;
    this.statusText = init.statusText || "OK";
    this.headers = new Map(Object.entries(init.headers || {}));
    this.ok = this.status >= 200 && this.status < 300;
  }

  async json() {
    return this.body;
  }

  async text() {
    return this.body;
  }

  static json(data, init = {}) {
    return new Response(data, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...init.headers,
      },
    });
  }
};

// Add get method to Map prototype for headers compatibility
if (!Map.prototype.get) {
  Map.prototype.get = function (key) {
    return this.has(key)
      ? Array.from(this.entries()).find(([k]) => k === key)?.[1]
      : undefined;
  };
}

// Ensure Map.prototype.get works correctly
const originalGet = Map.prototype.get;
Map.prototype.get = function (key) {
  if (this.has(key)) {
    return Array.from(this.entries()).find(([k]) => k === key)?.[1];
  }
  return undefined;
};

// Mock next/config for serverRuntimeConfig
jest.mock("next/config", () => () => ({
  serverRuntimeConfig: {
    DATABASE_URL: "postgres://user:pass@localhost:5432/testdb",
  },
}));

// Mock Next.js router
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
}));

// Mock ReadableStream
global.ReadableStream = require("stream/web").ReadableStream;

// Mock console methods to keep test output clean
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

// Import and set up expect globally
const { expect } = require("@jest/globals");
global.expect = expect;

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
