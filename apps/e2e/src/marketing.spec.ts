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
