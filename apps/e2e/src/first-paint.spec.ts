import type { Route } from "@playwright/test";
import { TODAY, expect, test, yearGrid } from "./fixtures";

const LOADING = "Loading calendar...";
const NO_SCRIPT = "Julian needs JavaScript to show your calendar.";

test("/demo paints its loading screen before the app's JavaScript arrives", async ({ page }) => {
  await page.clock.setFixedTime(TODAY);
  // Hold the entry chunk: whatever is on screen meanwhile came from the HTML alone.
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  let intercepted!: () => void;
  const entryRequested = new Promise<void>((resolve) => (intercepted = resolve));
  await page.route("**/assets/index-*.js", async (route: Route) => {
    intercepted();
    await held;
    await route.continue();
  });

  try {
    await page.goto("/demo", { waitUntil: "commit" });
    // Proves the hold applies: a renamed entry chunk would fail here, not pass silently.
    await entryRequested;
    await expect(page.getByText(LOADING, { exact: true })).toBeVisible();
    await expect(page.getByText(NO_SCRIPT)).toBeHidden();
  } finally {
    release();
  }
  await expect(yearGrid(page)).toBeVisible();
  await expect(page.getByText(LOADING, { exact: true })).toHaveCount(0);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("/demo says why the calendar does not load", async ({ page }) => {
    await page.goto("/demo");
    // Text locators skip <noscript>; innerText is what the visitor sees.
    const shown = await page
      .locator("#root main")
      .evaluate((main: HTMLElement) => main.innerText.trim());
    expect(shown).toBe(NO_SCRIPT);
  });
});
