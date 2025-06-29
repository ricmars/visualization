import { NextResponse } from "next/server";
import { pool } from "../../lib/db";
import { DB_TABLES } from "../../types/database";

export async function GET(request: Request) {
  console.log("=== Debug endpoint called ===");

  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    console.log("Debug action:", action);

    switch (action) {
      case "cases":
        // Get all cases with their basic info
        const casesQuery = `SELECT id, name, description, created_at, updated_at FROM "${DB_TABLES.CASES}" ORDER BY created_at DESC`;
        const casesResult = await pool.query(casesQuery);

        console.log(`Found ${casesResult.rowCount} cases`);

        return NextResponse.json({
          success: true,
          data: {
            cases: casesResult.rows,
            count: casesResult.rowCount,
          },
        });

      case "case":
        // Get specific case with full details
        const caseId = searchParams.get("id");
        if (!caseId) {
          return NextResponse.json(
            { error: "Case ID required" },
            { status: 400 },
          );
        }

        const caseQuery = `SELECT * FROM "${DB_TABLES.CASES}" WHERE id = $1`;
        const caseResult = await pool.query(caseQuery, [caseId]);

        if (caseResult.rowCount === 0) {
          return NextResponse.json(
            { error: "Case not found" },
            { status: 404 },
          );
        }

        const caseData = caseResult.rows[0];
        const model = JSON.parse(caseData.model);

        // Get fields for this case
        const fieldsQuery = `SELECT * FROM "${DB_TABLES.FIELDS}" WHERE caseid = $1 ORDER BY "order"`;
        const fieldsResult = await pool.query(fieldsQuery, [caseId]);

        // Get views for this case
        const viewsQuery = `SELECT * FROM "${DB_TABLES.VIEWS}" WHERE caseid = $1 ORDER BY "order"`;
        const viewsResult = await pool.query(viewsQuery, [caseId]);

        console.log(`Case ${caseId} details:`, {
          fields: fieldsResult.rowCount,
          views: viewsResult.rowCount,
          stages: model.stages?.length || 0,
        });

        return NextResponse.json({
          success: true,
          data: {
            case: caseData,
            model: model,
            fields: fieldsResult.rows,
            views: viewsResult.rows,
            summary: {
              fieldCount: fieldsResult.rowCount,
              viewCount: viewsResult.rowCount,
              stageCount: model.stages?.length || 0,
              totalSteps:
                model.stages?.reduce(
                  (acc: number, stage: any) =>
                    acc +
                    (stage.processes?.reduce(
                      (pAcc: number, process: any) =>
                        pAcc + (process.steps?.length || 0),
                      0,
                    ) || 0),
                  0,
                ) || 0,
            },
          },
        });

      case "fields":
        // Get all fields
        const allFieldsQuery = `SELECT f.*, c.name as case_name FROM "${DB_TABLES.FIELDS}" f
                               JOIN "${DB_TABLES.CASES}" c ON f.caseid = c.id
                               ORDER BY f.caseid, f."order"`;
        const allFieldsResult = await pool.query(allFieldsQuery);

        console.log(
          `Found ${allFieldsResult.rowCount} fields across all cases`,
        );

        return NextResponse.json({
          success: true,
          data: {
            fields: allFieldsResult.rows,
            count: allFieldsResult.rowCount,
          },
        });

      case "views":
        // Get all views
        const allViewsQuery = `SELECT v.*, c.name as case_name FROM "${DB_TABLES.VIEWS}" v
                              JOIN "${DB_TABLES.CASES}" c ON v.caseid = c.id
                              ORDER BY v.caseid, v."order"`;
        const allViewsResult = await pool.query(allViewsQuery);

        console.log(`Found ${allViewsResult.rowCount} views across all cases`);

        return NextResponse.json({
          success: true,
          data: {
            views: allViewsResult.rows,
            count: allViewsResult.rowCount,
          },
        });

      case "stats":
        // Get overall statistics
        const statsQuery = `
          SELECT
            (SELECT COUNT(*) FROM "${DB_TABLES.CASES}") as case_count,
            (SELECT COUNT(*) FROM "${DB_TABLES.FIELDS}") as field_count,
            (SELECT COUNT(*) FROM "${DB_TABLES.VIEWS}") as view_count
        `;
        const statsResult = await pool.query(statsQuery);

        console.log("Database stats:", statsResult.rows[0]);

        return NextResponse.json({
          success: true,
          data: statsResult.rows[0],
        });

      default:
        return NextResponse.json(
          {
            error:
              "Invalid action. Valid actions: cases, case, fields, views, stats",
            usage: {
              cases: "/api/debug?action=cases",
              case: "/api/debug?action=case&id=123",
              fields: "/api/debug?action=fields",
              views: "/api/debug?action=views",
              stats: "/api/debug?action=stats",
            },
          },
          { status: 400 },
        );
    }
  } catch (error) {
    console.error("Debug endpoint error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
