import { expect, test } from "./fixtures";

test("the year prints on one landscape page with every month", async ({ demo: page }) => {
  await page.emulateMedia({ media: "print" });
  await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
  // Virtualization is off: all twelve month columns are in the DOM.
  await expect(page.locator(".year-grid-height.w-\\[var\\(--month-col-width\\)\\]")).toHaveCount(
    12,
  );
  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  expect(pdf.toString("latin1").match(/\/Type\s*\/Page(?!s)/g)).toHaveLength(1);
});
