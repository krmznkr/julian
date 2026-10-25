import { expect, test, type Page } from "@playwright/test";

// What a link-preview bot sees: the served HTML, with no scripts run.
test.use({ javaScriptEnabled: false });

// Stable or nightly, depending on the channel the build was made for.
const SHARE_ORIGIN = /^https:\/\/julian(-nightly)?\.krmznkr\.com$/;

const meta = (page: Page, key: string) =>
  page.locator(`head meta[property="${key}"], head meta[name="${key}"]`).getAttribute("content");

const PAGES = [
  // The Worker serves the landing page at `/`; `vite preview` has it at `/home`.
  { path: "/home", url: "/", title: "Julian · Your whole year on one screen" },
  { path: "/demo", url: "/demo", title: "Julian demo · Your whole year on one screen" },
];

for (const { path, url, title } of PAGES) {
  test(`${path} carries a link preview and stays out of search`, async ({ page, request }) => {
    await page.goto(path);
    await expect(page).toHaveTitle(title);
    expect(await meta(page, "og:title")).toBe(title);
    expect(await meta(page, "og:description")).toBe(await meta(page, "description"));
    expect(await meta(page, "og:type")).toBe("website");
    expect(await meta(page, "twitter:card")).toBe("summary_large_image");
    expect(await meta(page, "robots")).toContain("noindex");

    const pageUrl = new URL((await meta(page, "og:url")) ?? "");
    expect(pageUrl.origin).toMatch(SHARE_ORIGIN);
    expect(pageUrl.pathname).toBe(url);

    const image = new URL((await meta(page, "og:image")) ?? "");
    expect(image.origin).toBe(pageUrl.origin);
    expect(image.pathname).toBe("/og-image.png");
    expect(await meta(page, "og:image:alt")).toBeTruthy();

    // The same build serves the image; its PNG header must match the tags.
    const response = await request.get(image.pathname);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("image/png");
    const png = await response.body();
    expect(png.subarray(1, 4).toString("ascii")).toBe("PNG");
    expect(String(png.readUInt32BE(16))).toBe(await meta(page, "og:image:width"));
    expect(String(png.readUInt32BE(20))).toBe(await meta(page, "og:image:height"));
    expect(png.length).toBeLessThan(300_000);
  });
}

test("app routes share the generic preview without claiming a URL", async ({ page }) => {
  await page.goto("/2026");
  await expect(page).toHaveTitle("Julian");
  expect(await meta(page, "og:image")).toMatch(/^https:\/\/[^/]+\/og-image\.png$/);
  await expect(page.locator('head meta[property="og:url"]')).toHaveCount(0);
});
