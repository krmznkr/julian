import { TODAY, YEAR, expect, test } from "./fixtures";

test("the marketing home links to the live demo", async ({ page }) => {
  await page.clock.setFixedTime(TODAY);
  await page.goto("/home");
  await expect(page).toHaveTitle(/Julian/);
  await page.getByRole("link", { name: "Try the live demo" }).click();
  await expect(page).toHaveURL(new RegExp(`/demo/${YEAR}\\?`));
});

test("the marketing pages ship no JavaScript", async ({ page }) => {
  const scripts: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "script") scripts.push(request.url());
  });
  for (const path of ["/home", "/privacy", "/terms"]) {
    await page.goto(path);
    await expect(page.getByRole("navigation", { name: "Legal" })).toBeVisible();
  }
  expect(scripts).toEqual([]);
});

test("the privacy page lists the requested Google scopes", async ({ page }) => {
  await page.goto("/privacy");
  for (const scope of ["calendar.readonly", "calendar.events", "tasks.readonly"]) {
    await expect(page.getByText(`https://www.googleapis.com/auth/${scope}`)).toBeVisible();
  }
  await expect(page.getByText("userinfo.email")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "GitHub" })).toHaveAttribute(
    "href",
    "https://github.com/krmznkr/julian/issues",
  );
});
