// Which site answers a path, and the two redirects the edge owns.
//
// One Worker serves two static builds from one assets directory: the marketing
// pages (`/home`, `/privacy`, `/terms`, prerendered as `<page>/index.html`) and
// the calendar app (everything else, through the SPA fallback to `index.html`).
//
//   /            marketing landing, or 302 to /{yyyy} when the session hint is set
//   /year/...    301 to the same path without `/year`, keeping the query
//   anything     the assets binding
import { hasSessionHint } from "@julian/security/session-hint";
import { Clock, Effect } from "effect";
import { WorkerEnv } from "./env";

export const MARKETING_HOME = "/home";

const LEGACY_YEAR_PATH = /^\/year\/(\d{4})(\/.*)?$/;

const redirect = (location: string, status: 301 | 302, headers: Record<string, string> = {}) =>
  new Response(null, { status, headers: { Location: location, ...headers } });

// The answer to `/` depends on the cookie, so no cache may share it.
const PER_VISITOR = { "Cache-Control": "private, no-store", Vary: "Cookie" };

const fetchAsset = Effect.fn("edge.asset")(function* (request: Request) {
  const env = yield* WorkerEnv;
  return yield* Effect.promise(() => env.assets.fetch(request));
});

const serveRoot = Effect.fn("edge.root")(function* (request: Request) {
  if (hasSessionHint(request.headers.get("Cookie"))) {
    // UTC is close enough: the app re-focuses on the visitor's local today.
    const year = new Date(yield* Clock.currentTimeMillis).getUTCFullYear();
    return redirect(`/${year}`, 302, PER_VISITOR);
  }
  const page = yield* fetchAsset(new Request(new URL(MARKETING_HOME, request.url), request));
  const headers = new Headers(page.headers);
  Object.entries(PER_VISITOR).forEach(([key, value]) => headers.set(key, value));
  return new Response(page.body, { status: page.status, headers });
});

export const serveSite = Effect.fn("edge.site")(function* (request: Request) {
  const url = new URL(request.url);
  if (url.pathname === "/") return yield* serveRoot(request);

  const legacy = LEGACY_YEAR_PATH.exec(url.pathname);
  if (legacy) return redirect(`/${legacy[1]}${legacy[2] ?? ""}${url.search}`, 301);

  return yield* fetchAsset(request);
});
