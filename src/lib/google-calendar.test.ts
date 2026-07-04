import { beforeEach, describe, expect, it, vi } from "vitest";
import { getEvents } from "@/lib/google-calendar";

function mockCalendarResponse(body: unknown) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve(body),
  } as Response);
}

describe("getEvents", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    window.localStorage.setItem("google:access_token", "token");
    window.localStorage.setItem("google:expires_at", String(Date.now() + 120_000));
  });

  it("loads every page of expanded recurring event instances", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementationOnce(() =>
        mockCalendarResponse({
          nextPageToken: "page-2",
          items: [
            {
              id: "recurring-instance-1",
              summary: "Daily standup",
              recurringEventId: "daily-series",
              start: { dateTime: "2026-01-02T09:00:00.000Z" },
              end: { dateTime: "2026-01-02T09:30:00.000Z" },
            },
          ],
        }),
      )
      .mockImplementationOnce(() =>
        mockCalendarResponse({
          items: [
            {
              id: "recurring-instance-2",
              summary: "Daily standup",
              recurringEventId: "daily-series",
              start: { dateTime: "2026-06-01T09:00:00.000Z" },
              end: { dateTime: "2026-06-01T09:30:00.000Z" },
            },
          ],
        }),
      );

    const events = await getEvents("primary", new Date(2026, 0, 1), new Date(2027, 0, 1));

    expect(events.map((event) => event.id)).toEqual([
      "recurring-instance-1",
      "recurring-instance-2",
    ]);
    expect(events[1]?.recurringEventId).toBe("daily-series");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const firstUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    const secondUrl = new URL(String(fetchMock.mock.calls[1]?.[0]));
    expect(firstUrl.searchParams.get("singleEvents")).toBe("true");
    expect(firstUrl.searchParams.get("orderBy")).toBe("startTime");
    expect(firstUrl.searchParams.get("maxResults")).toBe("2500");
    expect(secondUrl.searchParams.get("pageToken")).toBe("page-2");
  });
});
