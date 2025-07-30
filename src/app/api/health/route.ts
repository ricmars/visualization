import { NextResponse } from "next/server";
import { checkDatabaseConnection, pool } from "../../lib/db";

export async function GET() {
  try {
    const dbStatus = await checkDatabaseConnection();

    // Get pool statistics
    const poolStats = {
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount,
    };

    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      database: dbStatus,
      pool: poolStats,
      environment: {
        nodeEnv: process.env.NODE_ENV,
        hasDatabaseUrl: !!process.env.DATABASE_URL,
        databaseUrlPreview: process.env.DATABASE_URL
          ? `${
              process.env.DATABASE_URL.split("@")[1]?.split("/")[0] || "unknown"
            }`
          : "not set",
      },
    });
  } catch (error) {
    console.error("Health check failed:", error);
    return NextResponse.json(
      {
        status: "error",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
