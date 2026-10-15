import type { Page } from "@playwright/test";
import { TODAY, YEAR, expect, test, yearGrid } from "./fixtures";

async function expectFocus(page: Page, pathname: string, month: number, day: number) {
  await page.waitForURL(
    (url) =>
      url.pathname === pathname &&
      url.searchParams.get("month") === String(month) &&
      url.searchParams.get("day") === String(day),
  );
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(TODAY);
});

test("/demo opens the demo on today", async ({ page }) => {
  await page.goto("/demo");
  await expectFocus(page, `/demo/${YEAR}`, 3, 10);
  await expect(yearGrid(page)).toBeFocused();
});

test("/{yyyy}/{mm} opens the year on that month", async ({ page }) => {
  await page.goto(`/${YEAR}/07`);
  await expectFocus(page, `/${YEAR}`, 7, 1);
});

test("a legacy /year path lands on the new URL", async ({ page }) => {
  await page.goto(`/year/${YEAR}?month=5&day=2`);
  await expectFocus(page, `/${YEAR}`, 5, 2);
});

test("an out-of-range year is not found", async ({ page }) => {
  await page.goto("/1900");
  await expect(page.getByRole("link", { name: "Go home" })).toHaveAttribute("href", "/home");
});

test("the demo labels its sample data and links to the marketing site", async ({ page }) => {
  await page.goto(`/demo/${YEAR}`);
  await page.getByRole("link", { name: "About Julian" }).click();
  await expect(page).toHaveURL("/home");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Your whole year on one screen.",
  );
});
