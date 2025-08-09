import { NextRequest, NextResponse } from "next/server";
import { DB_TABLES } from "@/app/types/database";
import { dynamicDatabaseService } from "@/app/lib/dynamicDatabaseService";
import { registerRuleTypes } from "@/app/types/ruleTypeDefinitions";

// This route now acts as a compatibility layer that delegates to the dynamic API
// It maintains backward compatibility with existing frontend code
// Ensure rule types are registered when this route is first loaded
registerRuleTypes();

export async function GET(request: NextRequest) {
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

    const tableToRuleType: Record<string, string> = {
      [DB_TABLES.CASES]: "case",
      [DB_TABLES.FIELDS]: "field",
      [DB_TABLES.VIEWS]: "view",
    };

    const ruleTypeId = tableToRuleType[table];
    if (!ruleTypeId) {
      return NextResponse.json({ error: "Unsupported table" }, { status: 400 });
    }

    // Build filters and options (mirror /api/dynamic behavior)
    const filters: Record<string, any> = {};
    for (const [key, value] of searchParams.entries()) {
      if (!["table", "id"].includes(key)) {
        const numValue = Number(value);
        filters[key] = isNaN(numValue) ? value : numValue;
      }
    }

    const limit = searchParams.get("limit");
    const offset = searchParams.get("offset");
    const orderBy = searchParams.get("orderBy");
    const orderDirection = searchParams.get("orderDirection");
    const options: any = {};
    if (limit) options.limit = Number(limit);
    if (offset) options.offset = Number(offset);
    if (orderBy) options.orderBy = orderBy;
    if (orderDirection) options.orderDirection = orderDirection;

    const operation = {
      operation: (id ? "read" : "list") as "read" | "list",
      ruleTypeId,
      id: id ? Number(id) : undefined,
      filters: Object.keys(filters).length ? filters : undefined,
      options: Object.keys(options).length ? options : undefined,
    };

    const result = await dynamicDatabaseService.execute(operation as any);

    if (result.success) {
      return NextResponse.json(
        {
          success: true,
          data: result.data,
          affectedRows: result.affectedRows,
        },
        { status: 200 },
      );
    }

    return NextResponse.json(
      { success: false, error: result.error },
      { status: 400 },
    );
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

    const tableToRuleType: Record<string, string> = {
      [DB_TABLES.CASES]: "case",
      [DB_TABLES.FIELDS]: "field",
      [DB_TABLES.VIEWS]: "view",
    };

    const ruleTypeId = tableToRuleType[table];
    if (!ruleTypeId) {
      return NextResponse.json({ error: "Unsupported table" }, { status: 400 });
    }

    const requestBody = await request.json();
    const data = requestBody.data || requestBody;

    const result = await dynamicDatabaseService.execute({
      operation: "create",
      ruleTypeId,
      data,
    } as any);

    if (result.success) {
      return NextResponse.json(
        { success: true, data: result.data, affectedRows: result.affectedRows },
        { status: 200 },
      );
    }
    return NextResponse.json(
      { success: false, error: result.error },
      { status: 400 },
    );
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

    const tableToRuleType: Record<string, string> = {
      [DB_TABLES.CASES]: "case",
      [DB_TABLES.FIELDS]: "field",
      [DB_TABLES.VIEWS]: "view",
    };

    const ruleTypeId = tableToRuleType[table];
    if (!ruleTypeId) {
      return NextResponse.json({ error: "Unsupported table" }, { status: 400 });
    }

    const requestBody = await request.json();
    const data = requestBody.data || requestBody;

    const result = await dynamicDatabaseService.execute({
      operation: "update",
      ruleTypeId,
      id: Number(id),
      data,
    } as any);

    if (result.success) {
      return NextResponse.json(
        { success: true, data: result.data, affectedRows: result.affectedRows },
        { status: 200 },
      );
    }
    return NextResponse.json(
      { success: false, error: result.error },
      { status: 400 },
    );
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

    const tableToRuleType: Record<string, string> = {
      [DB_TABLES.CASES]: "case",
      [DB_TABLES.FIELDS]: "field",
      [DB_TABLES.VIEWS]: "view",
    };

    const ruleTypeId = tableToRuleType[table];
    if (!ruleTypeId) {
      return NextResponse.json({ error: "Unsupported table" }, { status: 400 });
    }

    const result = await dynamicDatabaseService.execute({
      operation: "delete",
      ruleTypeId,
      id: Number(id),
    } as any);

    if (result.success) {
      return NextResponse.json(
        { success: true, data: result.data, affectedRows: result.affectedRows },
        { status: 200 },
      );
    }
    return NextResponse.json(
      { success: false, error: result.error },
      { status: 400 },
    );
  } catch (error) {
    console.error("Error in database API:", error);
    return NextResponse.json(
      { error: "Failed to delete data" },
      { status: 500 },
    );
  }
}
