#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/private-media-site"

apt-get update
apt-get install -y ca-certificates curl gnupg nginx certbot python3-certbot-nginx

install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
. /etc/os-release
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

mkdir -p "$APP_DIR/assets/video" "$APP_DIR/assets/photos" "$APP_DIR/assets/audio" "$APP_DIR/data" "$APP_DIR/trash/video" "$APP_DIR/trash/photos" "$APP_DIR/trash/audio" "$APP_DIR/thumbnails/video" "$APP_DIR/thumbnails/photos" "$APP_DIR/thumbnails/audio"
systemctl enable --now docker nginx

echo "Base ECS setup complete. Upload the project to $APP_DIR, create .env, then run: docker compose -f docker-compose.prod.yml up -d --build"
