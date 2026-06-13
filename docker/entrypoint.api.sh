#!/bin/sh
set -e

echo "[HRMS] Waiting for PostgreSQL at ${DATABASE_URL}..."
until bun --eval "
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL, { max: 1, connect_timeout: 3 });
await sql\`SELECT 1\`;
await sql.end();
" 2>/dev/null; do
  echo "[HRMS] DB not ready — retrying in 2s..."
  sleep 2
done

echo "[HRMS] Running migrations..."
bun run packages/boundary-postgres/src/migrate.ts

echo "[HRMS] Starting API on port ${PORT:-3000}..."
exec bun run packages/api/src/index.ts
