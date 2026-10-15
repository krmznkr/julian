import { readFileSync } from "node:fs";
import path from "node:path";
import { GOOGLE_SCOPES } from "@julian/google/config";
import { describe, expect, it } from "vitest";
import { ISSUES_URL, SCOPE_PURPOSES, renderPartials, renderScopes } from "./partials";

const page = (name: string) =>
  readFileSync(path.resolve(import.meta.dirname, `../${name}.html`), "utf8");

describe("marketing partials", () => {
  it("explains every scope sign-in requests, and only those", () => {
    expect(new Set(Object.keys(SCOPE_PURPOSES))).toEqual(new Set(GOOGLE_SCOPES));
    const html = renderScopes();
    GOOGLE_SCOPES.forEach((scope) => expect(html).toContain(`<code>${scope}</code>`));
    expect(html).not.toContain("userinfo");
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
    const html = renderPartials(page(name));
    expect(html).not.toMatch(/<!--\s*@/);
    expect(html).toContain('class="site-header"');
    expect(html).toContain(`href="${ISSUES_URL}"`);
    expect(html).toContain('name="robots" content="noindex');
  });

  it("states the privacy facts", () => {
    const html = renderPartials(page("privacy"));
    expect(html).toContain("<code>https://www.googleapis.com/auth/calendar.events</code>");
    expect(html).toMatch(/local storage/);
    expect(html).toMatch(/Cloudflare/);
  });
});
