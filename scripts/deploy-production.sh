#!/usr/bin/env bash
set -Eeuo pipefail

APP_ROOT="${APP_ROOT:-/var/www/mappening}"
REPO_DIR="${REPO_DIR:-$APP_ROOT/source}"
FRONTEND_DIR="${FRONTEND_DIR:-$APP_ROOT/frontend}"
BACKEND_BIN="${BACKEND_BIN:-/opt/mappening/mappening-api}"
MIGRATIONS_BIN="${MIGRATIONS_BIN:-/opt/mappening/mappening-migrate}"
BACKEND_SERVICE="${BACKEND_SERVICE:-mappening-api}"
ENV_FILE="${ENV_FILE:-/etc/mappening/mappening.env}"
HEALTHCHECK_URL="${HEALTHCHECK_URL:-http://127.0.0.1:8081/api/health}"

echo "Starting Mappening production deployment"

if [[ ! -d "$REPO_DIR/.git" ]]; then
  echo "Repository not found at $REPO_DIR" >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Environment file not found at $ENV_FILE" >&2
  exit 1
fi

mkdir -p "$APP_ROOT" "$(dirname "$BACKEND_BIN")" "$(dirname "$MIGRATIONS_BIN")"

cd "$REPO_DIR"
git fetch --prune origin

current_branch="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$current_branch" != "main" ]]; then
  git checkout main
fi

git pull --ff-only origin main

echo "Building backend"
cd "$REPO_DIR/backend"
go build -o "$APP_ROOT/mappening-api.new" ./cmd/api
go build -o "$APP_ROOT/mappening-migrate.new" ./cmd/migrate
install -m 0755 "$APP_ROOT/mappening-api.new" "$BACKEND_BIN"
install -m 0755 "$APP_ROOT/mappening-migrate.new" "$MIGRATIONS_BIN"
rm -f "$APP_ROOT/mappening-api.new" "$APP_ROOT/mappening-migrate.new"

echo "Running database migrations"
set -a
source "$ENV_FILE"
set +a
cd "$REPO_DIR/backend"
"$MIGRATIONS_BIN"

echo "Building frontend"
cd "$REPO_DIR/frontend"
npm ci
npm run build

echo "Publishing frontend"
rm -rf "$FRONTEND_DIR.new"
mkdir -p "$FRONTEND_DIR.new"
cp -a dist/. "$FRONTEND_DIR.new/"

if [[ -d "$FRONTEND_DIR" ]]; then
  rm -rf "$FRONTEND_DIR.previous"
  mv "$FRONTEND_DIR" "$FRONTEND_DIR.previous"
fi

mv "$FRONTEND_DIR.new" "$FRONTEND_DIR"

echo "Restarting backend service"
systemctl restart "$BACKEND_SERVICE"
systemctl is-active --quiet "$BACKEND_SERVICE"

echo "Checking backend health"
curl -fsS --max-time 10 "$HEALTHCHECK_URL" >/dev/null

echo "Deployment completed successfully"
