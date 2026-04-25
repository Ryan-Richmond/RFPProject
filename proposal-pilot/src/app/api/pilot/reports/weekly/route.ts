import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { generateWeeklyPilotReport, getWeeklyPilotReports } from "@/services/pilot";

function currentWeekRange() {
  const now = new Date();
  const day = now.getUTCDay();
  const diffToMonday = (day + 6) % 7;
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - diffToMonday);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  return {
    weekStart: start.toISOString().slice(0, 10),
    weekEnd: end.toISOString().slice(0, 10),
  };
}

export async function GET(request: NextRequest) {
  try {
    const { user, workspaceId } = await getWorkspaceContext();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!workspaceId) return NextResponse.json({ error: "No workspace found" }, { status: 404 });

    const limit = Number(request.nextUrl.searchParams.get("limit") || "8");
    const reports = await getWeeklyPilotReports(workspaceId, Number.isNaN(limit) ? 8 : limit);

    return NextResponse.json({ workspaceId, reports });
  } catch (error) {
    console.error("Pilot reports GET error", error);
    return NextResponse.json({ error: "Failed to fetch pilot reports" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, workspaceId } = await getWorkspaceContext();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!workspaceId) return NextResponse.json({ error: "No workspace found" }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const { weekStart, weekEnd } = currentWeekRange();

    const report = await generateWeeklyPilotReport({
      workspaceId,
      weekStart: typeof body.weekStart === "string" ? body.weekStart : weekStart,
      weekEnd: typeof body.weekEnd === "string" ? body.weekEnd : weekEnd,
      createdBy: user.id,
    });

    return NextResponse.json({ message: "Weekly pilot report generated", report });
  } catch (error) {
    console.error("Pilot reports POST error", error);
    return NextResponse.json({ error: "Failed to generate pilot report" }, { status: 500 });
  }
}
