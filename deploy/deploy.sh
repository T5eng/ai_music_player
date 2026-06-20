#!/bin/bash
set -euo pipefail

REMOTE_HOST="${DEPLOY_HOST:-119.45.180.7}"
REMOTE_USER="${DEPLOY_USER:-ubuntu}"
REMOTE_DIR="/home/ubuntu/ai-music-player"
APP_PORT=3010

echo "==> Building locally..."
npm ci
npm run build

echo "==> Packaging..."
tar czf /tmp/ai-music-player.tar.gz \
  --exclude=node_modules \
  --exclude=.git \
  --exclude=data \
  -C /workspace .

echo "==> Uploading to ${REMOTE_USER}@${REMOTE_HOST}..."
sshpass -p "$DEPLOY_PASSWORD" scp -o StrictHostKeyChecking=no \
  /tmp/ai-music-player.tar.gz "${REMOTE_USER}@${REMOTE_HOST}:/tmp/"

echo "==> Deploying on remote..."
sshpass -p "$DEPLOY_PASSWORD" ssh -o StrictHostKeyChecking=no \
  "${REMOTE_USER}@${REMOTE_HOST}" bash -s << 'REMOTE_SCRIPT'
set -euo pipefail
REMOTE_DIR="/home/ubuntu/ai-music-player"
APP_PORT=3010

mkdir -p "$REMOTE_DIR"
cd "$REMOTE_DIR"

# Preserve data and env
if [ -f .env ]; then cp .env /tmp/ai-music-env-backup; fi
if [ -d data ]; then cp -r data /tmp/ai-music-data-backup; fi

tar xzf /tmp/ai-music-player.tar.gz -C "$REMOTE_DIR"

if [ -f /tmp/ai-music-env-backup ]; then mv /tmp/ai-music-env-backup .env; fi
if [ -d /tmp/ai-music-data-backup ]; then rm -rf data && mv /tmp/ai-music-data-backup data; fi

# Install production deps (rebuild native modules for server arch)
npm ci --omit=dev
npm rebuild better-sqlite3

# Seed database
node -e "
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'ai-music.db'));
db.exec(\`
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
\`);

const count = db.prepare('SELECT COUNT(*) as c FROM tracks').get().c;
if (count === 0) {
  const seeds = [
    { title: '霓虹梦境', prompt: 'synthwave, dreamy', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', tags: '["synthwave","electronic"]' },
    { title: '午后咖啡', prompt: 'acoustic, warm', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', tags: '["acoustic","folk"]' },
    { title: '午夜节奏', prompt: 'r&b, slow', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3', tags: '["r&b","slow"]' },
    { title: 'City Glow', prompt: 'city pop, 80s', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3', tags: '["city pop","nostalgic"]' },
    { title: '星空告白', prompt: 'mandopop, emotional', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3', tags: '["mandopop","emotional"]' },
  ];
  const stmt = db.prepare('INSERT INTO tracks (id,title,artist,mode,prompt,lyrics_theme,language,audio_url,status,tags,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
  for (const s of seeds) {
    stmt.run(uuidv4(), s.title, 'AI Radio', 'original', s.prompt, s.title, 'zh', s.url, 'ready', s.tags, Date.now());
  }
  console.log('Seeded', seeds.length, 'tracks');
}
db.close();
"

# PM2
if pm2 describe ai-music-player > /dev/null 2>&1; then
  pm2 restart ai-music-player
else
  pm2 start deploy/ecosystem.config.js
fi
pm2 save

echo "==> Configuring nginx..."
NGINX_CONF="/etc/nginx/sites-available/pixelforge"

if ! grep -q "ai-music" "$NGINX_CONF" 2>/dev/null; then
  sudo cp "$NGINX_CONF" "${NGINX_CONF}.bak.$(date +%s)"
  sudo sed -i '/location \/ {/i\
    # AI Music Player\
    location /ai-music/ {\
        proxy_pass http://127.0.0.1:3010/ai-music/;\
        proxy_http_version 1.1;\
        proxy_set_header Upgrade $http_upgrade;\
        proxy_set_header Connection '\''upgrade'\'';\
        proxy_set_header Host $host;\
        proxy_set_header X-Real-IP $remote_addr;\
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\
        proxy_set_header X-Forwarded-Proto $scheme;\
        proxy_cache_bypass $http_upgrade;\
        proxy_read_timeout 300s;\
    }\
    location /ai-music/api/stream {\
        proxy_pass http://127.0.0.1:3010/ai-music/api/stream;\
        proxy_http_version 1.1;\
        proxy_set_header Connection '\'''\'';\
        proxy_buffering off;\
        proxy_cache off;\
        proxy_read_timeout 3600s;\
        chunked_transfer_encoding off;\
    }\
' "$NGINX_CONF"
  sudo nginx -t && sudo systemctl reload nginx
  echo "Nginx configured for /ai-music"
else
  echo "Nginx already has /ai-music config"
  sudo nginx -t && sudo systemctl reload nginx
fi

echo "==> Health check..."
sleep 3
curl -sf "http://127.0.0.1:${APP_PORT}/ai-music/api/health" && echo "" || echo "Health check pending..."

echo "==> Deploy complete!"
echo "Access: http://mirac.site/ai-music"
REMOTE_SCRIPT

echo "Done! Visit http://mirac.site/ai-music"
