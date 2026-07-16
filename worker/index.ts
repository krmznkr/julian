// Cloudflare Worker for julian.krmznkr.com.
//
// It serves the static SPA (via the ASSETS binding) and exposes two OAuth
// endpoints that perform the Google token exchange server-side. This keeps the
// client secret out of the browser bundle — the frontend only ever posts the
// PKCE code / refresh token here, and this Worker adds the secret.
//
// Security posture (portfolio showcase, shared by direct link only):
//   - Every response carries hardening headers (CSP, HSTS, nosniff, no-frame,
//     and X-Robots-Tag noindex so nothing gets indexed even outside robots.txt).
//   - The OAuth proxy only answers same-site browser requests (Origin allowlist)
//     and rejects oversized bodies, so drive-by bots can't spam Google through it.

interface Env {
  ASSETS: Fetcher;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
}

const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

// Only the app's own origins may call the OAuth proxy. Anything else (curl,
// scrapers, cross-site pages) is rejected before we ever talk to Google.
const ALLOWED_ORIGINS = new Set([
  "https://julian.krmznkr.com",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
]);

// OAuth JSON bodies are tiny; anything larger is abuse or a bug.
const MAX_OAUTH_BODY_BYTES = 4096;

// Content-Security-Policy tuned to exactly what the app needs:
//   - scripts/styles/assets are all same-origin (Vite output + bootstrap.js)
//   - the browser calls our own /api/oauth (self) and the Google Calendar API
//   - Google sign-in is a top-level navigation to accounts.google.com
//   - avatars can come from Google's user-content CDN (https:) or data URIs
//   - the page may never be framed (clickjacking) and can't be a frame target
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://www.googleapis.com",
  "form-action 'self' https://accounts.google.com",
  "upgrade-insecure-requests",
].join("; ");

const SECURITY_HEADERS: Record<string, string> = {
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

// Copies a response and layers the hardening headers on top. Existing headers
// (content-type, cache-control from the assets binding, etc.) are preserved.
function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function json(data: unknown, status = 200): Response {
  return withSecurityHeaders(
    new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

// Forwards a token request to Google with the server-held client credentials
// and passes Google's response (body + status) straight back to the caller.
async function exchangeWithGoogle(body: URLSearchParams): Promise<Response> {
  const res = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  return withSecurityHeaders(
    new Response(res.body, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

async function handleTokenExchange(request: Request, env: Env): Promise<Response> {
  const { code, code_verifier, redirect_uri } = (await request.json()) as {
    code?: string;
    code_verifier?: string;
    redirect_uri?: string;
  };
  if (!code || !code_verifier || !redirect_uri) {
    return json(
      { error: "invalid_request", error_description: "Missing code/code_verifier/redirect_uri" },
      400,
    );
  }
  return exchangeWithGoogle(
    new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      code,
      code_verifier,
      grant_type: "authorization_code",
      redirect_uri,
    }),
  );
}

async function handleRefresh(request: Request, env: Env): Promise<Response> {
  const { refresh_token } = (await request.json()) as { refresh_token?: string };
  if (!refresh_token) {
    return json({ error: "invalid_request", error_description: "Missing refresh_token" }, 400);
  }
  return exchangeWithGoogle(
    new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token,
      grant_type: "refresh_token",
    }),
  );
}

// Gate the OAuth proxy: same-site browser POSTs only, with a sane body size.
// Returns an error Response to short-circuit, or null to proceed.
function rejectDisallowedOAuthRequest(request: Request): Response | null {
  if (request.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }
  const origin = request.headers.get("Origin");
  if (!origin || !ALLOWED_ORIGINS.has(origin)) {
    return json({ error: "forbidden", error_description: "Origin not allowed" }, 403);
  }
  const contentLength = Number(request.headers.get("Content-Length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_OAUTH_BODY_BYTES) {
    return json({ error: "payload_too_large" }, 413);
  }
  return null;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/oauth/")) {
      const rejected = rejectDisallowedOAuthRequest(request);
      if (rejected) return rejected;
      if (!env.GOOGLE_CLIENT_SECRET) {
        return json(
          { error: "server_misconfigured", error_description: "GOOGLE_CLIENT_SECRET is not set" },
          500,
        );
      }
      try {
        if (url.pathname === "/api/oauth/token") return await handleTokenExchange(request, env);
        if (url.pathname === "/api/oauth/refresh") return await handleRefresh(request, env);
      } catch {
        return json({ error: "bad_request", error_description: "Invalid JSON body" }, 400);
      }
      return json({ error: "not_found" }, 404);
    }

    // Everything else is the static SPA (index.html fallback handled by the
    // assets binding's single-page-application not_found_handling).
    const assetResponse = await env.ASSETS.fetch(request);
    return withSecurityHeaders(assetResponse);
  },
};
