import { NextResponse } from "next/server";
import { isMurekaEnabled } from "@/lib/mureka";
import { countTracks } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    murekaEnabled: isMurekaEnabled(),
    trackCount: countTracks(),
    version: "0.1.0",
  });
}
