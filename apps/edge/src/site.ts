// Which site answers a path, and the two redirects the edge owns.
//
// One Worker serves two static builds from one assets directory: the marketing
// pages (`/home`, `/privacy`, `/terms`, built as `home.html`, `privacy.html` and
// `terms.html`) and the calendar app (everything else, through the SPA fallback
// to `index.html`).
//
//   /            marketing landing, or 302 to /{yyyy} when the session hint is set
//   /year/...    301 to the same path without `/year`, keeping the query
//   file paths   a real 404 when no such asset exists and it is not a navigation
//   anything     the assets binding
import { hasSessionHint } from "@julian/security/session-hint";
import { Clock, Effect } from "effect";
import { WorkerEnv } from "./env";

const MARKETING_HOME = "/home";

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

// A path naming a file (`/nope.js`, `/robots.txt`) or a hidden or config
// entry (`/.env`, `/_headers`) rather than an app route.
const looksLikeFile = (pathname: string): boolean => {
  const segments = pathname.split("/").filter((segment) => segment !== "");
  return (
    segments.some((segment) => segment.startsWith(".") || segment.startsWith("_")) ||
    pathname.slice(pathname.lastIndexOf("/")).includes(".")
  );
};

const isNavigation = (request: Request): boolean => {
  const mode = request.headers.get("Sec-Fetch-Mode");
  return mode === null
    ? (request.headers.get("Accept") ?? "").includes("text/html")
    : mode === "navigate";
};

// The SPA fallback answers every miss with `index.html`; a script or file
// request deserves a 404 instead.
const isSpaFallback = (pathname: string, response: Response): boolean =>
  !pathname.endsWith(".html") && (response.headers.get("Content-Type") ?? "").includes("text/html");

const NOT_FOUND = () =>
  new Response("Not Found", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });

export const serveSite = Effect.fn("edge.site")(function* (request: Request) {
  const url = new URL(request.url);
  if (url.pathname === "/") return yield* serveRoot(request);

  const legacy = LEGACY_YEAR_PATH.exec(url.pathname);
  if (legacy) return redirect(`/${legacy[1]}${legacy[2] ?? ""}${url.search}`, 301);

  const asset = yield* fetchAsset(request);
  if (looksLikeFile(url.pathname) && !isNavigation(request) && isSpaFallback(url.pathname, asset)) {
    return NOT_FOUND();
  }
  return asset;
});
