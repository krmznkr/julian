import { expect, test } from "./fixtures";

// The desktop top bar has three columns. When the right column's controls were
// wider than its track they spilled left over Today and the sync badge, which
// happened at common laptop widths (1100, 1280 and 1366px).

const widths = [768, 900, 1023, 1024, 1100, 1279, 1280, 1366, 1440, 1535, 1536, 1920] as const;

for (const width of widths) {
  test.describe(`at ${width}px`, () => {
    test.use({ viewport: { width, height: 800 } });

    test("no two top-bar controls overlap", async ({ demo: page }) => {
      const overlaps = await page.locator("header").evaluate((header) => {
        const boxes = [
          ...header.querySelectorAll<HTMLElement>("button, input, select, a, [role=status]"),
        ]
          .filter((element) => !element.parentElement?.closest("button, a, [role=status]"))
          .map((element) => ({
            name:
              element.getAttribute("aria-label") ?? element.textContent?.trim() ?? element.tagName,
            box: element.getBoundingClientRect(),
          }))
          .filter(({ box }) => box.width > 1 && box.height > 1);
        const hits: string[] = [];
        for (const [index, a] of boxes.entries())
          for (const b of boxes.slice(index + 1))
            if (
              a.box.left < b.box.right - 0.5 &&
              b.box.left < a.box.right - 0.5 &&
              a.box.top < b.box.bottom - 0.5 &&
              b.box.top < a.box.bottom - 0.5
            )
              hits.push(`${a.name} / ${b.name}`);
        return hits;
      });
      expect(overlaps).toEqual([]);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  });
}
