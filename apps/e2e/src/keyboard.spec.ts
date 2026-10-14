import { cellId, expect, test, yearGrid } from "./fixtures";

test("arrow keys move the active day and month", async ({ demo: page }) => {
  const grid = yearGrid(page);
  await expect(grid).toHaveAttribute("aria-activedescendant", cellId(2, 10));

  await page.keyboard.press("ArrowDown");
  await expect(grid).toHaveAttribute("aria-activedescendant", cellId(2, 11));
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  await expect(grid).toHaveAttribute("aria-activedescendant", cellId(2, 9));

  await page.keyboard.press("ArrowRight");
  await expect(grid).toHaveAttribute("aria-activedescendant", cellId(3, 9));
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await expect(grid).toHaveAttribute("aria-activedescendant", cellId(1, 9));

  await page.keyboard.press("End");
  await expect(grid).toHaveAttribute("aria-activedescendant", cellId(1, 28));
  await page.keyboard.press("Home");
  await expect(grid).toHaveAttribute("aria-activedescendant", cellId(1, 1));
});

test("typing digits jumps to a day, Shift+digits to a month", async ({ demo: page }) => {
  const grid = yearGrid(page);
  await page.keyboard.type("25");
  await expect(grid).toHaveAttribute("aria-activedescendant", cellId(2, 25));
  await page.keyboard.press("Shift+Digit7");
  await expect(grid).toHaveAttribute("aria-activedescendant", cellId(6, 25));
});

test("Enter opens day details and Escape closes them", async ({ demo: page }) => {
  await page.keyboard.press("Enter");
  const details = page.getByRole("dialog", { name: /events$/ });
  await expect(details).toBeVisible();
  await expect(page.locator(`#${cellId(2, 10)}`)).toHaveAttribute("aria-current", "true");

  await page.keyboard.press("Escape");
  await expect(details).toBeHidden();
  await expect(yearGrid(page)).toBeFocused();
});

test("? opens the keyboard shortcuts dialog", async ({ demo: page }) => {
  await page.keyboard.press("Shift+Slash");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
});
