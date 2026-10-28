import AxeBuilder from "@axe-core/playwright";
import { devices, type Page } from "@playwright/test";
import { expect, test } from "./fixtures";

/**
 * Serious and critical violations fail the run. Moderate findings that remain
 * are deliberate, including the same heading and region findings on phones:
 * - `page-has-heading-one`: the demo *is* the app; its first heading is
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

test("the demo has no serious accessibility violations", async ({ demo: page }) => {
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

for (const path of ["/home", "/privacy", "/terms"]) {
  for (const colorScheme of ["light", "dark"] as const) {
    test(`the marketing page ${path} (${colorScheme}) has no serious accessibility violations`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto(path);
      await expectNoSeriousViolations(page);
    });
  }
}

// Keep phone scans focused here instead of doubling every test with a project.
test.describe("on a Pixel 7 with touch input", () => {
  // defaultBrowserType is worker-scoped, so use only the device's context options.
  const phone = devices["Pixel 7"];
  test.use({
    viewport: { width: 412, height: 915 },
    screen: { width: 412, height: 915 },
    userAgent: phone.userAgent,
    deviceScaleFactor: phone.deviceScaleFactor,
    isMobile: phone.isMobile,
    hasTouch: phone.hasTouch,
  });

  for (const colorScheme of ["light", "dark"] as const) {
    test.describe(`${colorScheme} theme`, () => {
      test.use({ colorScheme });

      test("the demo banner and tour have no serious accessibility violations", async ({
        demo: page,
      }) => {
        await expect(page.getByText("Changes stay here.")).toBeVisible();
        for (const name of [
          "Connect my Google Calendar",
          "Watch 15s tour",
          "Add sample event",
          "Reset demo",
        ]) {
          await expect(page.getByRole("button", { name })).toBeInViewport({ ratio: 1 });
        }
        await expectNoSeriousViolations(page);
      });

      for (const path of ["/home", "/privacy", "/terms"]) {
        test(`the marketing page ${path} has no serious accessibility violations`, async ({
          page,
        }) => {
          await page.goto(path);
          await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
          await expectNoSeriousViolations(page);
        });
      }
    });
  }
});
