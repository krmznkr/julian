#!/usr/bin/env bash
# Boot the edge Worker locally with `wrangler dev` against the built web dist
# (run `pnpm build` first) and check that it serves with security headers.
set -euo pipefail
cd "$(dirname "$0")/../apps/edge"

port=${SMOKE_PORT:-8787}
base="http://127.0.0.1:$port"
# The Worker's bot filter rejects curl's default user agent.
ua="Mozilla/5.0 (compatible; julian-smoke)"
log=$(mktemp)

pnpm exec wrangler dev --ip 127.0.0.1 --port "$port" >"$log" 2>&1 &
pid=$!
trap 'kill "$pid" 2>/dev/null || true' EXIT

for _ in $(seq 1 60); do
  curl -fsS -o /dev/null -A "$ua" "$base/version.json" 2>/dev/null && break
  if ! kill -0 "$pid" 2>/dev/null; then
    cat "$log" >&2
    echo "wrangler dev exited before serving" >&2
    exit 1
  fi
  sleep 1
done

check() {
  local path=$1 headers
  headers=$(curl -sS -o /dev/null -D - -A "$ua" "$base$path")
  if ! grep -qE '^HTTP/[0-9.]+ 200' <<<"$headers"; then
    cat "$log" >&2
    echo "GET $path did not return 200:" >&2
    echo "$headers" >&2
    exit 1
  fi
  for header in content-security-policy x-content-type-options x-frame-options strict-transport-security; do
    if ! grep -qi "^$header:" <<<"$headers"; then
      echo "GET $path is missing $header" >&2
      exit 1
    fi
  done
  echo "GET $path: 200 with security headers"
}

check /version.json
check /
