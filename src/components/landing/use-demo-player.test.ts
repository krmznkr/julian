import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDemoPlayer } from "./use-demo-player";

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("IntersectionObserver", function IntersectionObserverMock() {
    return { observe() {}, disconnect() {} };
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

function setup() {
  const root = document.createElement("div");
  root.innerHTML =
    '<div data-year-grid-root tabindex="0"></div><div data-slot="dialog-content"><form><input /></form></div>';
  document.body.append(root);
  const submit = vi
    .spyOn(root.querySelector("form")!, "requestSubmit")
    .mockImplementation(() => {});
  const ref = { current: root };
  return { ...renderHook(() => useDemoPlayer(ref)), submit };
}

describe("demo player", () => {
  it("completes one short workflow and hands control over without looping", async () => {
    const { result, submit } = setup();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });
    expect(result.current.status).toBe("finished");
    expect(submit).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it("stops immediately when the visitor takes over", async () => {
    const { result, submit } = setup();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });
    act(() => result.current.takeControl());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    expect(result.current.status).toBe("interactive");
    expect(submit).not.toHaveBeenCalled();
  });

  it("starts interactive with reduced motion or a small screen, and allows an explicit replay", async () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({ ...window.matchMedia(""), matches: true });
    const { result, submit } = setup();
    expect(result.current.status).toBe("interactive");
    act(() => result.current.replay());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });
    expect(submit).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("finished");
  });
});
