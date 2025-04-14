import { NextResponse } from "next/server";
import { Pool } from "pg";
import getConfig from "next/config";

const { serverRuntimeConfig } = getConfig();

const pool = new Pool({
  connectionString: serverRuntimeConfig.DATABASE_URL,
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const table = searchParams.get("table");

    if (!table || !["fields", "views"].includes(table)) {
      return NextResponse.json(
        { error: "Invalid table parameter" },
        { status: 400 },
      );
    }

    const query = `SELECT * FROM "${table === "fields" ? "Fields" : "Views"}"`;
    const result = await pool.query(query);

    return NextResponse.json({ data: result.rows });
  } catch (error) {
    console.error("Database error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
