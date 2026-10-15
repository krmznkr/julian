import { createMemoryHistory } from "@tanstack/react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STORAGE_KEYS } from "@julian/google/token-store";
import { router } from "@/router";

async function resolve(path: string) {
  router.update({ ...router.options, history: createMemoryHistory({ initialEntries: [path] }) });
  await router.load();
  const { pathname, search } = router.state.location;
  return { pathname, search, notFound: router.state.matches.some((m) => m.status === "notFound") };
}

describe("routes", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 15, 9));
  });
  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it("sends a new visitor from / to today's demo", async () => {
    expect(await resolve("/")).toMatchObject({
      pathname: "/demo/2026",
      search: { month: 10, day: 15 },
    });
  });

  it("sends a signed-in visitor from / to today in their year", async () => {
    localStorage.setItem(STORAGE_KEYS.refreshToken, "refresh");
    expect(await resolve("/")).toMatchObject({
      pathname: "/2026",
      search: { month: 10, day: 15 },
    });
  });

  it("focuses today when the current year opens without a focus", async () => {
    expect(await resolve("/2026")).toMatchObject({ search: { month: 10, day: 15 } });
    expect(await resolve("/demo/2026")).toMatchObject({ search: { month: 10, day: 15 } });
  });

  it("leaves another year unfocused", async () => {
    expect(await resolve("/2024")).toMatchObject({
      pathname: "/2024",
      search: {},
      notFound: false,
    });
  });

  it("canonicalizes /yyyy/mm to a month focus", async () => {
    expect(await resolve("/2026/03")).toMatchObject({
      pathname: "/2026",
      search: { month: 3, day: 1 },
    });
  });

  it("canonicalizes /demo/yyyy/mm to a month focus in the demo", async () => {
    expect(await resolve("/demo/2026/03?day=9")).toMatchObject({
      pathname: "/demo/2026",
      search: { month: 3, day: 9 },
      notFound: false,
    });
  });

  it("redirects pre-1.0 /year/yyyy bookmarks", async () => {
    expect(await resolve("/year/2025?month=2")).toMatchObject({
      pathname: "/2025",
      search: { month: 2 },
    });
  });

  it.each(["/twenty", "/2026/13", "/demo/abc", "/demo/2026/00"])(
    "treats %s as not found",
    async (path) => {
      expect((await resolve(path)).notFound).toBe(true);
    },
  );
});
