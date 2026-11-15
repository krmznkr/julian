import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

// The desktop top bar has three columns. When the right column's controls were
// wider than its track they spilled left over Today and the sync badge, which
// happened at common laptop widths (1100, 1280 and 1366px).

const widths = [600, 768, 900, 1023, 1024, 1100, 1279, 1280, 1366, 1440, 1535, 1536, 1920] as const;

// The longest label the badge can show: one failed source named by its raw id.
const LONG_BADGE = "Could not load calendar:c_0123456789abcdef@group.calendar.google.com";

const layoutProblems = (page: Page) =>
  page.locator("header").evaluate((header) => {
    const bar = header.getBoundingClientRect();
    const boxes = [
      ...header.querySelectorAll<HTMLElement>("button, input, select, a, [role=status]"),
    ]
      .filter((element) => !element.parentElement?.closest("button, a, [role=status]"))
      .map((element) => ({
        name: element.getAttribute("aria-label") ?? element.textContent?.trim() ?? element.tagName,
        box: element.getBoundingClientRect(),
      }))
      .filter(({ box }) => box.width > 1 && box.height > 1);
    const problems: string[] = [];
    for (const { name, box } of boxes)
      if (
        box.left < -0.5 ||
        box.right > window.innerWidth + 0.5 ||
        box.top < -0.5 ||
        box.bottom > bar.bottom + 0.5
      )
        problems.push(`${name} outside the bar`);
    for (const [index, a] of boxes.entries())
      for (const b of boxes.slice(index + 1))
        if (
          a.box.left < b.box.right - 0.5 &&
          b.box.left < a.box.right - 0.5 &&
          a.box.top < b.box.bottom - 0.5 &&
          b.box.top < a.box.bottom - 0.5
        )
          problems.push(`${a.name} / ${b.name}`);
    return problems;
  });

for (const width of widths) {
  test.describe(`at ${width}px`, () => {
    test.use({ viewport: { width, height: 800 } });

    test("no top-bar control overlaps another or leaves the bar", async ({ demo: page }) => {
      expect(await layoutProblems(page)).toEqual([]);

      // A failure badge names the source; it truncates instead of spilling.
      await page
        .locator("header [role=status]")
        .first()
        .locator("span")
        .last()
        .evaluate((label, text) => {
          label.textContent = text;
        }, LONG_BADGE);
      expect(await layoutProblems(page)).toEqual([]);
    });
  });
}
