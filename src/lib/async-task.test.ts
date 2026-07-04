import { beforeEach, describe, expect, it, vi } from "vitest";
import { runAsyncTask } from "@/lib/async-task";

describe("runAsyncTask", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("logs background task failures to console.warn by default", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    runAsyncTask(
      async () => {
        throw new Error("boom");
      },
      {
        action: "background-load",
        context: {
          surface: "test-surface",
        },
      },
    );

    await vi.waitFor(() => {
      expect(warnSpy).toHaveBeenCalledWith(
        "Client error",
        expect.objectContaining({
          context: expect.objectContaining({
            action: "background-load",
            surface: "test-surface",
          }),
        }),
      );
    });
  });

  it("supports custom error handlers without double-reporting when disabled", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const onError = vi.fn<() => unknown>();

    runAsyncTask(
      async () => {
        throw new Error("handled");
      },
      {
        action: "handled-task",
        onError,
        reportError: false,
      },
    );

    await vi.waitFor(() => {
      expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "handled" }));
    });
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
