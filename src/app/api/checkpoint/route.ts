import { NextRequest, NextResponse } from "next/server";
import { checkpointSessionManager } from "../../lib/checkpointTools";

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    console.log("Checkpoint API request:", action);

    switch (action) {
      case "begin": {
        const { description, caseid } = await request.json();
        // Use provided caseid or default to 1
        const caseId = caseid || 1;
        const session = await checkpointSessionManager.beginSession(
          caseId,
          description,
        );

        return NextResponse.json({
          success: true,
          session: {
            id: session.id,
            description: session.description,
            startedAt: session.startedAt,
          },
        });
      }

      case "commit": {
        await checkpointSessionManager.commitSession();

        return NextResponse.json({
          success: true,
          message: "Checkpoint committed successfully",
        });
      }

      case "rollback": {
        await checkpointSessionManager.rollbackSession();

        return NextResponse.json({
          success: true,
          message: "Checkpoint rolled back successfully",
        });
      }

      case "restore": {
        const { checkpointId } = await request.json();
        if (!checkpointId) {
          return NextResponse.json(
            { error: "checkpointId is required for restore action" },
            { status: 400 },
          );
        }

        await checkpointSessionManager.restoreToCheckpoint(checkpointId);

        return NextResponse.json({
          success: true,
          message: "Successfully restored to checkpoint",
        });
      }

      case "delete": {
        const { checkpointId } = await request.json();
        if (!checkpointId) {
          return NextResponse.json(
            { error: "checkpointId is required for delete action" },
            { status: 400 },
          );
        }

        await checkpointSessionManager.deleteCheckpoint(checkpointId);

        return NextResponse.json({
          success: true,
          message: "Successfully deleted checkpoint",
        });
      }

      case "deleteAll": {
        const { caseid } = await request
          .json()
          .catch(() => ({ caseid: undefined }));
        const caseIdNum =
          typeof caseid === "number"
            ? caseid
            : caseid
            ? parseInt(caseid)
            : undefined;
        await checkpointSessionManager.deleteAllCheckpoints(caseIdNum);

        return NextResponse.json({
          success: true,
          message:
            caseIdNum !== undefined
              ? `Successfully deleted all checkpoints for case ${caseIdNum}`
              : "Successfully deleted all checkpoints",
        });
      }

      default:
        return NextResponse.json(
          {
            error:
              "Invalid action. Use: begin, commit, rollback, restore, delete, or deleteAll",
          },
          { status: 400 },
        );
    }
  } catch (error) {
    console.error("Checkpoint API error:", error);
    return NextResponse.json(
      {
        error: "Checkpoint operation failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const caseid = searchParams.get("caseid");
    const caseIdNum = caseid ? parseInt(caseid) : undefined;

    const activeSession = checkpointSessionManager.getActiveSession();
    const activeCheckpoints =
      await checkpointSessionManager.getActiveCheckpoints(caseIdNum);

    // Get additional details about checkpoints including source (LLM vs MCP)
    const checkpointDetails = activeCheckpoints.map((checkpoint) => ({
      ...checkpoint,
      source: checkpoint.description?.startsWith("MCP Tool:") ? "MCP" : "LLM",
      toolName: checkpoint.description?.includes("Tool:")
        ? checkpoint.description.split("Tool:")[1]?.trim().split(" ")[0]
        : undefined,
    }));

    return NextResponse.json({
      activeSession,
      activeCheckpoints: checkpointDetails,
      summary: {
        total: activeCheckpoints.length,
        mcp: checkpointDetails.filter((c) => c.source === "MCP").length,
        llm: checkpointDetails.filter((c) => c.source === "LLM").length,
      },
    });
  } catch (error) {
    console.error("Error fetching checkpoint status:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch checkpoint status",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
