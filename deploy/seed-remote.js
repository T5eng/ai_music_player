const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, "ai-music.db"));
db.exec(`
  CREATE TABLE IF NOT EXISTS tracks (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, artist TEXT NOT NULL DEFAULT 'AI Radio',
    mode TEXT NOT NULL DEFAULT 'original', prompt TEXT NOT NULL, lyrics_theme TEXT NOT NULL DEFAULT '',
    language TEXT NOT NULL DEFAULT 'zh', audio_url TEXT, stream_url TEXT, cover_url TEXT,
    duration_ms INTEGER, status TEXT NOT NULL DEFAULT 'ready', mureka_task_id TEXT,
    tags TEXT NOT NULL DEFAULT '[]', created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    session_id TEXT PRIMARY KEY, energy REAL NOT NULL DEFAULT 0.5, nostalgia REAL NOT NULL DEFAULT 0.5,
    vocal REAL NOT NULL DEFAULT 0.5, electronic REAL NOT NULL DEFAULT 0.5,
    liked_tags TEXT NOT NULL DEFAULT '[]', disliked_tags TEXT NOT NULL DEFAULT '[]',
    preferred_language TEXT NOT NULL DEFAULT 'zh', vocal_id TEXT,
    current_track_id TEXT, next_track_id TEXT, generating_track_id TEXT, updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL, track_id TEXT NOT NULL,
    type TEXT NOT NULL, progress REAL, timestamp INTEGER NOT NULL
  );
`);

const count = db.prepare("SELECT COUNT(*) as c FROM tracks").get().c;
if (count === 0) {
  const seeds = [
    { title: "霓虹梦境", prompt: "synthwave, dreamy", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", tags: '["synthwave","electronic"]' },
    { title: "午后咖啡", prompt: "acoustic, warm", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3", tags: '["acoustic","folk"]' },
    { title: "午夜节奏", prompt: "r&b, slow", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3", tags: '["r&b","slow"]' },
    { title: "City Glow", prompt: "city pop, 80s", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3", tags: '["city pop","nostalgic"]' },
    { title: "星空告白", prompt: "mandopop, emotional", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3", tags: '["mandopop","emotional"]' },
  ];
  const stmt = db.prepare(
    "INSERT INTO tracks (id,title,artist,mode,prompt,lyrics_theme,language,audio_url,status,tags,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)"
  );
  for (const s of seeds) {
    stmt.run(uuidv4(), s.title, "AI Radio", "original", s.prompt, s.title, "zh", s.url, "ready", s.tags, Date.now());
  }
  console.log("Seeded", seeds.length, "tracks");
} else {
  console.log("Database already has", count, "tracks");
}
db.close();
