import { devices, type Page } from "@playwright/test";
import { expect, test } from "./fixtures";

// The privacy page lists each Google permission as a long URL. On a phone it
// must wrap at a slash, so the permission name at the end ("calendar.readonly")
// stays whole and readable, without making the page scroll sideways.
const SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/tasks.readonly",
];

// `defaultBrowserType` cannot be set inside a describe group, so take only the
// emulation fields of the Pixel 7 profile.
const { viewport: pixel7, deviceScaleFactor, isMobile, hasTouch, userAgent } = devices["Pixel 7"];
const phone = { deviceScaleFactor, isMobile, hasTouch, userAgent };

const LAYOUTS = [
  { name: "a 320px phone", wraps: true, use: { ...phone, viewport: { width: 320, height: 800 } } },
  { name: "a Pixel 7", wraps: true, use: { ...phone, viewport: pixel7 } },
  { name: "a 1440px desktop", wraps: false, use: { viewport: { width: 1440, height: 900 } } },
] as const;

/**
 * Each scope as the reader sees it: its lines as laid out (a new line starts
 * where a character's box moves down) and the text a select-all copies.
 */
function renderedScopes(page: Page) {
  return page.locator(".scopes code").evaluateAll((codes) =>
    codes.map((code) => {
      const characters: { char: string; top: number }[] = [];
      const walker = document.createTreeWalker(code, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node.textContent ?? "";
        for (let i = 0; i < text.length; i++) {
          const range = document.createRange();
          range.setStart(node, i);
          range.setEnd(node, i + 1);
          characters.push({
            char: text.charAt(i),
            top: Math.round(range.getBoundingClientRect().top),
          });
        }
      }
      const lines: string[] = [];
      characters.forEach(({ char, top }, i) => {
        if (i === 0 || top !== characters[i - 1]?.top) lines.push(char);
        else lines[lines.length - 1] += char;
      });

      const selection = window.getSelection();
      const all = document.createRange();
      all.selectNodeContents(code);
      selection?.removeAllRanges();
      selection?.addRange(all);
      const copied = selection?.toString();
      selection?.removeAllRanges();

      return { lines, copied, right: code.getBoundingClientRect().right };
    }),
  );
}

for (const layout of LAYOUTS) {
  for (const colorScheme of ["light", "dark"] as const) {
    test.describe(`on ${layout.name} in ${colorScheme} mode`, () => {
      test.use({ ...layout.use, colorScheme });

      test("the privacy page keeps each permission name whole and on screen", async ({ page }) => {
        await page.goto("/privacy");
        await expect(page.locator(".scopes code")).toHaveCount(SCOPES.length);

        const scopes = await renderedScopes(page);
        const width = await page.evaluate(() => document.documentElement.clientWidth);

        scopes.forEach(({ lines, copied, right }, index) => {
          const scope = SCOPES[index] ?? "";
          const name = scope.slice(scope.lastIndexOf("/") + 1);
          expect(lines.join("")).toBe(scope);
          expect(copied).toBe(scope);
          // Lines break only after a slash, never inside "https://".
          lines.slice(0, -1).forEach((line) => expect(line).toMatch(/[^/]\/+$/));
          expect(lines.at(-1)).toContain(name);
          expect(lines.length > 1).toBe(layout.wraps);
          expect(right).toBeLessThanOrEqual(width);
        });

        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow).toBeLessThanOrEqual(0);
      });
    });
  }
}
