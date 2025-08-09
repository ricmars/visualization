import { NextRequest, NextResponse } from "next/server";
import { dynamicDatabaseService } from "../../lib/dynamicDatabaseService";
import { pool } from "../../lib/db";
import { createSharedTools } from "../../lib/sharedTools";
import { ruleTypeRegistry } from "../../types/ruleTypeRegistry";
import { registerRuleTypes } from "../../types/ruleTypeDefinitions";

// Initialize rule types on module load
registerRuleTypes();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ruleTypeId = searchParams.get("ruleType");
    const id = searchParams.get("id");
    const action = searchParams.get("action");

    // Handle special actions
    if (action === "list-rule-types") {
      const ruleTypes = ruleTypeRegistry.getAll().map((rt) => ({
        id: rt.id,
        name: rt.name,
        description: rt.description,
        category: rt.category,
        version: rt.version,
      }));

      return NextResponse.json({
        success: true,
        data: ruleTypes,
      });
    }

    if (action === "generate-migration") {
      const migration = await dynamicDatabaseService.generateMigrations();
      return NextResponse.json({
        success: true,
        data: { migration },
      });
    }

    if (action === "generate-types") {
      const types = ruleTypeRegistry.generateTypeScriptTypes();
      return NextResponse.json({
        success: true,
        data: { types },
      });
    }

    if (action === "generate-validation") {
      const validation = ruleTypeRegistry.generateValidationFunctions();
      return NextResponse.json({
        success: true,
        data: { validation },
      });
    }

    // Handle regular CRUD operations
    if (!ruleTypeId) {
      return NextResponse.json(
        {
          success: false,
          error: "ruleType parameter is required",
        },
        { status: 400 },
      );
    }

    // Build filters from query parameters
    const filters: Record<string, any> = {};
    for (const [key, value] of searchParams.entries()) {
      if (!["ruleType", "id", "action"].includes(key)) {
        // Try to parse as number if it looks like a number
        const numValue = Number(value);
        filters[key] = isNaN(numValue) ? value : numValue;
      }
    }

    // Build options
    const options: any = {};
    const limit = searchParams.get("limit");
    const offset = searchParams.get("offset");
    const orderBy = searchParams.get("orderBy");
    const orderDirection = searchParams.get("orderDirection");

    if (limit) options.limit = Number(limit);
    if (offset) options.offset = Number(offset);
    if (orderBy) options.orderBy = orderBy;
    if (orderDirection) options.orderDirection = orderDirection;

    // Execute operation
    const operation = {
      operation: (id ? "read" : "list") as "read" | "list",
      ruleTypeId,
      id: id ? Number(id) : undefined,
      filters: Object.keys(filters).length > 0 ? filters : undefined,
      options: Object.keys(options).length > 0 ? options : undefined,
    };

    const result = await dynamicDatabaseService.execute(operation);

    if (result.success) {
      return NextResponse.json({
        success: true,
        data: result.data,
        affectedRows: result.affectedRows,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
        },
        { status: 400 },
      );
    }
  } catch (error) {
    console.error("Dynamic API GET error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { ruleType, data } = body;

    if (!ruleType) {
      return NextResponse.json(
        {
          success: false,
          error: "ruleType is required in request body",
        },
        { status: 400 },
      );
    }

    if (!data) {
      return NextResponse.json(
        {
          success: false,
          error: "data is required in request body",
        },
        { status: 400 },
      );
    }

    const operation = {
      operation: "create" as const,
      ruleTypeId: ruleType,
      data,
    };

    const result = await dynamicDatabaseService.execute(operation);

    if (result.success) {
      return NextResponse.json({
        success: true,
        data: result.data,
        affectedRows: result.affectedRows,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
        },
        { status: 400 },
      );
    }
  } catch (error) {
    console.error("Dynamic API POST error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { ruleType, id, data } = body;

    if (!ruleType) {
      return NextResponse.json(
        {
          success: false,
          error: "ruleType is required in request body",
        },
        { status: 400 },
      );
    }

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: "id is required in request body",
        },
        { status: 400 },
      );
    }

    if (!data) {
      return NextResponse.json(
        {
          success: false,
          error: "data is required in request body",
        },
        { status: 400 },
      );
    }

    const operation = {
      operation: "update" as const,
      ruleTypeId: ruleType,
      id: Number(id),
      data,
    };

    const result = await dynamicDatabaseService.execute(operation);

    if (result.success) {
      return NextResponse.json({
        success: true,
        data: result.data,
        affectedRows: result.affectedRows,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
        },
        { status: 400 },
      );
    }
  } catch (error) {
    console.error("Dynamic API PUT error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const ruleTypeId = searchParams.get("ruleType");
    const id = searchParams.get("id");

    if (!ruleTypeId) {
      return NextResponse.json(
        {
          success: false,
          error: "ruleType parameter is required",
        },
        { status: 400 },
      );
    }

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: "id parameter is required",
        },
        { status: 400 },
      );
    }

    // Special-case: delete a case with cascading cleanup using shared tool
    if (ruleTypeId === "case") {
      const tools = createSharedTools(pool);
      const deleteCaseTool = tools.find((t) => t.name === "deleteCase");
      if (!deleteCaseTool) {
        return NextResponse.json(
          { success: false, error: "deleteCase tool not available" },
          { status: 500 },
        );
      }
      try {
        const toolResult = await deleteCaseTool.execute({ id: Number(id) });
        return NextResponse.json(
          { success: true, data: toolResult },
          { status: 200 },
        );
      } catch (e) {
        return NextResponse.json(
          { success: false, error: e instanceof Error ? e.message : String(e) },
          { status: 400 },
        );
      }
    }

    const operation = {
      operation: "delete" as const,
      ruleTypeId,
      id: Number(id),
    };

    const result = await dynamicDatabaseService.execute(operation);

    if (result.success) {
      return NextResponse.json({
        success: true,
        data: result.data,
        affectedRows: result.affectedRows,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
        },
        { status: 400 },
      );
    }
  } catch (error) {
    console.error("Dynamic API DELETE error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
