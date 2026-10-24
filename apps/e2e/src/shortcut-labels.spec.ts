import type { Page } from "@playwright/test";
import { expect, test, TODAY, waitForGrid } from "./fixtures";

/**
 * Chromium reports the host's `navigator.platform`, so each case overrides it
 * before the app loads. Every test gets a fresh browser context. This checks
 * the labels the app picks per platform; it does not run a native macOS or
 * Windows browser.
 */
const PLATFORMS = [
  { name: "Linux", platform: "Linux x86_64", palette: "Ctrl K", remove: "Ctrl Backspace" },
  { name: "Windows", platform: "Win32", palette: "Ctrl K", remove: "Ctrl Backspace" },
  { name: "macOS", platform: "MacIntel", palette: "⌘K", remove: "⌘⌫" },
] as const;

async function openDemoAs(page: Page, platform: string) {
  await page.addInitScript((value) => {
    Object.defineProperty(Navigator.prototype, "platform", { get: () => value });
  }, platform);
  await page.clock.setFixedTime(TODAY);
  await page.goto("/demo");
  await waitForGrid(page);
  expect(await page.evaluate(() => navigator.platform)).toBe(platform);
}

function keysFor(page: Page, action: string) {
  return page
    .getByRole("dialog", { name: "Keyboard shortcuts" })
    .locator("div")
    .filter({ has: page.getByRole("definition").getByText(action, { exact: true }) })
    .getByRole("term");
}

for (const { name, platform, palette, remove } of PLATFORMS) {
  test(`shortcut help names the ${name} modifier keys`, async ({ page }) => {
    await openDemoAs(page, platform);
    const modifier = palette.startsWith("⌘") ? "⌘" : "Ctrl";

    await expect(page.getByRole("button", { name: /^Commands/ })).toHaveText(
      `Commands${modifier}K`,
    );

    await page.keyboard.press("Shift+Slash");
    const help = page.getByRole("dialog", { name: "Keyboard shortcuts" });
    await expect(help).toBeVisible();
    await expect(keysFor(page, "Open command palette")).toHaveText(palette);
    await expect(keysFor(page, "Delete the selected event (in day details)")).toHaveText(remove);
    await expect(
      help.getByRole("term").filter({ hasText: modifier === "⌘" ? "Ctrl" : "⌘" }),
    ).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(help).toBeHidden();

    // The labels changed, the bindings did not: both chords open Commands.
    for (const chord of ["Control+k", "Meta+k"]) {
      await page.keyboard.press(chord);
      const commands = page.getByRole("dialog", { name: "Commands" });
      await expect(commands).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(commands).toBeHidden();
    }
  });
}
