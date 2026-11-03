import { TODAY, YEAR, expect, test } from "./fixtures";

test("the marketing home links to the live demo", async ({ page }) => {
  await page.clock.setFixedTime(TODAY);
  await page.goto("/home");
  await expect(page).toHaveTitle(/Julian/);
  await page.getByRole("link", { name: "Try the live demo" }).click();
  await expect(page).toHaveURL(new RegExp(`/demo/${YEAR}\\?`));
});

test("local pages never load telemetry SDKs or send third-party telemetry", async ({ page }) => {
  const telemetryRequests: string[] = [];
  page.on("request", (request) => {
    if (/sentry|posthog|\/assets\/observability-|\/_marketing\/browser-/i.test(request.url()))
      telemetryRequests.push(request.url());
  });
  for (const path of ["/home", "/privacy", "/terms", "/demo"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
  }
  expect(telemetryRequests).toEqual([]);
  expect(
    (await page.context().cookies()).filter((cookie) => cookie.name.startsWith("ph_")),
  ).toEqual([]);
});

test("the privacy page lists the requested Google scopes", async ({ page }) => {
  await page.goto("/privacy");
  for (const scope of ["calendar.readonly", "calendar.events", "tasks.readonly"]) {
    await expect(page.getByText(`https://www.googleapis.com/auth/${scope}`)).toBeVisible();
  }
  await expect(page.getByText("userinfo.email")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Errors and traffic analytics" })).toBeVisible();
  await expect(page.getByText(/Do Not Track/)).toBeVisible();
  await expect(page.getByRole("link", { name: "GitHub" })).toHaveAttribute(
    "href",
    "https://github.com/krmznkr/julian/issues",
  );
});

for (const width of [320, 412, 1440]) {
  for (const colorScheme of ["light", "dark"] as const) {
    test(`footer links have 44px touch targets at ${width}px in ${colorScheme}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 915 });
      await page.emulateMedia({ colorScheme });
      for (const path of ["/home", "/privacy", "/terms"]) {
        await page.goto(path);
        const links = page.getByRole("navigation", { name: "Legal" }).getByRole("link");
        await expect(links).toHaveCount(3);
        const boxes = await Promise.all(
          (await links.all()).map(async (link) => {
            await expect(link).toBeVisible();
            return link.boundingBox();
          }),
        );
        for (const box of boxes) {
          expect(box?.width).toBeGreaterThanOrEqual(44);
          expect(box?.height).toBeGreaterThanOrEqual(44);
        }
        // Neighbouring targets must not overlap, or a tap could land on the wrong link.
        for (const [index, box] of boxes.slice(1).entries()) {
          const previous = boxes[index];
          expect((previous?.x ?? 0) + (previous?.width ?? 0)).toBeLessThanOrEqual(box?.x ?? 0);
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          width,
        );
      }
    });
  }
}
