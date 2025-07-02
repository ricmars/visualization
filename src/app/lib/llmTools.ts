import { Pool } from "pg";

import { createSharedTools, convertToLLMTools } from "./sharedTools";

// Use shared tools to avoid duplication
export function getDatabaseTools(pool: Pool) {
  const sharedTools = createSharedTools(pool);
  return convertToLLMTools(sharedTools);
}
