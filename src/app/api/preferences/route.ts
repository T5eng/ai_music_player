import { NextRequest, NextResponse } from "next/server";
import { updatePreferences } from "@/lib/queue";
import { getOrCreateSession } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const sessionId = body.sessionId as string;

  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }

  await updatePreferences(sessionId, {
    energy: body.energy,
    nostalgia: body.nostalgia,
    vocal: body.vocal,
    electronic: body.electronic,
    preferredLanguage: body.preferredLanguage,
  });

  const profile = getOrCreateSession(sessionId);
  return NextResponse.json({ profile });
}
