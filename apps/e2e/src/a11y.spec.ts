import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

/**
 * Serious and critical violations fail the run. Moderate findings that remain
 * are deliberate:
 * - `page-has-heading-one`: the landing page *is* the app; its first heading is
 *   the sidebar's "Calendars", and an invisible h1 would only exist for the scan.
 * - `region`: the demo banner sits above the app shell's landmarks so it reads
 *   first; it holds one button and two lines of text.
 * - `landmark-unique`: the mobile and desktop sidebars are both `<aside>`, but
 *   only one is ever displayed at a time.
 */
async function expectNoSeriousViolations(page: Page) {
  // A dialog caught mid fade-in reports its half-transparent text as low contrast.
  await page.waitForFunction(() =>
    document.getAnimations().every((animation) => animation.playState !== "running"),
  );
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
    .analyze();
  const blocking = violations
    .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
    .map((violation) => ({
      rule: violation.id,
      impact: violation.impact,
      targets: violation.nodes.map((node) => node.target.join(" ")),
    }));
  expect(blocking).toEqual([]);
}

test("the landing page has no serious accessibility violations", async ({ demo: page }) => {
  await expectNoSeriousViolations(page);
});

test("the dark theme has no serious accessibility violations", async ({ demo: page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  await expectNoSeriousViolations(page);
});

test("open day details have no serious accessibility violations", async ({ demo: page }) => {
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: /events$/ })).toBeVisible();
  await expectNoSeriousViolations(page);
});

test("the event dialog has no serious accessibility violations", async ({ demo: page }) => {
  await page.keyboard.press("n");
  await expect(page.getByRole("dialog", { name: "New event" })).toBeVisible();
  await expectNoSeriousViolations(page);
});
