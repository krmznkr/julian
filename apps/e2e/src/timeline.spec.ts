import { devices } from "@playwright/test";
import { YEAR, expect, test, yearGrid } from "./fixtures";

function timeline(page: import("@playwright/test").Page) {
  return page.getByRole("region", { name: `Timeline for ${YEAR}` });
}

test("V switches between the year grid and the timeline, and the URL keeps it", async ({
  demo: page,
}) => {
  await page.keyboard.press("v");
  await expect(timeline(page)).toBeVisible();
  await expect(yearGrid(page)).toHaveCount(0);
  await expect(page).toHaveURL(/view=timeline/);
  // March 10 at the default quarter zoom.
  await expect(page.getByTestId("timeline-range")).toHaveText(`Jan – Mar ${YEAR}`);

  await page.reload();
  await expect(timeline(page)).toBeVisible();

  await page
    .getByRole("group", { name: "Layout" })
    .getByRole("button", { name: "Year grid" })
    .click();
  await expect(yearGrid(page)).toBeVisible();
  await expect(page).not.toHaveURL(/view=timeline/);
});

test("zoom and step through the year", async ({ demo: page }) => {
  await page
    .getByRole("group", { name: "Layout" })
    .getByRole("button", { name: "Timeline" })
    .click();
  const range = page.getByTestId("timeline-range");
  const zoom = page.getByRole("group", { name: "Zoom" });

  await zoom.getByRole("button", { name: "Month" }).click();
  await expect(range).toHaveText(`March ${YEAR}`);
  await page.getByRole("button", { name: "Next month" }).click();
  await expect(range).toHaveText(`April ${YEAR}`);
  await zoom.getByRole("button", { name: "Week" }).click();
  await expect(range).toHaveText(`Mar 30 – Apr 5, ${YEAR}`);
  await zoom.getByRole("button", { name: "Year" }).click();
  await expect(range).toHaveText(String(YEAR));
  await page.getByRole("button", { name: /^Go to today/ }).click();
  await zoom.getByRole("button", { name: "Quarter" }).click();
  await expect(range).toHaveText(`Jan – Mar ${YEAR}`);
});

test("arrow keys move between event bars", async ({ demo: page }) => {
  await page.keyboard.press("v");
  const bars = timeline(page).locator("[data-timeline-key]");
  await expect(bars.first()).toBeVisible();
  await bars.first().focus();
  const first = await bars.first().getAttribute("data-timeline-key");
  await page.keyboard.press("ArrowRight");
  const focused = page.locator("[data-timeline-key]:focus");
  await expect(focused).toHaveCount(1);
  expect(await focused.getAttribute("data-timeline-key")).not.toBe(first);
  await expect(focused).toHaveAttribute("tabindex", "0");
});

test("hiding a calendar removes its row", async ({ demo: page }) => {
  await page.keyboard.press("v");
  await expect(timeline(page).getByRole("group", { name: "Travel" })).toBeVisible();
  await page.getByRole("checkbox", { name: "Travel" }).click();
  await expect(timeline(page).getByRole("group", { name: "Travel" })).toHaveCount(0);
});

test.describe("on a phone", () => {
  // defaultBrowserType is worker-scoped, so use only the device's context options.
  const phone = devices["Pixel 7"];
  test.use({
    viewport: { width: 412, height: 915 },
    userAgent: phone.userAgent,
    deviceScaleFactor: phone.deviceScaleFactor,
    isMobile: phone.isMobile,
    hasTouch: phone.hasTouch,
  });

  test("the timeline fits the screen and scrolls sideways inside itself", async ({
    demo: page,
  }) => {
    await page.getByRole("button", { name: "Switch to timeline" }).tap();
    await expect(timeline(page)).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    const scroller = page.locator("[data-timeline-root]");
    expect(await scroller.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(
      true,
    );
  });
});
