import { NextRequest, NextResponse } from "next/server";
import { checkpointSessionManager } from "../../../lib/checkpointTools";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const caseid = searchParams.get("caseid");
    const caseIdNum = caseid ? parseInt(caseid) : undefined;

    const history = await checkpointSessionManager.getCheckpointHistory(
      caseIdNum,
    );

    return NextResponse.json({
      history: history.map((checkpoint) => ({
        ...checkpoint,
        created_at: checkpoint.created_at.toISOString(),
        finished_at: checkpoint.finished_at?.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Error fetching checkpoint history:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch checkpoint history",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
