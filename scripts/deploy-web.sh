#!/usr/bin/env bash
# Build julian for the web WITHOUT the Google client secret, then deploy.
#
# The secret must never ship in the public bundle — it lives only in the Worker,
# set once via:  pnpm --filter @julian/edge exec wrangler secret put GOOGLE_CLIENT_SECRET
# It hard-fails if a Google client secret is somehow present in dist/.
set -euo pipefail
cd "$(dirname "$0")/.."

rm -rf apps/web/dist apps/web/node_modules/.vite
APP_CHANNEL=${APP_CHANNEL:-stable} pnpm run build

if grep -rqE 'GOCSPX-[A-Za-z0-9_-]+' apps/web/dist/; then
  echo "ERROR: a client secret was found in apps/web/dist/ — aborting deploy." >&2
  exit 1
fi

export APP_CHANNEL=${APP_CHANNEL:-stable}
info=$(node packages/release/src/cli.ts)
version=$(sed -n 's/^version=//p' <<<"$info")
commit=$(sed -n 's/^commit=//p' <<<"$info")

echo "WARNING: this deploys $version straight to 100% of production traffic," >&2
echo "         with no canary or automatic rollback (see deploy-stable.yml)." >&2

pnpm --filter @julian/edge exec wrangler deploy \
  --var "APP_VERSION:$version" \
  --var "APP_CHANNEL:$APP_CHANNEL" \
  --var "APP_COMMIT:$commit"
