#!/usr/bin/env bash
# Boot the edge Worker locally with `wrangler dev` against the built web dist
# (run `pnpm build` first) and check that it serves with security headers,
# that deep demo links get the demo's share tags, and that missing files 404.
set -euo pipefail
cd "$(dirname "$0")/../apps/edge"

port=${SMOKE_PORT:-8787}
base="http://127.0.0.1:$port"
# The Worker's bot filter rejects curl's default user agent.
ua="Mozilla/5.0 (compatible; julian-release-smoke)"
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

# A deep demo link (the URL a visitor copies) gets the demo page's title and
# canonical og:url without a redirect; other app routes keep the generic shell.
check_head() {
  local path=$1 title=$2 og_url=$3 headers body
  headers=$(curl -sS -D - -o /dev/null -A "$ua" -H 'Accept: text/html' "$base$path")
  body=$(curl -sS -A "$ua" -H 'Accept: text/html' "$base$path" | tr '\n' ' ')
  local expected=(
    "<title>$title</title>"
    "<meta property=\"og:title\" content=\"$title\" />"
    '<meta name="twitter:card" content="summary_large_image" />'
    '<meta name="robots" content="noindex, nofollow, noarchive, nosnippet" />'
    '<meta property="og:image" content="https://'
  )
  grep -qE '^HTTP/[0-9.]+ 200' <<<"$headers" || { echo "GET $path: $headers" >&2; exit 1; }
  grep -qi '^x-robots-tag: noindex' <<<"$headers" || { echo "GET $path has no X-Robots-Tag" >&2; exit 1; }
  for header in content-security-policy x-content-type-options x-frame-options strict-transport-security; do
    grep -qi "^$header:" <<<"$headers" || { echo "GET $path is missing $header" >&2; exit 1; }
  done
  for tag in "${expected[@]}"; do
    grep -qF "$tag" <<<"$body" || { echo "GET $path is missing: $tag" >&2; exit 1; }
  done
  if [ -n "$og_url" ]; then
    grep -qE "<meta property=\"og:url\" content=\"https://[^\"]+$og_url\" />" <<<"$body" ||
      { echo "GET $path has no og:url ending $og_url" >&2; exit 1; }
  elif grep -q 'og:url' <<<"$body"; then
    echo "GET $path should not have an og:url" >&2
    exit 1
  fi
  echo "GET $path: 200 titled \"$title\""
}

demo_title="Julian demo · Your whole year on one screen"
check_head /demo "$demo_title" /demo
check_head "/demo/2026?month=10&day=27&details=false" "$demo_title" /demo
check_head "/demo/2026/03?month=3&day=10" "$demo_title" /demo
check_head /2026 Julian ""
check_head /calendar Julian ""
check_head /auth/callback Julian ""

for path in /demo/nope.js /demo/2026/app.css /demo/.env /demo/.git/config /demo/_headers; do
  headers=$(curl -sS -D - -o /dev/null -A "$ua" -H 'Sec-Fetch-Mode: no-cors' "$base$path")
  grep -qE '^HTTP/[0-9.]+ 404' <<<"$headers" || { echo "GET $path: $headers" >&2; exit 1; }
  for header in content-security-policy x-robots-tag; do
    grep -qi "^$header:" <<<"$headers" || { echo "GET $path is missing $header" >&2; exit 1; }
  done
  echo "GET $path: 404 with security headers"
done
