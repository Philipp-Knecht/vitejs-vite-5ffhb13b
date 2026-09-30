#!/bin/sh
# Applies pending database migrations (unless RUN_MIGRATIONS=false, e.g. when
# several instances start at once and migrations run as a separate job), then
# starts the server.
set -eu

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "Applying database migrations ..."
  (cd /app/apps/api && npx --no-install prisma migrate deploy)
fi

exec node /app/apps/api/dist/server.js
