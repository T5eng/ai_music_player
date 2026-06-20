import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { verifyAdmin, unauthorizedResponse, isAdminEnabled } from "@/lib/auth";
import { insertTrack, getPresetTracks, deleteTrack, getTrack } from "@/lib/db";
import {
  saveAudioFile,
  validateAudioFile,
  deleteAudioFile,
  audioUrlFromFilename,
  filenameFromAudioUrl,
} from "@/lib/uploads";
import type { Track, TrackMode } from "@/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!verifyAdmin(req)) return unauthorizedResponse();

  return NextResponse.json({
    tracks: getPresetTracks(),
    adminEnabled: isAdminEnabled(),
  });
}

export async function POST(req: NextRequest) {
  if (!verifyAdmin(req)) return unauthorizedResponse();

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "请上传音频文件" }, { status: 400 });
    }

    const validationError = validateAudioFile(file);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const title = (formData.get("title") as string)?.trim();
    if (!title) {
      return NextResponse.json({ error: "请填写曲目标题" }, { status: 400 });
    }

    const artist = (formData.get("artist") as string)?.trim() || "AI Radio";
    const prompt = (formData.get("prompt") as string)?.trim() || "preset, uploaded";
    const lyricsTheme =
      (formData.get("lyricsTheme") as string)?.trim() || title;
    const language = (formData.get("language") as string)?.trim() || "zh";
    const mode = ((formData.get("mode") as string) || "original") as TrackMode;
    const tagsRaw = (formData.get("tags") as string)?.trim() || "";
    const tags = tagsRaw
      ? tagsRaw.split(/[,，]/).map((t) => t.trim()).filter(Boolean)
      : ["preset"];

    const filename = await saveAudioFile(file);
    const audioUrl = audioUrlFromFilename(filename);

    const track: Track = {
      id: uuidv4(),
      title,
      artist,
      mode,
      prompt,
      lyricsTheme,
      language,
      audioUrl,
      streamUrl: null,
      coverUrl: null,
      durationMs: null,
      status: "ready",
      murekaTaskId: null,
      tags: [...new Set(["preset", ...tags])],
      createdAt: Date.now(),
      isPreset: true,
    };

    insertTrack(track);

    return NextResponse.json({ track }, { status: 201 });
  } catch (err) {
    console.error("Upload failed:", err);
    return NextResponse.json({ error: "上传失败" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!verifyAdmin(req)) return unauthorizedResponse();

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "缺少曲目 ID" }, { status: 400 });
  }

  const track = getTrack(id);
  if (!track || !track.isPreset) {
    return NextResponse.json({ error: "曲目不存在或不可删除" }, { status: 404 });
  }

  const filename = filenameFromAudioUrl(track.audioUrl);
  if (filename) deleteAudioFile(filename);

  deleteTrack(id);

  return NextResponse.json({ ok: true });
}
