import { test as base, expect, type Page } from "@playwright/test";

/**
 * The demo anchors its sample year to "today", so every test pins the clock to
 * a fixed date. Timers still run, only `Date` is frozen.
 */
export const TODAY = new Date("2026-03-10T12:00:00Z");
export const YEAR = TODAY.getUTCFullYear();

/** Mirrors `cellDomId` in the web app; months are zero-based. */
export function cellId(month: number, day: number, year = YEAR) {
  return `year-grid-cell-${year}-${month}-${day}`;
}

export const test = base.extend<{ demo: Page }>({
  demo: async ({ page }, use) => {
    await page.clock.setFixedTime(TODAY);
    await page.goto("/");
    await expect(yearGrid(page)).toBeFocused();
    await use(page);
  },
});

export function yearGrid(page: Page) {
  return page.getByRole("region", { name: `Calendar for ${YEAR}` }).getByRole("application");
}

export { expect };
