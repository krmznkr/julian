// Which site answers a path, and the two redirects the edge owns.
//
// One Worker serves two static builds from one assets directory: the marketing
// pages (`/home`, `/privacy`, `/terms`, built as `home.html`, `privacy.html` and
// `terms.html`) and the calendar app (everything else, through the SPA fallback
// to `index.html`; `/demo` has its own `demo.html` with the demo's share tags).
//
//   /            marketing landing, or 302 to /{yyyy} when the session hint is set
//   /year/...    301 to the same path without `/year`, keeping the query
//   /demo/...    the `/demo` page for any route below it, without a redirect
//   file paths   a real 404 when no such asset exists and it is not a navigation
//   anything     the assets binding; content-hashed scripts and styles leave
//                with a one-year immutable Cache-Control (cache.ts)
import { hasSessionHint } from "@julian/security/session-hint";
import { Clock, Effect } from "effect";
import { withHashedAssetCaching } from "./cache";
import { WorkerEnv } from "./env";

const MARKETING_HOME = "/home";

const LEGACY_YEAR_PATH = /^\/year\/(\d{4})(\/.*)?$/;

const DEMO = "/demo";

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

// `/demo/2026?month=10&day=27` is the URL a visitor copies after the app's
// redirect from `/demo`. Serve it `demo.html`, so link previews show the demo's
// title and canonical `/demo` URL instead of the generic shell's. The address
// bar and query stay as they are. `/demo/` itself is left to the assets
// binding (it redirects to `/demo`), and file-like paths keep the 404 rules.
const isDemoRoute = (pathname: string): boolean =>
  pathname.startsWith(`${DEMO}/`) && pathname.length > DEMO.length + 1 && !looksLikeFile(pathname);

const demoPage = (request: Request): Request => {
  const url = new URL(request.url);
  return new Request(new URL(`${DEMO}${url.search}`, url), request);
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

  if (isDemoRoute(url.pathname)) return yield* fetchAsset(demoPage(request));

  const asset = yield* fetchAsset(request);
  if (looksLikeFile(url.pathname) && !isNavigation(request) && isSpaFallback(url.pathname, asset)) {
    return NOT_FOUND();
  }
  return withHashedAssetCaching(request, asset);
});
