import { Pool } from "pg";

console.log("Database configuration:");
console.log("DATABASE_URL:", process.env.DATABASE_URL ? "Set" : "Not set");
console.log("NODE_ENV:", process.env.NODE_ENV);

// Create a new pool using the DATABASE_URL environment variable
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
  // Performance optimizations
  max: 20, // Increase max connections
  min: 2, // Keep minimum connections ready
  idleTimeoutMillis: 30000, // Keep connections alive longer
  connectionTimeoutMillis: 2000, // Faster connection timeout
});

console.log("Database pool created");

// Test the connection
pool.on("connect", (_client) => {
  console.log("Connected to the database");
  console.log("Client connected successfully");
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle client", err);
  console.error("Error stack:", err.stack);
  process.exit(-1);
});

// Initialize database tables
export async function initializeDatabase() {
  try {
    // Create Cases table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "Cases" (
        id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        name TEXT NOT NULL,
        description VARCHAR(500) NOT NULL,
        model TEXT
      );
    `);

    // Create Fields table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "Fields" (
        id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        "primary" BOOLEAN NOT NULL DEFAULT false,
        caseid INTEGER NOT NULL,
        label TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        "order" INTEGER NOT NULL DEFAULT 0,
        options TEXT NOT NULL DEFAULT '[]',
        required BOOLEAN NOT NULL DEFAULT false,
        "defaultValue" TEXT,
        CONSTRAINT fields_name_caseid_unique UNIQUE (name, caseid)
      );
    `);

    // Create foreign key for Fields if it doesn't exist
    try {
      await pool.query(`
        ALTER TABLE "Fields"
        ADD CONSTRAINT IF NOT EXISTS fields_caseid_fkey
        FOREIGN KEY (caseid) REFERENCES "Cases" (id);
      `);
    } catch (_error) {
      console.log(
        "Foreign key fields_caseid_fkey may already exist, continuing...",
      );
    }

    // Create index for Fields caseID if it doesn't exist
    try {
      await pool.query(`
        CREATE INDEX IF NOT EXISTS fields_caseid_idx ON "Fields" (caseid);
      `);
    } catch (_error) {
      console.log("Index fields_caseid_idx may already exist, continuing...");
    }

    // Create Views table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "Views" (
        id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        name TEXT,
        model TEXT,
        caseid INTEGER
      );
    `);

    // Create foreign key for Views if it doesn't exist
    try {
      await pool.query(`
        ALTER TABLE "Views"
        ADD CONSTRAINT IF NOT EXISTS views_caseid_fkey
        FOREIGN KEY (caseid) REFERENCES "Cases" (id);
      `);
    } catch (_error) {
      console.log(
        "Foreign key views_caseid_fkey may already exist, continuing...",
      );
    }

    // Create index for Views caseID if it doesn't exist
    try {
      await pool.query(`
        CREATE INDEX IF NOT EXISTS views_caseid_idx ON "Views" (caseid);
      `);
    } catch (_error) {
      console.log("Index views_caseid_idx may already exist, continuing...");
    }

    console.log("Database tables initialized successfully");
  } catch (error) {
    console.error("Error initializing database tables:", error);
    throw error;
  }
}

// Drop all tables and recreate schema
export async function resetDatabase() {
  try {
    // First, check what tables exist
    const existingTables = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE';
    `);
    console.log("Existing tables before drop:", existingTables.rows);

    // Drop tables in correct order (due to foreign key constraints)
    console.log("Dropping tables...");
    await pool.query(`
      DROP TABLE IF EXISTS "Views" CASCADE;
      DROP TABLE IF EXISTS "Fields" CASCADE;
      DROP TABLE IF EXISTS "Cases" CASCADE;
    `);

    // Verify tables were dropped
    const tablesAfterDrop = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE';
    `);
    console.log("Tables after drop:", tablesAfterDrop.rows);

    console.log("All tables dropped successfully");

    // Reinitialize the database
    await initializeDatabase();

    // Verify tables were recreated
    const tablesAfterInit = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE';
    `);
    console.log("Tables after initialization:", tablesAfterInit.rows);

    console.log("Database reset completed successfully");
  } catch (error) {
    console.error("Error resetting database:", error);
    throw error;
  }
}
