/**
 * Test utilities for proper async operation cleanup
 */

/**
 * Wait for all pending promises to resolve
 */
export const waitForPendingPromises = async (): Promise<void> => {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setTimeout(resolve, 0));
};

/**
 * Clean up any remaining timers
 */
export const cleanupTimers = (): void => {
  jest.clearAllTimers();
  jest.clearAllMocks();
};

/**
 * Wait for a specific condition to be true
 */
export const waitFor = async (
  condition: () => boolean | Promise<boolean>,
  timeout: number = 5000,
): Promise<void> => {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  throw new Error(`Condition not met within ${timeout}ms`);
};

/**
 * Clean up database connections
 */
export const cleanupDatabase = async (): Promise<void> => {
  try {
    const { pool } = require("./db");
    if (pool && typeof pool.end === "function") {
      await pool.end();
    }
  } catch (_error) {
    // Ignore errors if pool is not available
  }
};

/**
 * Setup test environment with proper cleanup
 */
export const setupTestEnvironment = (): (() => Promise<void>) => {
  const cleanupFunctions: (() => Promise<void>)[] = [];

  return async () => {
    // Run all cleanup functions
    for (const cleanup of cleanupFunctions) {
      try {
        await cleanup();
      } catch (error) {
        console.warn("Cleanup function failed:", error);
      }
    }

    // Additional cleanup
    await waitForPendingPromises();
    cleanupTimers();
  };
};
