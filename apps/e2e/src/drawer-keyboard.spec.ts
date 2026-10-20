import type { Page } from "@playwright/test";
import { YEAR, expect, test, yearGrid } from "./fixtures";

// Below 768px the Calendars sidebar is a modal drawer. These drive it with the
// keyboard only, at the narrowest phone, a Pixel 7 and the widest drawer width.

const drawer = (page: Page) => page.getByRole("dialog", { name: "Calendars" });
const opener = (page: Page) => page.getByRole("button", { name: "Open calendars" });
const search = (page: Page) => page.getByRole("searchbox", { name: "Search events" });

async function openWithKeyboard(page: Page) {
  // Day details may already be open. Enter still activates the focused opener.
  await opener(page).focus();
  await page.keyboard.press("Enter");
  await expect(drawer(page)).toBeVisible();
}

const focusInsideDrawer = (page: Page) =>
  expect(drawer(page).locator(":focus"), "focus stays in the drawer").toHaveCount(1);

for (const width of [320, 412, 767]) {
  for (const colorScheme of ["light", "dark"] as const) {
    test.describe(`calendars drawer at ${width}px, ${colorScheme}`, () => {
      test.use({ viewport: { width, height: 839 }, colorScheme });

      test.beforeEach(async ({ demo: page }) => {
        const html = expect(page.locator("html"));
        await (colorScheme === "dark"
          ? html.toHaveClass(/\bdark\b/)
          : html.not.toHaveClass(/\bdark\b/));
      });

      test("opens with focus inside, contains Tab, and closes back to its opener", async ({
        demo: page,
      }) => {
        await openWithKeyboard(page);
        const panel = drawer(page);
        const connect = panel.getByRole("button", { name: "Connect Google Calendar" });
        const tasks = panel.getByRole("checkbox", { name: "Tasks" });
        await expect(connect).toBeFocused();
        await expect(page.locator("#main-content")).toHaveAttribute("inert", "");

        // A full lap of Tab never leaves the drawer and comes back around.
        for (let step = 0; step < 8; step++) {
          await page.keyboard.press("Tab");
          await focusInsideDrawer(page);
        }
        await tasks.focus();
        await page.keyboard.press("Tab");
        await expect(connect).toBeFocused();
        await page.keyboard.press("Shift+Tab");
        await expect(tasks).toBeFocused();

        await page.keyboard.press("Escape");
        await expect(panel).toBeHidden();
        await expect(opener(page)).toBeFocused();
        await expect(page.locator("#main-content")).not.toHaveAttribute("inert");

        // The backdrop closes it the same way. Its exposed strip is the right edge.
        await openWithKeyboard(page);
        await page
          .getByRole("button", { name: "Close sidebar" })
          .click({ position: { x: width - 12, y: 300 } });
        await expect(panel).toBeHidden();
        await expect(opener(page)).toBeFocused();
      });

      test("/ and Ctrl/Meta+K close the drawer before moving focus", async ({ demo: page }) => {
        await openWithKeyboard(page);
        await drawer(page).getByRole("checkbox", { name: "Travel" }).focus();
        await page.keyboard.press("/");
        await expect(drawer(page)).toBeHidden();
        await expect(search(page)).toBeFocused();
        await page.keyboard.type("lisbon");
        await expect(search(page)).toHaveValue("lisbon");
        await page.keyboard.type("/");
        await page.keyboard.press("Control+k");
        await expect(search(page)).toBeFocused();
        await expect(search(page)).toHaveValue("lisbon/");
        await expect(page.getByRole("dialog", { name: "Commands" })).toBeHidden();

        for (const chord of ["Control+k", "Meta+k"]) {
          await openWithKeyboard(page);
          await drawer(page).getByRole("checkbox", { name: "Travel" }).focus();
          await page.keyboard.press(chord);
          await expect(drawer(page)).toBeHidden();
          const commands = page.getByRole("dialog", { name: "Commands" });
          await expect(commands.getByRole("combobox")).toBeFocused();
          await page.keyboard.type("today");
          await expect(commands.getByRole("combobox")).toHaveValue("today");
          await page.keyboard.press("Escape");
          await expect(commands).toBeHidden();
          await expect(yearGrid(page)).toBeFocused();
        }
      });

      test("a command can hand focus to another portaled dialog", async ({ demo: page }) => {
        await openWithKeyboard(page);
        await page.keyboard.press("Control+k");
        const commands = page.getByRole("dialog", { name: "Commands" });
        const input = commands.getByRole("combobox");
        await expect(input).toBeFocused();
        await input.fill("Show keyboard shortcuts");
        await page.keyboard.press("Enter");
        const help = page.getByRole("dialog", { name: "Keyboard shortcuts" });
        await expect(commands).toBeHidden();
        await expect(help.getByRole("button", { name: "Close", exact: true })).toBeFocused();
        await page.keyboard.press("Tab");
        await expect(help.locator(":focus")).toHaveCount(1);
        await page.keyboard.press("Escape");
        await expect(help).toBeHidden();
        await expect(drawer(page)).toBeHidden();
        await expect(yearGrid(page)).toBeFocused();
        await openWithKeyboard(page);
        await focusInsideDrawer(page);
      });

      test("widening past 768px releases the drawer and keeps state", async ({ demo: page }) => {
        await search(page).fill("lisbon");
        await openWithKeyboard(page);
        const travel = drawer(page).getByRole("checkbox", { name: "Travel" });
        await travel.focus();
        await page.keyboard.press("Space");
        await expect(travel).not.toBeChecked();

        await page.setViewportSize({ width: 768, height: 839 });
        await expect(drawer(page)).toBeHidden();
        await expect(page.locator("#main-content")).not.toHaveAttribute("inert");
        await expect(yearGrid(page)).toBeFocused();
        // The grid takes keys again, and nothing locked the page's scrolling.
        await page.keyboard.press("ArrowDown");
        await expect(yearGrid(page)).toBeFocused();
        const overflow = await page.evaluate(() => getComputedStyle(document.body).overflow);
        expect(overflow).not.toBe("hidden");
        await expect(page.getByRole("checkbox", { name: "Travel" })).not.toBeChecked();
        await expect(search(page)).toHaveValue("lisbon");

        await page.setViewportSize({ width, height: 839 });
        await expect(drawer(page)).toBeHidden();
        await openWithKeyboard(page);
        await focusInsideDrawer(page);
      });
    });
  }
}

test.describe("desktop", () => {
  test("Commands hands focus back to the grid, and Enter on a top-bar button presses it", async ({
    demo: page,
  }) => {
    await yearGrid(page).focus();
    await page.keyboard.press("Control+k");
    await expect(
      page.getByRole("dialog", { name: "Commands" }).getByRole("combobox"),
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(yearGrid(page)).toBeFocused();

    if (new URL(page.url()).searchParams.get("details") === "true") {
      await page.keyboard.press("Escape");
    }
    await page.getByRole("button", { name: "Next year" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("spinbutton", { name: "Year" })).toHaveValue(String(YEAR + 1));
    await expect(page).toHaveURL(/details=false/);
  });
});
