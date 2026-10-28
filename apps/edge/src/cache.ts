// Long-lived browser caching for the build's content-hashed scripts and styles.
//
// Vite writes every bundled script and stylesheet as `<name>-<hash>.js|css`
// directly under `/assets/` (the app) or `/_marketing/` (the marketing pages).
// The hash changes whenever the content does, so such a URL always names the
// same bytes. The assets binding answers every file with
// `public, max-age=0, must-revalidate`, which costs each returning visitor one
// revalidation round trip per file on every page load.
//
// A response is upgraded only when it shows it is that file:
//   - a GET or HEAD with no query string,
//   - a path in the bundler's exact naming (one segment, 8-character hash),
//   - a 200, or a 304 that confirms a copy the browser already holds,
//   - a JavaScript or CSS Content-Type (a miss would be the HTML fallback),
//   - nothing marking it per-visitor: no Set-Cookie, no `private` or `no-store`.
// Everything else (HTML, `/bootstrap.js`, `/version.json`, redirects, errors,
// other file types) keeps the header it arrived with. If Vite ever changes its
// naming, the rule stops matching and assets fall back to revalidation.

export const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";

const HASHED_ASSET_PATH = /^\/(?:assets|_marketing)\/[\w.-]+-[\w-]{8}\.(?:js|css)$/;

const SCRIPT_OR_STYLE = new Set(["text/javascript", "application/javascript", "text/css"]);

const mediaType = (response: Response): string =>
  (response.headers.get("Content-Type") ?? "").split(";")[0].trim().toLowerCase();

const isPerVisitor = (response: Response): boolean =>
  response.headers.has("Set-Cookie") ||
  /\b(?:private|no-store)\b/i.test(response.headers.get("Cache-Control") ?? "");

const isHashedAssetResponse = (request: Request, response: Response): boolean => {
  const url = new URL(request.url);
  return (
    (request.method === "GET" || request.method === "HEAD") &&
    url.search === "" &&
    HASHED_ASSET_PATH.test(url.pathname) &&
    (response.status === 200 || response.status === 304) &&
    SCRIPT_OR_STYLE.has(mediaType(response)) &&
    !isPerVisitor(response)
  );
};

export const withHashedAssetCaching = (request: Request, response: Response): Response => {
  if (!isHashedAssetResponse(request, response)) return response;
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", IMMUTABLE_CACHE_CONTROL);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};
