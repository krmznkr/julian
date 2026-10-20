import { cellId, expect, test, yearGrid } from "./fixtures";

test("an event can be created, renamed, and deleted in the demo", async ({ demo: page }) => {
  const grid = yearGrid(page);

  await page.keyboard.press("n");
  const create = page.getByRole("dialog", { name: "New event" });
  await expect(create.getByRole("textbox", { name: "Event title" })).toBeFocused();
  await create.getByRole("textbox", { name: "Event title" }).fill("Dentist");
  await create.getByRole("button", { name: "Add event" }).click();
  await expect(create).toBeHidden();
  const created = grid.getByRole("button", { name: "Dentist", exact: true });
  await expect(created).toBeVisible();

  await created.click();
  await expect(page.getByRole("dialog", { name: /events$/ })).toBeVisible();
  await expect(page.getByRole("option", { name: /Dentist/, selected: true })).toBeVisible();
  await page.keyboard.press("e");
  const edit = page.getByRole("dialog", { name: "Edit event" });
  await expect(edit.getByRole("textbox", { name: "Event title" })).toHaveValue("Dentist");
  await edit.getByRole("textbox", { name: "Event title" }).fill("Dentist check-up");
  await edit.getByRole("button", { name: "Save" }).click();
  await expect(edit).toBeHidden();
  const renamed = grid.getByRole("button", { name: "Dentist check-up", exact: true });
  await expect(renamed).toBeVisible();
  await expect(renamed).toHaveAttribute("title", /Dentist check-up · .*Mar 10/);

  await page.keyboard.press("ControlOrMeta+Backspace");
  const remove = page.getByRole("dialog", { name: "Delete event?" });
  await expect(remove.getByRole("button", { name: "Delete" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(remove).toBeHidden();
  await expect(grid.getByRole("button", { name: "Dentist check-up", exact: true })).toHaveCount(0);
  await expect(grid).toHaveAttribute("aria-activedescendant", cellId(2, 10));
});

test("the Add sample event button opens the create dialog", async ({ demo: page }) => {
  await page.getByRole("button", { name: "Add sample event" }).click();
  await expect(page.getByRole("dialog", { name: "New event" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog", { name: "New event" })).toBeHidden();
});

test("closing a dialog opened from the grid returns focus to the grid", async ({ demo: page }) => {
  await page.keyboard.press("n");
  await expect(page.getByRole("dialog", { name: "New event" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "New event" })).toBeHidden();
  await expect(yearGrid(page)).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(yearGrid(page)).toHaveAttribute("aria-activedescendant", cellId(2, 11));
});
