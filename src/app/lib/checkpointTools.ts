import { Pool } from "pg";
import { checkpointManager } from "./db";
import { DB_TABLES } from "../types/database";
import { createSharedTools, SharedTool } from "./sharedTools";

// Thread-local storage for current checkpoint and case context
let currentCheckpointId: string | null = null;
let currentCaseId: number | null = null;

export function setCurrentCheckpoint(checkpointId: string | null) {
  currentCheckpointId = checkpointId;
  console.log("Set current checkpoint:", checkpointId);
}

export function getCurrentCheckpoint(): string | null {
  return currentCheckpointId;
}

export function setCurrentCaseId(caseId: number | null) {
  currentCaseId = caseId;
  console.log("Set current case ID:", caseId);
}

export function getCurrentCaseId(): number | null {
  return currentCaseId;
}

// Wrapper for database operations to capture changes
export async function captureOperation(
  operation: "insert" | "update" | "delete",
  tableName: string,
  primaryKey: unknown,
  previousData?: unknown,
): Promise<void> {
  if (!currentCheckpointId) {
    console.log("No active checkpoint, skipping operation capture");
    return;
  }

  if (!currentCaseId) {
    console.warn("No case ID in context for operation capture, skipping");
    return;
  }

  console.log(`Capturing ${operation} on ${tableName}:`, {
    primaryKey,
    previousData,
    caseid: currentCaseId,
  });

  await checkpointManager.logOperation(
    currentCheckpointId,
    currentCaseId,
    operation,
    tableName,
    primaryKey,
    previousData,
  );
}

// Enhanced database query function that captures changes
export async function executeWithCapture(
  pool: Pool,
  query: string,
  values: any[],
  operation: "insert" | "update" | "delete",
  tableName: string,
  primaryKey?: any,
): Promise<any> {
  // For updates and deletes, we need to capture the current state first
  let previousData = null;
  if ((operation === "update" || operation === "delete") && primaryKey) {
    try {
      const selectQuery = `SELECT * FROM "${tableName}" WHERE id = $1`;
      const selectResult = await pool.query(selectQuery, [primaryKey]);
      previousData = selectResult.rows[0] || null;
      console.log(`Captured previous data for ${operation}:`, previousData);
    } catch (error) {
      console.warn(`Could not capture previous data for ${operation}:`, error);
    }
  }

  // Execute the main operation
  const result = await pool.query(query, values);

  // Capture the operation for rollback
  if (operation === "insert" && result.rows[0]) {
    // For inserts, use the returned ID as primary key
    await captureOperation(operation, tableName, { id: result.rows[0].id });
  } else if (primaryKey) {
    await captureOperation(
      operation,
      tableName,
      { id: primaryKey },
      previousData,
    );
  }

  return result;
}

// Create checkpoint-aware tools
export function createCheckpointTools(pool: Pool) {
  const originalTools = createSharedTools(pool);

  return originalTools.map((tool) => {
    // Wrap each tool's execute function
    const originalExecute = tool.execute;

    return {
      ...tool,
      execute: async (params: any) => {
        console.log(`Executing checkpoint-aware tool: ${tool.name}`);

        // For database modification tools, wrap their operations
        if (
          [
            "saveFields",
            "saveCase",
            "saveView",
            "deleteField",
            "deleteView",
            "createCase",
          ].includes(tool.name)
        ) {
          return await executeCheckpointAwareTool(
            tool.name,
            originalExecute,
            params,
            pool,
          );
        }

        // For read-only tools, execute normally
        return await originalExecute(params);
      },
    };
  });
}

async function executeCheckpointAwareTool(
  toolName: string,
  originalExecute: (params: any) => Promise<any>,
  params: any,
  pool: Pool,
): Promise<any> {
  // Record tool execution
  const currentCheckpoint = getCurrentCheckpoint();
  if (currentCheckpoint) {
    try {
      await checkpointManager.recordToolExecution(currentCheckpoint, toolName);
    } catch (error) {
      console.warn("Failed to record tool execution:", error);
    }
  }

  switch (toolName) {
    case "createCase":
      return await wrapCreateCase(originalExecute, params, pool);

    case "saveFields":
      return await wrapSaveFields(originalExecute, params, pool);

    case "saveView":
      return await wrapSaveView(originalExecute, params, pool);

    case "saveCase":
      return await wrapSaveCase(originalExecute, params, pool);

    case "deleteField":
    case "deleteView":
      return await wrapDelete(originalExecute, params, pool, toolName);

    default:
      return await originalExecute(params);
  }
}

async function wrapCreateCase(originalExecute: any, params: any, _pool: Pool) {
  console.log("Wrapping createCase with checkpoint capture");

  const result = await originalExecute(params);

  // Capture the insert operation
  if (result.id) {
    await captureOperation("insert", DB_TABLES.CASES, { id: result.id });
  }

  return result;
}

async function wrapSaveFields(originalExecute: any, params: any, _pool: Pool) {
  console.log("Wrapping saveFields with checkpoint capture");

  // Note: saveFields is complex as it can insert multiple fields
  // We'll let the original function execute and then capture based on returned IDs
  const result = await originalExecute(params);

  // Capture insert operations for all created fields
  if (result.ids && Array.isArray(result.ids)) {
    for (const fieldId of result.ids) {
      await captureOperation("insert", DB_TABLES.FIELDS, { id: fieldId });
    }
  }

  return result;
}

async function wrapSaveView(originalExecute: any, params: any, _pool: Pool) {
  console.log("Wrapping saveView with checkpoint capture");

  const result = await originalExecute(params);

  // Capture the insert operation
  if (result.id) {
    await captureOperation("insert", DB_TABLES.VIEWS, { id: result.id });
  }

  return result;
}

