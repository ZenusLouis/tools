#!/bin/sh
set -e

echo "[GCS Console] Applying database schema changes..."
npx prisma db push --skip-generate --accept-data-loss

echo "[GCS Console] Ensuring default workspace exists..."
# Create default workspace if it doesn't exist (required for legacy HOOK_SECRET auth)
echo "INSERT INTO \"Workspace\" (\"id\", \"name\", \"slug\", \"updatedAt\", \"createdAt\") VALUES ('default-ws', 'Default Workspace', 'default', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT (\"slug\") DO NOTHING;" | npx prisma db execute --stdin --url "$DATABASE_URL"

echo "[GCS Console] Starting Next.js server in background..."
node server.js &
SERVER_PID=$!

echo "[GCS Console] Waiting for server to be ready (10 seconds)..."
sleep 10

echo "[GCS Console] Ingesting Skills, Commands, and Memory into Database..."
node -e "fetch('http://127.0.0.1:3000/api/admin/ingest-frameworks', {method: 'POST'}).then(r=>r.json()).then(console.log).catch(console.error)" || echo "[GCS Console] Warning: Ingestion script failed."

echo "[GCS Console] Startup complete! System is ready."
wait $SERVER_PID
