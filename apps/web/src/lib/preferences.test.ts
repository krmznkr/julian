import { afterEach, describe, expect, it } from "vitest";
import { Effect } from "effect";
import { keyValueStoreLayer } from "@julian/google/key-value-store";
import { resolveSelectedCalendarIds, saveSelectedCalendarIdsSync } from "@/lib/calendar-selection";
import { nextThemeMode } from "@/lib/theme";
import {
  getStoredSidebarCollapsedPreference,
  storeSidebarCollapsedPreference,
} from "@/lib/year-view-preferences";

const resolve = (ids: ReadonlyArray<string>) =>
  Effect.runSync(resolveSelectedCalendarIds(ids).pipe(Effect.provide(keyValueStoreLayer)));

describe("calendar selection", () => {
  afterEach(() => localStorage.clear());

  it("selects every calendar until one is hidden", () => {
    expect(resolve(["a", "b"])).toEqual(["a", "b"]);
  });

  it("remembers hidden calendars, so newly discovered ones still show", () => {
    saveSelectedCalendarIdsSync(["a", "b"], ["a"]);
    expect(resolve(["a", "b", "tasks"])).toEqual(["a", "tasks"]);
  });

  it.each(["not json", "{}", '["a", 3]'])("tolerates a corrupt stored value %j", (raw) => {
    localStorage.setItem("julian:hidden-calendar-ids", raw);
    expect(resolve(["a", "b"])).toEqual(raw === '["a", 3]' ? ["b"] : ["a", "b"]);
  });
});

describe("sidebar preference", () => {
  afterEach(() => localStorage.clear());

  it("defaults to expanded and round-trips through storage", () => {
    expect(getStoredSidebarCollapsedPreference()).toBe(false);
    storeSidebarCollapsedPreference(true);
    expect(getStoredSidebarCollapsedPreference()).toBe(true);
    storeSidebarCollapsedPreference(false);
    expect(getStoredSidebarCollapsedPreference()).toBe(false);
  });
});

describe("nextThemeMode", () => {
  it("cycles system → light → dark → system", () => {
    expect(nextThemeMode(undefined)).toBe("light");
    expect(nextThemeMode("system")).toBe("light");
    expect(nextThemeMode("light")).toBe("dark");
    expect(nextThemeMode("dark")).toBe("system");
  });
});
