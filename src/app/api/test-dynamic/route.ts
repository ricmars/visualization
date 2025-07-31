import { NextResponse } from "next/server";
import { ruleTypeRegistry } from "../../types/ruleTypeRegistry";
import { registerRuleTypes } from "../../types/ruleTypeDefinitions";
import { dynamicDatabaseService } from "../../lib/dynamicDatabaseService";

// Initialize all rule types
registerRuleTypes();

export async function GET() {
  try {
    // Get all registered rule types
    const ruleTypes = ruleTypeRegistry.getAll();

    // Generate some example outputs
    const migrations = await dynamicDatabaseService.generateMigrations();
    const types = ruleTypeRegistry.generateTypeScriptTypes();
    const validation = ruleTypeRegistry.generateValidationFunctions();

    return NextResponse.json({
      success: true,
      data: {
        registeredRuleTypes: ruleTypes.map((rt) => ({
          id: rt.id,
          name: rt.name,
          description: rt.description,
          category: rt.category,
          version: rt.version,
        })),
        totalRuleTypes: ruleTypes.length,
        categories: [...new Set(ruleTypes.map((rt) => rt.category))],
        migrations: migrations.substring(0, 1000) + "...", // Truncated for display
        types: types.substring(0, 1000) + "...", // Truncated for display
        validation: validation.substring(0, 1000) + "...", // Truncated for display
      },
    });
  } catch (error) {
    console.error("Test dynamic API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function POST() {
  try {
    // Test creating a case using the dynamic system
    const caseData = {
      name: "Test Case from Dynamic System",
      description:
        "This case was created using the new dynamic rule type system",
      model: JSON.stringify({
        stages: [
          {
            id: 1,
            name: "Initial Stage",
            order: 1,
            processes: [
              {
                id: 1,
                name: "Initial Process",
                order: 1,
                steps: [
                  {
                    id: 1,
                    type: "Collect information",
                    name: "Collect Initial Data",
                    order: 1,
                  },
                ],
              },
            ],
          },
        ],
      }),
    };

    const result = await dynamicDatabaseService.execute({
      operation: "create",
      ruleTypeId: "case",
      data: caseData,
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: "Successfully created test case using dynamic system",
        data: result.data,
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
    console.error("Test dynamic creation error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
