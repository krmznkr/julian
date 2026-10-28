import { devices, type Page } from "@playwright/test";
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

test("search works from the touch keyboard", async ({ demo: page }) => {
  const search = page.getByRole("searchbox", { name: "Search events" });
  await expect(search).toHaveAttribute("placeholder", "Search");
  await search.tap();
  await search.fill("lisbon");
  await expect(yearGrid(page).locator("mark").first()).toHaveText(/lisbon/i);
  await page.getByRole("button", { name: "Clear search" }).tap();
  await expect(search).toHaveValue("");
});

test("an all-day event moves to another day by touch", async ({ demo: page }) => {
  await page.getByRole("button", { name: "Add sample event" }).tap();
  const create = page.getByRole("dialog", { name: "New event" });
  await create.getByRole("textbox", { name: "Event title" }).fill("Dentist");
  await create.getByRole("button", { name: "Add event" }).tap();
  await expect(create).toBeHidden();

  const dentist = yearGrid(page).getByRole("button", { name: "Dentist", exact: true });
  await dentist.tap();
  await page.getByRole("button", { name: "Move to another day" }).tap();
  const move = page.getByRole("dialog", { name: "Move event" });
  await move.getByLabel("Start date").fill("2026-03-12");
  await move.getByRole("button", { name: "Move" }).tap();
  await expect(move).toBeHidden();
  await expect(dentist).toHaveAttribute("title", /Dentist · .*Mar 12/);
});

test("touch targets in the top bar are at least 32px", async ({ demo: page }) => {
  for (const name of ["Previous year", "Next year", "Open calendars", "Clear search"]) {
    const button = page.getByRole("button", { name });
    if ((await button.count()) === 0) continue;
    const box = await button.boundingBox();
    expect(box?.height ?? 0, name).toBeGreaterThanOrEqual(32);
    expect(box?.width ?? 0, name).toBeGreaterThanOrEqual(32);
  }
});

/** Top edge of the year grid's month-header row, in CSS px from the viewport top. */
const monthHeaderTop = (page: Page) =>
  page.locator("[data-year-grid-header]").evaluate((header) => header.getBoundingClientRect().top);

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`${colorScheme} theme`, () => {
    test.use({ colorScheme });

    test("the demo chrome leaves the year grid most of the screen", async ({ demo: page }) => {
      const html = expect(page.locator("html"));
      await (colorScheme === "dark"
        ? html.toHaveClass(/\bdark\b/)
        : html.not.toHaveClass(/\bdark\b/));
      // The month headers sat at 285px before the banner and tour row were
      // compacted to one row each; keep them within the top 200px.
      expect(await monthHeaderTop(page)).toBeLessThanOrEqual(200);
    });
  });
}

test("the demo notice, Connect, the tour and Reset stay on screen and reachable", async ({
  demo: page,
}) => {
  await expect(page.getByText("Demo · Sample data")).toBeVisible();
  await expect(page.getByText("Changes stay here.")).toBeVisible();
  const about = page.getByRole("link", { name: "About Julian" });
  const controls = [
    page.getByRole("button", { name: "Connect my Google Calendar" }),
    page.getByRole("button", { name: "Watch 15s tour" }),
    page.getByRole("button", { name: "Add sample event" }),
    page.getByRole("button", { name: "Reset demo" }),
  ];
  for (const control of controls) {
    await expect(control).toBeInViewport({ ratio: 1 });
    const box = await control.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(32);
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(32);
  }

  // Tab order follows the reading order: notice link, Connect, then the tour row.
  await about.focus();
  for (const control of controls) {
    await page.keyboard.press("Tab");
    await expect(control).toBeFocused();
  }

  await page.getByRole("button", { name: "Watch 15s tour" }).tap();
  await expect(page.getByText("Tour 1/3")).toBeVisible();
  await page.getByRole("button", { name: "Try it now" }).tap();
  await expect(page.getByRole("button", { name: "Watch 15s tour" })).toBeVisible();
});
