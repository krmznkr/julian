// Link-preview metadata (Open Graph and Twitter cards) for the static pages.
//
// Each page keeps its own `<title>` and `<meta name="description">`; the build
// replaces the page's `<!-- @share -->` marker with preview tags that repeat
// them, so the two can never disagree. Preview bots need absolute URLs, and
// the origin follows the build's release channel.
import type { Channel } from "./index.ts";

const STABLE_ORIGIN = "https://julian.krmznkr.com";

// Previews deploy to per-PR URLs the build does not know, and local builds have
// no public origin, so both point at stable.
export const siteOrigin = (channel: Channel): string =>
  channel === "nightly" ? "https://julian-nightly.krmznkr.com" : STABLE_ORIGIN;

export const SHARE_IMAGE = {
  path: "/og-image.png",
  width: 1200,
  height: 630,
  alt: "Julian's year view: twelve months side by side, with trips and projects drawn as colored bars.",
} as const;

const MARKER = /<!--\s*@share\s*-->/;
const TITLE = /<title>([^<]*)<\/title>/;
const DESCRIPTION = /<meta\s+name="description"\s+content="([^"]*)"\s*\/?>/;

const required = (html: string, pattern: RegExp, what: string): RegExpExecArray => {
  const match = pattern.exec(html);
  if (match === null) throw new Error(`The page has no ${what}`);
  return match;
};

// Title text may contain a double quote that would end an attribute.
const toAttribute = (text: string) => text.trim().replaceAll('"', "&quot;");

export interface ShareTarget {
  readonly origin: string;
  // The page's one public URL path. Omitted for the app shell, which answers
  // many paths, so a preview falls back to the address that was shared.
  readonly path?: string;
}

export const withShareMeta = (html: string, { origin, path }: ShareTarget): string => {
  const marker = required(html, MARKER, "<!-- @share --> marker");
  const title = toAttribute(required(html, TITLE, "<title>")[1]);
  const description = required(html, DESCRIPTION, 'meta name="description"')[1];
  const image = `${origin}${SHARE_IMAGE.path}`;
  const tags = [
    ["property", "og:type", "website"],
    ["property", "og:site_name", "Julian"],
    ["property", "og:title", title],
    ["property", "og:description", description],
    ...(path === undefined ? [] : [["property", "og:url", `${origin}${path}`]]),
    ["property", "og:image", image],
    ["property", "og:image:type", "image/png"],
    ["property", "og:image:width", String(SHARE_IMAGE.width)],
    ["property", "og:image:height", String(SHARE_IMAGE.height)],
    ["property", "og:image:alt", SHARE_IMAGE.alt],
    // X reads the og: tags for everything but the card size.
    ["name", "twitter:card", "summary_large_image"],
  ].map(([key, name, content]) => `<meta ${key}="${name}" content="${content}" />`);
  return html.replace(marker[0], () => tags.join("\n    "));
};

const escapeText = (text: string) =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

// Swaps the page title, for a page built from another page's HTML.
export const withTitle = (html: string, title: string): string => {
  required(html, TITLE, "<title>");
  return html.replace(TITLE, () => `<title>${escapeText(title)}</title>`);
};
