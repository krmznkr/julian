import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

// The demo banner and tour row are compact below 768px and keep their
// centred two-row layout on wider screens. Pixel 7 checks live in mobile.spec.ts.

const monthHeaderTop = (page: Page) =>
  page.locator("[data-year-grid-header]").evaluate((header) => header.getBoundingClientRect().top);

const controlNames = [
  "Connect my Google Calendar",
  "Watch 15s tour",
  "Add sample event",
  "Reset demo",
] as const;

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`on a 320px phone (${colorScheme})`, () => {
    test.use({
      viewport: { width: 320, height: 700 },
      hasTouch: true,
      isMobile: true,
      colorScheme,
    });

    test("every demo control fits without clipping or page overflow", async ({ demo: page }) => {
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);

      for (const name of controlNames)
        await expect(page.getByRole("button", { name })).toBeInViewport({ ratio: 1 });
      await expect(page.getByRole("link", { name: "About Julian" })).toBeInViewport({ ratio: 1 });

      // The notice wraps instead of being cut off.
      const notice = page.getByText("Changes stay here.").locator("xpath=..");
      expect(await notice.evaluate((element) => element.scrollWidth - element.clientWidth)).toBe(0);

      // 349px before the compact layout.
      expect(await monthHeaderTop(page)).toBeLessThanOrEqual(330);
    });
  });
}

test.describe("on a desktop", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("the demo chrome keeps its layout", async ({ demo: page }) => {
    await expect(page.getByText("Try it here. Changes stay in this demo.")).toBeVisible();
    await expect(
      page.getByText("Your turn. Click a day to explore, or add a sample event."),
    ).toBeVisible();
    for (const name of controlNames) await expect(page.getByRole("button", { name })).toBeVisible();
    expect(await monthHeaderTop(page)).toBeLessThanOrEqual(160);
  });
});
