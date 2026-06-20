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
node deploy/seed-remote.js

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
    location /ai-music/api/stream {\
        proxy_pass http://127.0.0.1:3010/ai-music/api/stream;\
        proxy_http_version 1.1;\
        proxy_set_header Connection '\'''\'';\
        proxy_buffering off;\
        proxy_cache off;\
        proxy_read_timeout 3600s;\
        chunked_transfer_encoding off;\
    }\
    location ^~ /ai-music {\
        proxy_pass http://127.0.0.1:3010;\
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
' "$NGINX_CONF"
  sudo nginx -t && sudo systemctl reload nginx
  echo "Nginx configured for /ai-music"
else
  echo "Nginx already has /ai-music config"
  sudo sed -i 's/location \/ai-music {/location ^~ \/ai-music {/g' "$NGINX_CONF" 2>/dev/null || true
  sudo nginx -t && sudo systemctl reload nginx
fi

echo "==> Health check..."
sleep 3
curl -sf "http://127.0.0.1:${APP_PORT}/ai-music/api/health" && echo "" || echo "Health check pending..."

echo "==> Deploy complete!"
echo "Access: http://mirac.site/ai-music"
REMOTE_SCRIPT

echo "Done! Visit http://mirac.site/ai-music"
