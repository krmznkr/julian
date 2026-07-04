#!/usr/bin/env bash
# Build julian for the web WITHOUT the Google client secret, then deploy.
#
# The secret must never ship in the public bundle — it lives only in the Worker,
# set once via:  bunx wrangler secret put GOOGLE_CLIENT_SECRET
# This script blanks VITE_GOOGLE_CLIENT_SECRET for the build (restoring .env
# afterwards) and hard-fails if a secret is somehow present in dist/.
set -euo pipefail
cd "$(dirname "$0")/.."

restore() { [ -f .env.bak ] && mv .env.bak .env; }
trap restore EXIT

if [ -f .env ]; then
  cp .env .env.bak
  sed -i '' 's/^VITE_GOOGLE_CLIENT_SECRET=.*/VITE_GOOGLE_CLIENT_SECRET=/' .env
fi

rm -rf dist node_modules/.vite
pnpm run build

if grep -rqE 'GOCSPX-[A-Za-z0-9_-]+' dist/; then
  echo "ERROR: a client secret was found in dist/ — aborting deploy." >&2
  exit 1
fi

bunx wrangler deploy
