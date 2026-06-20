import { NextRequest, NextResponse } from "next/server";
import {
  handlePlayerEvent,
  scheduleNextGeneration,
  getRecommendationReason,
} from "@/lib/queue";
import type { PlayerEvent } from "@/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const sessionId = body.sessionId as string;
  const action = body.action as string;

  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }

  if (action === "generate") {
    const track = await scheduleNextGeneration(sessionId, body.spec);
    return NextResponse.json({
      track,
      reason: getRecommendationReason(sessionId),
    });
  }

  const event: PlayerEvent = {
    sessionId,
    trackId: body.trackId,
    type: body.type,
    progress: body.progress,
    timestamp: Date.now(),
  };

  const queue = await handlePlayerEvent(sessionId, event);

  return NextResponse.json({
    queue,
    reason: getRecommendationReason(sessionId),
  });
}
