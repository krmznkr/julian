#!/usr/bin/env bash
# Build julian for the web WITHOUT the Google client secret, then deploy.
#
# The secret must never ship in the public bundle — it lives only in the Worker,
# set once via:  bunx wrangler secret put GOOGLE_CLIENT_SECRET
# It hard-fails if a Google client secret is somehow present in dist/.
set -euo pipefail
cd "$(dirname "$0")/.."

rm -rf dist node_modules/.vite
pnpm run build

if grep -rqE 'GOCSPX-[A-Za-z0-9_-]+' dist/; then
  echo "ERROR: a client secret was found in dist/ — aborting deploy." >&2
  exit 1
fi

pnpm exec wrangler deploy
