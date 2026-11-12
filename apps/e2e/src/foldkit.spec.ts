import { expect, test } from "@playwright/test";

test("the former prototype URL opens the shared demo", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-03-10T12:00:00Z"));
  await page.goto("/foldkit.html");
  await expect(page).toHaveURL(/\/demo\/2026\?month=3&day=10/);
  await expect(page.getByRole("application", { name: "Calendar for 2026" })).toBeFocused();
});

test("the signed-in app rolls back a rejected Google save", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-03-10T12:00:00Z"));
  await page.addInitScript(() => {
    localStorage.setItem("google:access_token", "test-access-token");
    localStorage.setItem("google:expires_at", String(new Date("2036-01-01").getTime()));
  });
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const paths: string[] = [];
  await page.route("https://**.googleapis.com/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    paths.push(url.pathname);
    expect(await request.headerValue("authorization")).toBe("Bearer test-access-token");
    if (request.method() === "PATCH") {
      expect(request.postDataJSON()).toMatchObject({
        start: { date: "2026-03-12" },
        end: { date: "2026-03-13" },
      });
      await held;
      await route.fulfill({ status: 403, json: { error: { message: "Rejected by test" } } });
    } else if (url.pathname.endsWith("/calendarList")) {
      await route.fulfill({
        json: {
          items: [
            {
              id: "live-calendar",
              summary: "Live calendar",
              primary: true,
              accessRole: "owner",
              backgroundColor: "#0b8043",
            },
          ],
        },
      });
    } else if (url.pathname.endsWith("/events")) {
      await route.fulfill({
        json: {
          items: [
            {
              id: "live-event",
              summary: "Live event",
              start: { date: "2026-03-10" },
              end: { date: "2026-03-11" },
            },
          ],
        },
      });
    } else await route.fulfill({ json: { items: [] } });
  });
  try {
    await page.goto("/2026?month=3&day=10");
    const event = page
      .getByRole("application")
      .getByRole("button", { name: "Live event", exact: true });
    await expect(event).toBeVisible();
    await expect(page.getByText("Demo · Sample data")).toHaveCount(0);
    await event.click();
    await page.getByRole("button", { name: "Move to another day" }).click();
    await page.getByLabel("Start date").fill("2026-03-12");
    await page.getByRole("button", { name: "Move", exact: true }).click();
    await expect(event).toHaveAttribute("title", /Mar 12/);
    release();
    await expect(page.getByRole("alert")).toContainText("Original dates restored");
    await expect(event).toHaveAttribute("title", /Mar 10/);
    expect(paths.some((path) => path.endsWith("/calendarList"))).toBe(true);
    expect(paths.some((path) => path.endsWith("/events/live-event"))).toBe(true);
  } finally {
    release();
  }
});
