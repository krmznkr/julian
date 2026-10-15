import { YEAR, expect, test, yearGrid } from "./fixtures";

test("the landing page runs the live demo with sample data", async ({ demo: page }) => {
  await expect(page).toHaveTitle(/Julian/);
  await expect(page.getByText("Demo · Sample data")).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect my Google Calendar" })).toBeEnabled();
  await expect(page.getByRole("spinbutton", { name: "Year" })).toHaveValue(String(YEAR));

  const calendars = page.getByRole("complementary");
  for (const name of ["Personal", "Work", "Family", "Travel", "Birthdays", "Tasks"]) {
    await expect(calendars.getByRole("checkbox", { name })).toBeChecked();
  }
  await expect(yearGrid(page).getByRole("button").first()).toBeVisible();
});

test("hiding a calendar removes its events from the grid", async ({ demo: page }) => {
  const grid = yearGrid(page);
  const before = await grid.getByRole("button").count();
  await page.getByRole("complementary").getByRole("checkbox", { name: "Travel" }).click();
  await expect(grid.getByRole("button")).not.toHaveCount(before);
});

test("the theme toggle cycles light, dark, and system", async ({ demo: page }) => {
  const html = page.locator("html");
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await expect(html).toHaveClass(/\blight\b/);
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(html).toHaveClass(/\bdark\b/);
  await page.getByRole("button", { name: "Switch to system theme" }).click();
  await expect(page.getByRole("button", { name: "Switch to light theme" })).toBeVisible();

  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await page.reload();
  await expect(html).toHaveClass(/\blight\b/);
});
