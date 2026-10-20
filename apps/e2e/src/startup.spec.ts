import { expect, test, yearGrid } from "./fixtures";

test("the command palette replaces the mobile drawer without competing focus traps", async ({
  demo: page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 767, height: 900 });
  await page.getByRole("button", { name: "Open calendars" }).click();
  await page.keyboard.press("Control+k");
  const commands = page.getByRole("dialog", { name: "Commands", exact: true });
  await expect(commands.getByRole("combobox")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(commands).toBeHidden();
  await expect(page.locator('aside[role="dialog"]')).toHaveAttribute("inert", "");
  await yearGrid(page).focus();
  await expect(yearGrid(page)).toBeFocused();
  expect(errors).toEqual([]);
});

test("one sidebar follows the 768px breakpoint without losing selection, search or collapse state", async ({
  demo: page,
}) => {
  const content = page.locator("aside [data-sidebar-root] > div");
  const travel = page.getByRole("checkbox", { name: "Travel", exact: true });
  const search = page.getByRole("searchbox", { name: "Search events" });
  await expect(content).toHaveCount(1);
  await travel.uncheck();
  await search.fill("lisbon");
  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  await expect(travel).toBeHidden();
  await page.setViewportSize({ width: 767, height: 900 });
  await expect(content).toHaveCount(1);
  await expect(page.locator('aside[role="dialog"] [role="checkbox"]')).toHaveCount(6);
  const opener = page.getByRole("button", { name: "Open calendars" });
  await opener.click();
  const drawer = page.locator('aside[role="dialog"]');
  await expect(travel).not.toBeChecked();
  const first = drawer.getByRole("button", { name: "Connect Google Calendar", exact: true });
  await expect(first).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  const last = drawer.getByRole("checkbox").last();
  await expect(last).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(first).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(drawer).not.toBeInViewport();
  await expect(opener).toBeFocused();
  await expect(drawer).toHaveAttribute("inert", "");
  await opener.click();
  await page.getByRole("button", { name: "Close sidebar" }).click({ position: { x: 747, y: 200 } });
  await expect(opener).toBeFocused();
  await opener.click();
  // Resize while focus is trapped. The desktop shell remains collapsed.
  await page.setViewportSize({ width: 768, height: 900 });
  await expect(content).toHaveCount(1);
  await expect(page.locator('aside[role="dialog"] [role="checkbox"]')).toHaveCount(0);
  await expect(drawer).toHaveAttribute("inert", "");
  await expect(yearGrid(page)).toBeFocused();
  await page.getByRole("button", { name: "Expand sidebar" }).click();
  await expect(travel).not.toBeChecked();
  await expect(search).toHaveValue("lisbon");
  await search.fill("birthday");
  await expect(search).toHaveValue("birthday");
  await page.setViewportSize({ width: 767, height: 900 });
  await expect(drawer).not.toBeInViewport();
  await opener.click();
  await expect(travel).not.toBeChecked();
  await expect(content).toHaveCount(1);
});

for (const session of ["fresh", "refresh", "skew", "expired", "revoked"] as const) {
  test(`the sidebar checks a stored ${session} session and keeps logout working`, async ({
    page,
  }) => {
    let refreshes = 0;
    await page.route("**/api/oauth/refresh", async (route) => {
      refreshes += 1;
      await route.fulfill(
        session === "revoked"
          ? {
              status: 400,
              json: { error: "invalid_grant" },
            }
          : {
              json: {
                access_token: "refreshed-test-token",
                expires_in: 3600,
                token_type: "Bearer",
              },
            },
      );
    });
    await page.addInitScript((kind) => {
      localStorage.setItem("google:access_token", "test-token");
      localStorage.setItem(
        "google:expires_at",
        String(Date.now() + (kind === "fresh" ? 120_000 : kind === "skew" ? 30_000 : -1)),
      );
      if (kind === "refresh" || kind === "skew" || kind === "revoked")
        localStorage.setItem("google:refresh_token", "test-refresh");
    }, session);
    await page.goto("/demo");
    if (session === "expired" || session === "revoked") {
      await expect(
        page.getByRole("button", { name: "Connect Google Calendar", exact: true }),
      ).toBeVisible();
      if (session === "revoked") {
        await expect.poll(() => refreshes).toBe(1);
        await expect
          .poll(() => page.evaluate(() => localStorage.getItem("google:refresh_token")))
          .toBe(null);
      } else expect(refreshes).toBe(0);
    } else {
      await expect(page.getByRole("button", { name: "Disconnect", exact: true })).toBeVisible();
      expect(refreshes).toBe(session === "fresh" ? 0 : 1);
      if (session !== "fresh") {
        expect(await page.evaluate(() => localStorage.getItem("google:refresh_token"))).toBe(
          "test-refresh",
        );
        expect(await page.evaluate(() => localStorage.getItem("google:access_token"))).toBe(
          "refreshed-test-token",
        );
      }
      await page.setViewportSize({ width: 767, height: 900 });
      await page.getByRole("button", { name: "Open calendars" }).click();
      await expect(page.getByRole("button", { name: "Disconnect", exact: true })).toBeVisible();
      expect(refreshes).toBe(session === "fresh" ? 0 : 1);
      await page.getByRole("button", { name: "Disconnect", exact: true }).click();
      await expect
        .poll(() =>
          page.evaluate(() =>
            ["access_token", "refresh_token", "expires_at"].map((key) =>
              localStorage.getItem(`google:${key}`),
            ),
          ),
        )
        .toEqual([null, null, null]);
      await expect(
        page.getByRole("button", { name: "Connect Google Calendar", exact: true }),
      ).toBeVisible();
    }
  });
}
