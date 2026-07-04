// Cloudflare Worker for julian.krmznkr.com.
//
// It serves the static SPA (via the ASSETS binding) and exposes two OAuth
// endpoints that perform the Google token exchange server-side. This keeps the
// client secret out of the browser bundle — the frontend only ever posts the
// PKCE code / refresh token here, and this Worker adds the secret.

interface Env {
  ASSETS: Fetcher;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
}

const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Forwards a token request to Google with the server-held client credentials
// and passes Google's response (body + status) straight back to the caller.
async function exchangeWithGoogle(body: URLSearchParams): Promise<Response> {
  const res = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  return new Response(res.body, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/oauth/")) {
      if (request.method !== "POST") {
        return json({ error: "method_not_allowed" }, 405);
      }
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
    return env.ASSETS.fetch(request);
  },
};
