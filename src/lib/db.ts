import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import type { Track, UserProfile, PlayerEvent, TrackStatus } from "@/types";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "ai-music.db");

let db: Database.Database | null = null;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function getDb(): Database.Database {
  if (!db) {
    ensureDataDir();
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    initSchema(db);
  }
  return db;
}

function initSchema(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS tracks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      artist TEXT NOT NULL DEFAULT 'AI Radio',
      mode TEXT NOT NULL DEFAULT 'original',
      prompt TEXT NOT NULL,
      lyrics_theme TEXT NOT NULL DEFAULT '',
      language TEXT NOT NULL DEFAULT 'zh',
      audio_url TEXT,
      stream_url TEXT,
      cover_url TEXT,
      duration_ms INTEGER,
      status TEXT NOT NULL DEFAULT 'ready',
      mureka_task_id TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      session_id TEXT PRIMARY KEY,
      energy REAL NOT NULL DEFAULT 0.5,
      nostalgia REAL NOT NULL DEFAULT 0.5,
      vocal REAL NOT NULL DEFAULT 0.5,
      electronic REAL NOT NULL DEFAULT 0.5,
      liked_tags TEXT NOT NULL DEFAULT '[]',
      disliked_tags TEXT NOT NULL DEFAULT '[]',
      preferred_language TEXT NOT NULL DEFAULT 'zh',
      vocal_id TEXT,
      current_track_id TEXT,
      next_track_id TEXT,
      generating_track_id TEXT,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      track_id TEXT NOT NULL,
      type TEXT NOT NULL,
      progress REAL,
      timestamp INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tracks_status ON tracks(status);
    CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id);
  `);
}

function rowToTrack(row: Record<string, unknown>): Track {
  return {
    id: row.id as string,
    title: row.title as string,
    artist: row.artist as string,
    mode: row.mode as Track["mode"],
    prompt: row.prompt as string,
    lyricsTheme: row.lyrics_theme as string,
    language: row.language as string,
    audioUrl: (row.audio_url as string) || null,
    streamUrl: (row.stream_url as string) || null,
    coverUrl: (row.cover_url as string) || null,
    durationMs: (row.duration_ms as number) || null,
    status: row.status as TrackStatus,
    murekaTaskId: (row.mureka_task_id as string) || null,
    tags: JSON.parse((row.tags as string) || "[]"),
    createdAt: row.created_at as number,
  };
}

export function insertTrack(track: Track) {
  const database = getDb();
  database
    .prepare(
      `INSERT INTO tracks (id, title, artist, mode, prompt, lyrics_theme, language,
        audio_url, stream_url, cover_url, duration_ms, status, mureka_task_id, tags, created_at)
       VALUES (@id, @title, @artist, @mode, @prompt, @lyricsTheme, @language,
        @audioUrl, @streamUrl, @coverUrl, @durationMs, @status, @murekaTaskId, @tags, @createdAt)`
    )
    .run({
      ...track,
      lyricsTheme: track.lyricsTheme,
      audioUrl: track.audioUrl,
      streamUrl: track.streamUrl,
      coverUrl: track.coverUrl,
      durationMs: track.durationMs,
      murekaTaskId: track.murekaTaskId,
      tags: JSON.stringify(track.tags),
    });
}

export function updateTrack(id: string, updates: Partial<Track>) {
  const fields: string[] = [];
  const values: Record<string, unknown> = { id };

  const mapping: Record<string, string> = {
    title: "title",
    artist: "artist",
    mode: "mode",
    prompt: "prompt",
    lyricsTheme: "lyrics_theme",
    language: "language",
    audioUrl: "audio_url",
    streamUrl: "stream_url",
    coverUrl: "cover_url",
    durationMs: "duration_ms",
    status: "status",
    murekaTaskId: "mureka_task_id",
    tags: "tags",
  };

  for (const [key, col] of Object.entries(mapping)) {
    const val = updates[key as keyof Track];
    if (val !== undefined) {
      fields.push(`${col} = @${key}`);
      values[key] =
        key === "tags" ? JSON.stringify(val) : val;
    }
  }

  if (fields.length === 0) return;

  getDb()
    .prepare(`UPDATE tracks SET ${fields.join(", ")} WHERE id = @id`)
    .run(values);
}

export function getTrack(id: string): Track | null {
  const row = getDb()
    .prepare("SELECT * FROM tracks WHERE id = ?")
    .get(id) as Record<string, unknown> | undefined;
  return row ? rowToTrack(row) : null;
}

export function getReadyTracks(limit = 20): Track[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM tracks WHERE status = 'ready' AND audio_url IS NOT NULL
       ORDER BY created_at DESC LIMIT ?`
    )
    .all(limit) as Record<string, unknown>[];
  return rows.map(rowToTrack);
}

