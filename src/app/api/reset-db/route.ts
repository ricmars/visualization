import { NextResponse } from "next/server";
import { resetDatabase } from "../../lib/db";
import { pool } from "../../lib/db";

export async function POST() {
  try {
    // Get tables before reset
    const beforeReset = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE';
    `);

    await resetDatabase();

    // Get tables after reset
    const afterReset = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE';
    `);

    return NextResponse.json({
      message: "Database reset completed",
      beforeReset: beforeReset.rows,
      afterReset: afterReset.rows,
    });
  } catch (error) {
    console.error("Error resetting database:", error);
    return NextResponse.json(
      {
        error: "Failed to reset database",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
