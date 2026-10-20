import { devices, type Page } from "@playwright/test";
import { cellId, expect, test as base, yearGrid } from "./fixtures";

/**
 * Late in the year, so the months before the current one are virtualised
 * into a spacer after the first scroll. The shared fixture's March has no
 * such spacer and cannot show the drift this file guards against.
 */
const TODAY = new Date("2026-10-20T12:00:00Z");
const CURRENT_MONTH = TODAY.getUTCMonth();

const test = base.extend<{ demo: Page }>({
  demo: async ({ page }, use) => {
    await page.clock.setFixedTime(TODAY);
    await page.goto("/demo");
    await page.waitForURL((url) => url.searchParams.has("day"));
    await expect(page.locator(`#${cellId(CURRENT_MONTH, TODAY.getUTCDate())}`)).toBeAttached({
      timeout: 15_000,
    });
    await expect(yearGrid(page)).toBeFocused();
    await use(page);
  },
});

test.use({ ...devices["Pixel 7"] });

/**
 * Where a month column sits relative to the part of the grid a reader can see:
 * right of the sticky date gutter and inside the scroll container. Positive
 * `left`/`right` values are pixels hidden on that side.
 */
async function monthPlacement(page: Page, month: number) {
  return page.evaluate((index) => {
    const grid = document.querySelector<HTMLElement>("[data-year-grid-root]");
    const gutter = grid?.querySelector<HTMLElement>(".year-grid-height.sticky");
    const column = grid?.querySelector<HTMLElement>(`[data-month-column="${index}"]`);
    if (!grid || !gutter || !column) return null;
    const visibleLeft = gutter.getBoundingClientRect().right;
    const visibleRight = grid.getBoundingClientRect().left + grid.clientWidth;
    const box = column.getBoundingClientRect();
    return {
      hiddenLeft: Math.round(visibleLeft - box.left),
      hiddenRight: Math.round(box.right - visibleRight),
      contextLeft: Math.round(box.left - visibleLeft),
      contextRight: Math.round(visibleRight - box.right),
    };
  }, month);
}

/** Waits for any smooth scroll to settle with the whole month in view. */
async function expectMonthInView(page: Page, month: number) {
  await expect
    .poll(async () => {
      const placement = await monthPlacement(page, month);
      return placement !== null && placement.hiddenLeft <= 0 && placement.hiddenRight <= 0;
    })
    .toBe(true);
}

test("the current month opens fully in view, with the months either side for context", async ({
  demo: page,
}) => {
  await expectMonthInView(page, CURRENT_MONTH);
  // The virtualiser swaps far months for spacers after the first scroll; the
  // month must still be in place once that has happened.
  await page.waitForTimeout(500);
  const placement = await monthPlacement(page, CURRENT_MONTH);
  expect(placement?.hiddenLeft).toBeLessThanOrEqual(0);
  expect(placement?.hiddenRight).toBeLessThanOrEqual(0);
  expect(placement?.contextLeft).toBeGreaterThanOrEqual(24);
  expect(placement?.contextRight).toBeGreaterThanOrEqual(24);
});

test("keyboard month steps and Today keep the target month fully in view", async ({
  demo: page,
}) => {
  const grid = yearGrid(page);
  await grid.press("Alt+ArrowDown");
  await expectMonthInView(page, CURRENT_MONTH + 1);
  for (let month = CURRENT_MONTH + 1; month > 0; month -= 1) {
    await grid.press("Alt+ArrowUp");
  }
  await expectMonthInView(page, 0);

  // From January the current month is no longer mounted, so its position is
  // computed rather than measured.
  await yearGrid(page).press("t");
  await expectMonthInView(page, CURRENT_MONTH);
  await expect(grid).toBeFocused();
});

test("a manual scroll stays where the reader left it", async ({ demo: page }) => {
  await expectMonthInView(page, CURRENT_MONTH);
  const grid = yearGrid(page);
  const scrolled = await grid.evaluate((element) => {
    element.scrollBy({ left: 300, behavior: "instant" });
    return element.scrollLeft;
  });
  await page.waitForTimeout(500);
  expect(await grid.evaluate((element) => element.scrollLeft)).toBe(scrolled);
});

test("resizing keeps the scroll position, and Today re-centres at the new width", async ({
  demo: page,
}) => {
  await expectMonthInView(page, CURRENT_MONTH);
  const grid = yearGrid(page);
  const before = await grid.evaluate((element) => element.scrollLeft);
  await page.setViewportSize({ width: 320, height: 851 });
  await page.waitForTimeout(500);
  expect(await grid.evaluate((element) => element.scrollLeft)).toBe(before);

  await yearGrid(page).press("t");
  await expectMonthInView(page, CURRENT_MONTH);
});

test.describe("at 320px", () => {
  test.use({ viewport: { width: 320, height: 851 } });

  test("the current month still opens fully in view", async ({ demo: page }) => {
    await expectMonthInView(page, CURRENT_MONTH);
    await page.waitForTimeout(500);
    const placement = await monthPlacement(page, CURRENT_MONTH);
    expect(placement?.hiddenRight).toBeLessThanOrEqual(0);
    expect(placement?.contextLeft).toBeGreaterThan(0);
  });
});
