import type { Page } from "@playwright/test";
import { TODAY, YEAR, cellId, expect, test, yearGrid } from "./fixtures";

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

test("a copied deep demo link keeps its focus and query after a refresh", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-27T12:00:00Z"));
  const path = "/demo/2026?month=10&day=27&details=false";
  await page.goto(path);

  const expectCopiedState = async () => {
    await expect(page).toHaveURL(path);
    await expect(yearGrid(page)).toBeFocused();
    await expect(yearGrid(page)).toHaveAttribute("aria-activedescendant", cellId(9, 27));
    await expect(page.getByRole("dialog", { name: "October 27 events" })).toHaveCount(0);
  };
  await expectCopiedState();
  await page.reload();
  await expectCopiedState();
});

test("/{yyyy}/{mm} opens the year on that month", async ({ page }) => {
  await page.goto(`/${YEAR}/07`);
  await expectFocus(page, `/${YEAR}`, 7, 1);
});

test("/demo/{yyyy}/{mm} opens the demo on that month", async ({ page }) => {
  await page.goto(`/demo/${YEAR}/07`);
  await expectFocus(page, `/demo/${YEAR}`, 7, 1);
  await expect(yearGrid(page)).toBeVisible();
});

test("/lab is not part of the production build", async ({ page }) => {
  await page.goto("/lab");
  await expect(page.getByRole("link", { name: "Go home" })).toBeVisible();
});

test("/{yyyy} without a Google session offers sign-in or the demo", async ({ page }) => {
  await page.goto(`/${YEAR - 1}`);
  await expect(page.getByRole("button", { name: "Connect Google Calendar" })).toBeVisible();
  await page.getByRole("link", { name: "Open the demo" }).click();
  await page.waitForURL((url) => url.pathname === `/demo/${YEAR - 1}`);
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