async function wrapSaveCase(originalExecute: any, params: any, pool: Pool) {
  console.log("Wrapping saveCase with checkpoint capture");

  // For saveCase, we need to capture the previous state before updating
  const caseId = params.id;
  let previousData = null;

  if (caseId) {
    try {
      const selectResult = await pool.query(
        `SELECT * FROM "${DB_TABLES.CASES}" WHERE id = $1`,
        [caseId],
      );
      previousData = selectResult.rows[0] || null;
    } catch (error) {
      console.warn("Could not capture previous case data:", error);
    }
  }

  const result = await originalExecute(params);

  // Capture the update operation
  if (caseId && previousData) {
    await captureOperation(
      "update",
      DB_TABLES.CASES,
      { id: caseId },
      previousData,
    );
  }

  return result;
}

async function wrapDelete(
  originalExecute: any,
  params: any,
  pool: Pool,
  toolName: string,
) {
  console.log(`Wrapping ${toolName} with checkpoint capture`);

  const tableName =
    toolName === "deleteField" ? DB_TABLES.FIELDS : DB_TABLES.VIEWS;
  const itemId = params.id;

  // Capture current state before deletion
  let previousData = null;
  if (itemId) {
    try {
      const selectResult = await pool.query(
        `SELECT * FROM "${tableName}" WHERE id = $1`,
        [itemId],
      );
      previousData = selectResult.rows[0] || null;
    } catch (error) {
      console.warn(`Could not capture previous data for ${toolName}:`, error);
    }
  }

  const result = await originalExecute(params);

  // Capture the delete operation
  if (itemId && previousData) {
    await captureOperation("delete", tableName, { id: itemId }, previousData);
  }

  return result;
}

// Checkpoint session management
export interface CheckpointSession {
  id: string;
  description: string;
  startedAt: Date;
}

export class CheckpointSessionManager {
  private activeSession: CheckpointSession | null = null;

  async beginSession(
    caseid: number,
    description?: string,
    userCommand?: string,
    source = "LLM",
  ): Promise<CheckpointSession> {
    if (this.activeSession) {
      console.warn("Starting new checkpoint session while another is active");
      await this.rollbackSession(); // Clean up previous session
    }

    const checkpointId = await checkpointManager.beginCheckpoint(
      caseid,
      description,
      userCommand,
      source,
    );
    setCurrentCheckpoint(checkpointId);
    setCurrentCaseId(caseid);

    this.activeSession = {
      id: checkpointId,
      description: description || "LLM Tool Execution",
      startedAt: new Date(),
    };

    console.log("Started checkpoint session:", this.activeSession);
    return this.activeSession;
  }

  async commitSession(): Promise<void> {
    if (!this.activeSession) {
      console.warn("No active checkpoint session to commit");
      return;
    }

    await checkpointManager.commitCheckpoint(this.activeSession.id);
    setCurrentCheckpoint(null);
    setCurrentCaseId(null);

    console.log("Committed checkpoint session:", this.activeSession.id);
    this.activeSession = null;
  }

  async rollbackSession(): Promise<void> {
    if (!this.activeSession) {
      console.warn("No active checkpoint session to rollback");
      return;
    }

    await checkpointManager.rollbackCheckpoint(this.activeSession.id);
    setCurrentCheckpoint(null);
    setCurrentCaseId(null);

    console.log("Rolled back checkpoint session:", this.activeSession.id);
    this.activeSession = null;
  }

  getActiveSession(): CheckpointSession | null {
    return this.activeSession;
  }

  async getActiveCheckpoints(caseid?: number) {
    return await checkpointManager.getActiveCheckpoints(caseid);
  }

  async restoreToCheckpoint(checkpointId: string): Promise<void> {
    // If there's an active session, rollback first
    if (this.activeSession) {
      await this.rollbackSession();
    }

    // Restore to the specified checkpoint
    await checkpointManager.restoreToCheckpoint(checkpointId);
    console.log("Restored to checkpoint:", checkpointId);
  }

  async getCheckpointHistory(caseid?: number) {
    return await checkpointManager.getCheckpointHistory(caseid);
  }

  async deleteCheckpoint(checkpointId: string): Promise<void> {
    await checkpointManager.deleteCheckpoint(checkpointId);
    console.log("Deleted checkpoint:", checkpointId);
  }

  async deleteAllCheckpoints(caseid?: number): Promise<void> {
    await checkpointManager.deleteAllCheckpoints(caseid);
    if (caseid !== undefined) {
      console.log(`Deleted all checkpoints for case ${caseid}`);
    } else {
      console.log("Deleted all checkpoints");
    }
  }
}

export const checkpointSessionManager = new CheckpointSessionManager();

// Create checkpoint-aware shared tools
export function createCheckpointSharedTools(pool: Pool) {
  const sharedTools = createSharedTools(pool);
  return sharedTools.map((tool) => createCheckpointWrapper(tool, pool));
}

// Convert shared tools to LLM tools format (same as in llmTools.ts)
export function convertToLLMTools(sharedTools: SharedTool<any, any>[]) {
  return sharedTools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
    execute: tool.execute,
  }));
}

// Create a checkpoint wrapper for a single tool
export function createCheckpointWrapper(
  tool: SharedTool<any, any>,
  pool: Pool,
) {
  // Only wrap database modification tools
  const modificationTools = [
    "saveFields",
    "saveCase",
    "saveView",
    "deleteField",
    "deleteView",
    "createCase",
  ];

  if (!modificationTools.includes(tool.name)) {
    // Return read-only tools unchanged
    return tool;
  }

  return {
    ...tool,
    execute: async (params: any) => {
      console.log(`Executing checkpoint-aware tool: ${tool.name}`);
      return await executeCheckpointAwareTool(
        tool.name,
        tool.execute,
        params,
        pool,
      );
    },
  };
}
