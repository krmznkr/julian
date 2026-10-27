import { readFileSync } from "node:fs";
import path from "node:path";
import { GOOGLE_SCOPES } from "@julian/google/config";
import { withShareMeta } from "@julian/release/share";
import { describe, expect, it } from "vitest";
import {
  ISSUES_URL,
  SCOPE_PURPOSES,
  breakAtSlashes,
  renderPartials,
  renderScopes,
} from "./partials";

const ORIGIN = "https://julian.krmznkr.com";

// What a reader sees and copies: `<wbr>` adds no text, and entities decode.
const visibleText = (html: string) =>
  html
    .replaceAll("<wbr>", "")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");

const codeContents = (html: string) =>
  [...html.matchAll(/<code>(.*?)<\/code>/g)].map(([, inner]) => inner ?? "");

// As the build does it: preview tags, then the shared chrome.
const rendered = (name: string) =>
  renderPartials(
    withShareMeta(readFileSync(path.resolve(import.meta.dirname, `../${name}.html`), "utf8"), {
      origin: ORIGIN,
      path: `/${name}`,
    }),
  );

describe("marketing partials", () => {
  it("explains every scope sign-in requests, and only those", () => {
    expect(new Set(Object.keys(SCOPE_PURPOSES))).toEqual(new Set(GOOGLE_SCOPES));
    const html = renderScopes();
    expect(codeContents(html).map(visibleText)).toEqual(GOOGLE_SCOPES);
    expect(html).not.toContain("userinfo");
  });

  it("lets each scope wrap only at a path boundary, keeping the scope name whole", () => {
    codeContents(renderScopes()).forEach((code) => {
      const lines = code.split("<wbr>").filter((line) => line !== "");
      // Every possible line ends at a slash, and "https://" stays together.
      lines.slice(0, -1).forEach((line) => expect(line).toMatch(/[^/]\/+$/));
      expect(lines[0]).toBe("https://");
      expect(lines.at(-1)).toMatch(/^(calendar|tasks)\.[a-z]+$/);
    });
  });

  it("escapes a URL while marking its path breaks", () => {
    const url = "https://example.test/a<b>&c//d";
    const html = breakAtSlashes(url);
    expect(html).not.toMatch(/<(?!wbr>)/);
    expect(html).not.toMatch(/&(?!(amp|lt|gt);)/);
    expect(visibleText(html)).toBe(url);
    expect(html.split("<wbr>")).toEqual(["https://", "example.test/", "a&lt;b&gt;&amp;c//", "d"]);
  });

  it("refuses a scope the privacy page does not explain", () => {
    expect(() => renderScopes(["https://www.googleapis.com/auth/drive"])).toThrow(/drive/);
  });

  it("draws the header logo in the text color so it shows in dark mode", () => {
    const html = renderPartials("<!-- @header -->");
    expect(html).toContain('stroke="currentColor"');
    expect(html).not.toContain("#111111");
  });

  it("refuses an unknown partial", () => {
    expect(() => renderPartials("<!-- @sidebar -->")).toThrow(/@sidebar/);
  });

  it.each(["home", "privacy", "terms"])("renders %s.html with the shared chrome", (name) => {
    const html = rendered(name);
    expect(html).not.toMatch(/<!--\s*@/);
    expect(html).toContain(`property="og:image" content="${ORIGIN}/og-image.png"`);
    expect(html).toContain('class="site-header"');
    expect(html).toContain(`href="${ISSUES_URL}"`);
    expect(html).toContain('name="robots" content="noindex');
  });

  it("states the privacy facts", () => {
    const html = rendered("privacy");
    expect(codeContents(html).map(visibleText)).toContain(
      "https://www.googleapis.com/auth/calendar.events",
    );
    expect(html).toMatch(/local storage/);
    expect(html).toMatch(/Cloudflare/);
  });
});
