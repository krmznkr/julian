import { devices, type Page } from "@playwright/test";
import { cellId, expect, test, yearGrid } from "./fixtures";

/**
 * Late in the month, today's row sits near the bottom of the grid. The grid
 * must scroll it fully into view on load and as the keyboard moves, counting
 * the sticky month header and the padding above the first row.
 */
const OCTOBER = 9;

async function openDemoOn(page: Page, day: number) {
  await page.clock.setFixedTime(new Date(`2026-10-${String(day).padStart(2, "0")}T12:00:00Z`));
  await page.goto("/demo");
  await page.waitForURL((url) => url.searchParams.get("day") === String(day));
  await expect(page.locator(`#${cellId(OCTOBER, day)}`)).toBeAttached({ timeout: 15_000 });
  await expect(yearGrid(page)).toBeFocused();
}

/**
 * Pixels of a day's cell hidden on each side of the part of the grid a reader
 * can see: below the sticky header, above the scroll container's bottom
 * (excluding any scrollbar), right of the sticky date gutter.
 */
async function hiddenPixels(page: Page, day: number) {
  return page.evaluate(
    (id) => {
      const grid = document.querySelector<HTMLElement>("[data-year-grid-root]");
      const header = grid?.querySelector<HTMLElement>("[data-year-grid-header]");
      const gutter = grid?.querySelector<HTMLElement>(".year-grid-height.sticky");
      const cell = document.getElementById(id);
      if (!grid || !header || !gutter || !cell) return null;
      const area = grid.getBoundingClientRect();
      const box = cell.getBoundingClientRect();
      return {
        top: Math.max(0, Math.round(header.getBoundingClientRect().bottom - box.top)),
        bottom: Math.max(
          0,
          Math.round(box.bottom - (area.top + grid.clientTop + grid.clientHeight)),
        ),
        left: Math.max(0, Math.round(gutter.getBoundingClientRect().right - box.left)),
        right: Math.max(
          0,
          Math.round(box.right - (area.left + grid.clientLeft + grid.clientWidth)),
        ),
      };
    },
    cellId(OCTOBER, day),
  );
}

const FULLY_VISIBLE = { top: 0, bottom: 0, left: 0, right: 0 };

/** Waits for any smooth scroll to settle with the day's cell fully in view. */
async function expectDayFullyVisible(page: Page, day: number) {
  await expect
    .poll(() => hiddenPixels(page, day), { message: `October ${day}` })
    .toEqual(FULLY_VISIBLE);
}

function scrollTop(page: Page) {
  return page.evaluate(
    () => document.querySelector<HTMLElement>("[data-year-grid-root]")?.scrollTop ?? null,
  );
}

const pixel7 = devices["Pixel 7"];

for (const [name, device] of [
  ["desktop 1440x900", { viewport: { width: 1440, height: 900 } }],
  [
    "Pixel 7",
    {
      viewport: pixel7.viewport,
      deviceScaleFactor: pixel7.deviceScaleFactor,
      isMobile: pixel7.isMobile,
      hasTouch: pixel7.hasTouch,
      userAgent: pixel7.userAgent,
    },
  ],
] as const) {
  test.describe(name, () => {
    test.use(device);

    for (const day of [24, 27]) {
      test(`today, October ${day}, opens fully in view`, async ({ page }) => {
        await openDemoOn(page, day);
        await expectDayFullyVisible(page, day);
      });
    }

    test("an early-month today needs no scroll", async ({ page }) => {
      await openDemoOn(page, 12);
      await expectDayFullyVisible(page, 12);
      expect(await scrollTop(page)).toBe(0);
    });

    test("arrowing to the end of the month and back keeps the active day in view", async ({
      page,
    }) => {
      await openDemoOn(page, 24);
      const grid = yearGrid(page);

      for (let day = 25; day <= 31; day++) {
        await page.keyboard.press("ArrowDown");
        await expect(grid).toHaveAttribute("aria-activedescendant", cellId(OCTOBER, day));
        await expectDayFullyVisible(page, day);
      }
      for (let day = 30; day >= 1; day--) {
        await page.keyboard.press("ArrowUp");
        await expect(grid).toHaveAttribute("aria-activedescendant", cellId(OCTOBER, day));
        await expectDayFullyVisible(page, day);
      }
    });
  });
}

test.describe("desktop tour", () => {
  // The tour autoplays only on wide screens without reduced motion.
  test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: "no-preference" });

  for (const day of [12, 27]) {
    test(`step 1 opens October ${day}'s details beside the day`, async ({ page }) => {
      await openDemoOn(page, day);
      await expect(page.getByText("Tour 1/3")).toBeVisible();
      const details = page.getByRole("dialog", { name: `October ${day} events` });
      await expect(details).toBeVisible();
      // The tour closes the panel after a second, so measure it straight away.
      const panel = await details.boundingBox();
      const cell = await page.locator(`#${cellId(OCTOBER, day)}`).boundingBox();
      if (!panel || !cell) throw new Error("missing panel or cell box");
      await expectDayFullyVisible(page, day);

      // The panel shares the day's row and touches its side, within the 6 px offset.
      expect(panel.y).toBeLessThan(cell.y + cell.height);
      expect(panel.y + panel.height).toBeGreaterThan(cell.y);
      const gap = Math.min(
        Math.abs(cell.x - (panel.x + panel.width)),
        Math.abs(panel.x - (cell.x + cell.width)),
      );
      expect(gap).toBeLessThanOrEqual(8);
      // And it stays on screen.
      expect(panel.y).toBeGreaterThanOrEqual(0);
      expect(panel.y + panel.height).toBeLessThanOrEqual(900);
    });
  }
});
