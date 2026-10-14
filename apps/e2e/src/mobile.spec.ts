import { devices } from "@playwright/test";
import { YEAR, expect, test, yearGrid } from "./fixtures";

test.use({ ...devices["Pixel 7"] });

test("the demo works on a narrow mobile viewport", async ({ demo: page }) => {
  await expect(page.getByRole("button", { name: "Connect my Google Calendar" })).toBeVisible();
  await expect(yearGrid(page)).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);

  await page.getByRole("button", { name: "Next year" }).tap();
  await expect(page.getByRole("spinbutton", { name: "Year" })).toHaveValue(String(YEAR + 1));
});

test("the calendars drawer opens on demand and stays out of the tab order", async ({
  demo: page,
}) => {
  const drawer = page.getByRole("dialog", { name: "Calendars" });
  await expect(drawer).toBeHidden();
  await expect(page.getByRole("checkbox", { name: "Travel" })).toHaveCount(0);

  await page.getByRole("button", { name: "Open calendars" }).tap();
  await expect(drawer).toBeVisible();
  await drawer.getByRole("checkbox", { name: "Travel" }).tap();
  await expect(drawer.getByRole("checkbox", { name: "Travel" })).not.toBeChecked();

  // The backdrop's centre sits under the drawer, so tap its exposed right edge.
  const viewport = page.viewportSize();
  await page
    .getByRole("button", { name: "Close sidebar" })
    .tap({ position: { x: (viewport?.width ?? 400) - 20, y: 200 } });
  await expect(drawer).toBeHidden();
});