export function getOrCreateSession(sessionId: string): UserProfile {
  const database = getDb();
  const existing = database
    .prepare("SELECT * FROM sessions WHERE session_id = ?")
    .get(sessionId) as Record<string, unknown> | undefined;

  if (existing) {
    return {
      sessionId,
      energy: existing.energy as number,
      nostalgia: existing.nostalgia as number,
      vocal: existing.vocal as number,
      electronic: existing.electronic as number,
      likedTags: JSON.parse((existing.liked_tags as string) || "[]"),
      dislikedTags: JSON.parse((existing.disliked_tags as string) || "[]"),
      preferredLanguage: existing.preferred_language as string,
      vocalId: (existing.vocal_id as string) || null,
    };
  }

  const now = Date.now();
  database
    .prepare(
      `INSERT INTO sessions (session_id, updated_at) VALUES (?, ?)`
    )
    .run(sessionId, now);

  return {
    sessionId,
    energy: 0.5,
    nostalgia: 0.5,
    vocal: 0.5,
    electronic: 0.5,
    likedTags: [],
    dislikedTags: [],
    preferredLanguage: "zh",
    vocalId: null,
  };
}

export function updateSession(
  sessionId: string,
  updates: Partial<UserProfile> & {
    currentTrackId?: string | null;
    nextTrackId?: string | null;
    generatingTrackId?: string | null;
  }
) {
  const fields: string[] = ["updated_at = @updatedAt"];
  const values: Record<string, unknown> = {
    sessionId,
    updatedAt: Date.now(),
  };

  const mapping: Record<string, string> = {
    energy: "energy",
    nostalgia: "nostalgia",
    vocal: "vocal",
    electronic: "electronic",
    likedTags: "liked_tags",
    dislikedTags: "disliked_tags",
    preferredLanguage: "preferred_language",
    vocalId: "vocal_id",
    currentTrackId: "current_track_id",
    nextTrackId: "next_track_id",
    generatingTrackId: "generating_track_id",
  };

  for (const [key, col] of Object.entries(mapping)) {
    const val = updates[key as keyof typeof updates];
    if (val !== undefined) {
      fields.push(`${col} = @${key}`);
      values[key] =
        key === "likedTags" || key === "dislikedTags"
          ? JSON.stringify(val)
          : val;
    }
  }

  getDb()
    .prepare(
      `UPDATE sessions SET ${fields.join(", ")} WHERE session_id = @sessionId`
    )
    .run(values);
}

export function getSessionQueueIds(sessionId: string) {
  const row = getDb()
    .prepare(
      "SELECT current_track_id, next_track_id, generating_track_id FROM sessions WHERE session_id = ?"
    )
    .get(sessionId) as Record<string, unknown> | undefined;

  return {
    currentTrackId: (row?.current_track_id as string) || null,
    nextTrackId: (row?.next_track_id as string) || null,
    generatingTrackId: (row?.generating_track_id as string) || null,
  };
}

export function insertEvent(event: PlayerEvent) {
  getDb()
    .prepare(
      `INSERT INTO events (session_id, track_id, type, progress, timestamp)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      event.sessionId,
      event.trackId,
      event.type,
      event.progress ?? null,
      event.timestamp
    );
}

export function getRecentEvents(sessionId: string, limit = 30): PlayerEvent[] {
  const rows = getDb()
    .prepare(
      `SELECT session_id, track_id, type, progress, timestamp
       FROM events WHERE session_id = ? ORDER BY timestamp DESC LIMIT ?`
    )
    .all(sessionId, limit) as Record<string, unknown>[];

  return rows.map((row) => ({
    sessionId: row.session_id as string,
    trackId: row.track_id as string,
    type: row.type as PlayerEvent["type"],
    progress: row.progress as number | undefined,
    timestamp: row.timestamp as number,
  }));
}

export function countTracks(): number {
  const row = getDb()
    .prepare("SELECT COUNT(*) as count FROM tracks")
    .get() as { count: number };
  return row.count;
}
