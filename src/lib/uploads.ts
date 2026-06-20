import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");

const ALLOWED_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "audio/x-m4a",
  "audio/m4a",
]);

const ALLOWED_EXT = new Set([".mp3", ".wav", ".m4a", ".flac"]);

const MAX_BYTES = 50 * 1024 * 1024; // 50MB

export function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

export function getUploadDir() {
  ensureUploadDir();
  return UPLOAD_DIR;
}

export function getUploadPath(filename: string) {
  return path.join(getUploadDir(), filename);
}

export function validateAudioFile(file: File): string | null {
  if (file.size > MAX_BYTES) {
    return "文件不能超过 50MB";
  }

  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED_EXT.has(ext) && !ALLOWED_TYPES.has(file.type)) {
    return "仅支持 mp3、wav、m4a、flac 格式";
  }

  return null;
}

export async function saveAudioFile(file: File): Promise<string> {
  const ext = path.extname(file.name).toLowerCase() || ".mp3";
  const filename = `${uuidv4()}${ext}`;
  const filepath = getUploadPath(filename);

  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(filepath, buffer);

  return filename;
}

export function deleteAudioFile(filename: string) {
  const filepath = getUploadPath(filename);
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath);
  }
}

export function audioUrlFromFilename(filename: string): string {
  return `/ai-music/api/audio/${filename}`;
}

export function filenameFromAudioUrl(url: string | null): string | null {
  if (!url) return null;
  const match = url.match(/\/api\/audio\/([^/?#]+)/);
  return match?.[1] || null;
}

export function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const map: Record<string, string> = {
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".m4a": "audio/mp4",
    ".flac": "audio/flac",
  };
  return map[ext] || "application/octet-stream";
}
