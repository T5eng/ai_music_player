import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { getUploadPath, getMimeType } from "@/lib/uploads";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  if (!filename || filename.includes("..") || filename.includes("/")) {
    return NextResponse.json({ error: "Invalid file" }, { status: 400 });
  }

  const filepath = getUploadPath(filename);

  if (!fs.existsSync(filepath)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const buffer = fs.readFileSync(filepath);
  const mime = getMimeType(filename);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": mime,
      "Cache-Control": "public, max-age=31536000, immutable",
      "Accept-Ranges": "bytes",
    },
  });
}
