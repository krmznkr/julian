import { expect, test, yearGrid } from "./fixtures";

async function createDentist(page: import("@playwright/test").Page) {
  await page.keyboard.press("n");
  const create = page.getByRole("dialog", { name: "New event" });
  await create.getByRole("textbox", { name: "Event title" }).fill("Dentist");
  await create.getByRole("button", { name: "Add event" }).click();
  await expect(create).toBeHidden();
}

test("an all-day event can be dragged to another day", async ({ demo: page }) => {
  const grid = yearGrid(page);
  await createDentist(page);

  const chip = grid.getByRole("button", { name: /^Dentist, Mar 10/ });
  const target = page.locator('[data-month-column="2"] [data-day-cell-frame="13"]');
  const box = await target.boundingBox();
  if (!box) throw new Error("No March 13 cell");
  await chip.hover();
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();

  await expect(grid.getByRole("button", { name: /^Dentist, Mar 13/ })).toBeVisible();
  await expect(grid.getByRole("button", { name: /^Dentist, Mar 10/ })).toHaveCount(0);
});

test("M moves the selected event from the keyboard", async ({ demo: page }) => {
  const grid = yearGrid(page);
  await createDentist(page);

  await grid.getByRole("button", { name: /^Dentist, Mar 10/ }).click();
  await expect(page.getByRole("option", { name: /Dentist/, selected: true })).toBeVisible();
  await page.keyboard.press("m");
  const move = page.getByRole("dialog", { name: "Move event" });
  const date = move.getByLabel("Start date");
  await expect(date).toHaveValue("2026-03-10");
  await date.fill("2026-04-02");
  await move.getByRole("button", { name: "Move" }).click();
  await expect(move).toBeHidden();
  await expect(grid).toBeFocused();

  await expect(grid.getByRole("button", { name: /^Dentist, Apr 2/ })).toBeVisible();
});
