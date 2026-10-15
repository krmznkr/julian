import { expect, test, yearGrid } from "./fixtures";

test("/ searches the year, highlights matches, and Escape clears", async ({ demo: page }) => {
  const grid = yearGrid(page);
  const before = await grid.getByRole("button").count();

  await page.keyboard.press("/");
  const search = page.getByRole("searchbox", { name: "Search events" });
  await expect(search).toBeFocused();
  await search.fill("lisbon");

  await expect(grid.locator("mark").first()).toHaveText(/lisbon/i);
  await expect(grid.getByRole("button")).not.toHaveCount(before);
  await expect(page.getByText(/matching event/)).toBeAttached();

  await page.keyboard.press("Escape");
  await expect(search).toHaveValue("");
  await expect(grid).toBeFocused();
  await expect(grid.getByRole("button")).toHaveCount(before);
  await expect(grid.locator("mark")).toHaveCount(0);
});
