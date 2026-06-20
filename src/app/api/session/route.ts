import { NextRequest, NextResponse } from "next/server";
import { initSession, getQueueState } from "@/lib/queue";
import { getOrCreateSession } from "@/lib/db";
import { isMurekaEnabled } from "@/lib/mureka";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }

  const queue = await getQueueState(sessionId);
  const profile = getOrCreateSession(sessionId);

  return NextResponse.json({
    queue,
    profile,
    murekaEnabled: isMurekaEnabled(),
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const sessionId = body.sessionId as string;

  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }

  const queue = await initSession(sessionId);
  const profile = getOrCreateSession(sessionId);

  return NextResponse.json({
    queue,
    profile,
    murekaEnabled: isMurekaEnabled(),
  });
}
