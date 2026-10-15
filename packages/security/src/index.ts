// Single source of truth for the response hardening headers.
//
// The edge Worker applies them to every response, and the web build emits the
// same map as `dist/_headers` (see `apps/web/vite.config.ts`), so they can never drift.

// Content-Security-Policy tuned to exactly what the app needs:
//   - scripts/styles/assets are all same-origin (Vite output + bootstrap.js)
//   - the browser calls our own /api/oauth (self) and the Google Calendar API
//   - Google sign-in is a top-level navigation to accounts.google.com
//   - images are same-origin or data URIs; nothing loads remote images
//   - the page may never be framed (clickjacking) and can't be a frame target
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self' https://www.googleapis.com",
  "form-action 'self' https://accounts.google.com",
  "upgrade-insecure-requests",
].join("; ");

export const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy": CONTENT_SECURITY_POLICY,
  "Strict-Transport-Security": "max-age=15552000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  // Reinforces robots.txt / the noindex meta on every response, including
  // assets and API replies, so nothing this Worker emits is ever indexed.
  "X-Robots-Tag": "noindex, nofollow",
};

// Renders the headers in Cloudflare's `_headers` file format for all paths.
export function renderHeadersFile(): string {
  const lines = Object.entries(SECURITY_HEADERS).map(([key, value]) => `  ${key}: ${value}`);
  return ["/*", ...lines, ""].join("\n");
}
