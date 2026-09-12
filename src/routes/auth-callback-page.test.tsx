import { StrictMode } from "react";
import { act, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { handleAuthCallback } from "@/lib/google-calendar";
import { AuthCallbackPage } from "./auth-callback-page";

vi.mock("@/lib/google-calendar", () => ({ handleAuthCallback: vi.fn<() => Promise<void>>() }));

afterEach(() => {
  vi.useRealTimers();
  window.history.replaceState(null, "", "/");
});

it("exchanges a code once in StrictMode and cancels navigation on unmount", async () => {
  vi.useFakeTimers();
  window.history.replaceState(null, "", "/auth/callback?code=example");
  vi.mocked(handleAuthCallback).mockResolvedValue();
  const view = render(
    <StrictMode>
      <AuthCallbackPage />
    </StrictMode>,
  );
  await act(async () => {
    await Promise.resolve();
  });
  expect(screen.getByText("Connected to Google.")).toBeInTheDocument();
  expect(handleAuthCallback).toHaveBeenCalledExactlyOnceWith("example");
  expect(vi.getTimerCount()).toBe(1);
  view.unmount();
  expect(vi.getTimerCount()).toBe(0);
});
