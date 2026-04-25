import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import {
  listDeadLetters,
  markDeadLetterReplayed,
} from "@/services/opportunity-monitoring/hardening";

export async function GET(request: NextRequest) {
  try {
    const { user, workspaceId } = await getWorkspaceContext();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!workspaceId) return NextResponse.json({ error: "No workspace found" }, { status: 404 });

    const status = request.nextUrl.searchParams.get("status") || "open";
    const deadLetters = await listDeadLetters(workspaceId, status);

    return NextResponse.json({ workspaceId, status, deadLetters });
  } catch (error) {
    console.error("Dead letter GET error", error);
    return NextResponse.json({ error: "Failed to fetch dead letters" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, workspaceId } = await getWorkspaceContext();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!workspaceId) return NextResponse.json({ error: "No workspace found" }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const deadLetterId = typeof body.deadLetterId === "string" ? body.deadLetterId : "";

    if (!deadLetterId) {
      return NextResponse.json({ error: "deadLetterId is required" }, { status: 400 });
    }

    await markDeadLetterReplayed(workspaceId, deadLetterId);
    return NextResponse.json({ message: "Dead letter marked as replayed", deadLetterId });
  } catch (error) {
    console.error("Dead letter POST error", error);
    return NextResponse.json({ error: "Failed to update dead letter" }, { status: 500 });
  }
}
