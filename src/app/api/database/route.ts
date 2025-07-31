import { NextRequest, NextResponse } from "next/server";
import { DB_TABLES } from "@/app/types/database";

// This route now acts as a compatibility layer that delegates to the dynamic API
// It maintains backward compatibility with existing frontend code

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const table = searchParams.get("table");
    const id = searchParams.get("id");
    const caseID = searchParams.get("caseID");

    if (!table || !Object.values(DB_TABLES).includes(table as any)) {
      return NextResponse.json(
        { error: "Invalid table parameter" },
        { status: 400 },
      );
    }

    // Map table names to rule type IDs
    const tableToRuleType: Record<string, string> = {
      [DB_TABLES.CASES]: "case",
      [DB_TABLES.FIELDS]: "field",
      [DB_TABLES.VIEWS]: "view",
    };

    const ruleType = tableToRuleType[table];
    if (!ruleType) {
      return NextResponse.json({ error: "Unsupported table" }, { status: 400 });
    }

    // Build the dynamic API URL
    const dynamicUrl = new URL("/api/dynamic", request.url);
    dynamicUrl.searchParams.set("ruleType", ruleType);
    if (id) {
      dynamicUrl.searchParams.set("id", id);
    }
    if (caseID) {
      dynamicUrl.searchParams.set("caseID", caseID);
    }

    // Forward the request to the dynamic API
    const response = await fetch(dynamicUrl.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const result = await response.json();
    return NextResponse.json(result, { status: response.status });
  } catch (error) {
    console.error("Error in database API:", error);
    return NextResponse.json(
      { error: "Failed to fetch data" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const table = searchParams.get("table");

    if (!table || !Object.values(DB_TABLES).includes(table as any)) {
      return NextResponse.json(
        { error: "Invalid table parameter" },
        { status: 400 },
      );
    }

    // Map table names to rule type IDs
    const tableToRuleType: Record<string, string> = {
      [DB_TABLES.CASES]: "case",
      [DB_TABLES.FIELDS]: "field",
      [DB_TABLES.VIEWS]: "view",
    };

    const ruleType = tableToRuleType[table];
    if (!ruleType) {
      return NextResponse.json({ error: "Unsupported table" }, { status: 400 });
    }

    const data = await request.json();

    // Build the dynamic API URL
    const dynamicUrl = new URL("/api/dynamic", request.url);
    dynamicUrl.searchParams.set("ruleType", ruleType);

    // Forward the request to the dynamic API
    const response = await fetch(dynamicUrl.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();
    return NextResponse.json(result, { status: response.status });
  } catch (error) {
    console.error("Error in database API:", error);
    return NextResponse.json(
      { error: "Failed to create data" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const table = searchParams.get("table");
    const id = searchParams.get("id");

    if (!table || !Object.values(DB_TABLES).includes(table as any)) {
      return NextResponse.json(
        { error: "Invalid table parameter" },
        { status: 400 },
      );
    }

    if (!id) {
      return NextResponse.json(
        { error: "Missing id parameter" },
        { status: 400 },
      );
    }

    // Map table names to rule type IDs
    const tableToRuleType: Record<string, string> = {
      [DB_TABLES.CASES]: "case",
      [DB_TABLES.FIELDS]: "field",
      [DB_TABLES.VIEWS]: "view",
    };

    const ruleType = tableToRuleType[table];
    if (!ruleType) {
      return NextResponse.json({ error: "Unsupported table" }, { status: 400 });
    }

    const data = await request.json();

    // Build the dynamic API URL
    const dynamicUrl = new URL("/api/dynamic", request.url);
    dynamicUrl.searchParams.set("ruleType", ruleType);
    dynamicUrl.searchParams.set("id", id);

    // Forward the request to the dynamic API
    const response = await fetch(dynamicUrl.toString(), {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();
    return NextResponse.json(result, { status: response.status });
  } catch (error) {
    console.error("Error in database API:", error);
    return NextResponse.json(
      { error: "Failed to update data" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const table = searchParams.get("table");
    const id = searchParams.get("id");

    if (!table || !Object.values(DB_TABLES).includes(table as any)) {
      return NextResponse.json(
        { error: "Invalid table parameter" },
        { status: 400 },
      );
    }

    if (!id) {
      return NextResponse.json(
        { error: "Missing id parameter" },
        { status: 400 },
      );
    }

    // Map table names to rule type IDs
    const tableToRuleType: Record<string, string> = {
      [DB_TABLES.CASES]: "case",
      [DB_TABLES.FIELDS]: "field",
      [DB_TABLES.VIEWS]: "view",
    };

    const ruleType = tableToRuleType[table];
    if (!ruleType) {
      return NextResponse.json({ error: "Unsupported table" }, { status: 400 });
    }

    // Build the dynamic API URL
    const dynamicUrl = new URL("/api/dynamic", request.url);
    dynamicUrl.searchParams.set("ruleType", ruleType);
    dynamicUrl.searchParams.set("id", id);

    // Forward the request to the dynamic API
    const response = await fetch(dynamicUrl.toString(), {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const result = await response.json();
    return NextResponse.json(result, { status: response.status });
  } catch (error) {
    console.error("Error in database API:", error);
    return NextResponse.json(
      { error: "Failed to delete data" },
      { status: 500 },
    );
  }
}
