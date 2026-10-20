import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { STORAGE_KEYS } from "@julian/google/token-store";
import { GoogleLoginButton } from "./google-login-button";
import { isAuthenticated, logout, startGoogleAuth } from "@/lib/google-calendar";

vi.mock("@/lib/google-calendar", () => ({
  isAuthenticated: vi.fn<() => Promise<boolean>>(),
  logout: vi.fn<() => Promise<void>>(),
  startGoogleAuth: vi.fn<() => Promise<void>>(),
}));

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
  vi.resetAllMocks();
});

it.each(["absent", "expired", "blocked"])("skips the runtime on a %s session mount", (kind) => {
  if (kind === "expired") {
    localStorage.setItem(STORAGE_KEYS.accessToken, "old");
    localStorage.setItem(STORAGE_KEYS.expiresAt, String(Date.now() - 1));
  }
  if (kind === "blocked")
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
  render(<GoogleLoginButton />);
  expect(screen.getByRole("button", { name: "Connect Google Calendar" })).toBeEnabled();
  expect(isAuthenticated).not.toHaveBeenCalled();
});

it.each(["refresh", "fresh", "skew"])(
  "checks a %s session and disconnects normally",
  async (kind) => {
    if (kind === "refresh") localStorage.setItem(STORAGE_KEYS.refreshToken, "refresh");
    else {
      localStorage.setItem(STORAGE_KEYS.accessToken, "access");
      localStorage.setItem(
        STORAGE_KEYS.expiresAt,
        String(Date.now() + (kind === "skew" ? 30_000 : 120_000)),
      );
    }
    vi.mocked(isAuthenticated).mockResolvedValue(true);
    const changed = vi.fn<() => void>();
    render(<GoogleLoginButton onAuthChange={changed} />);
    fireEvent.click(await screen.findByRole("button", { name: "Disconnect" }));
    expect(isAuthenticated).toHaveBeenCalledOnce();
    expect(logout).toHaveBeenCalledOnce();
    expect(changed).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Connect Google Calendar" })).toBeEnabled();
  },
);

it("lets the runtime reject a stored session without showing Disconnect", async () => {
  localStorage.setItem(STORAGE_KEYS.refreshToken, "revoked");
  vi.mocked(isAuthenticated).mockResolvedValue(false);
  render(<GoogleLoginButton />);
  await waitFor(() => expect(isAuthenticated).toHaveBeenCalledOnce());
  expect(screen.queryByRole("button", { name: "Disconnect" })).not.toBeInTheDocument();
});

it.each([true, false])(
  "still starts OAuth without a session and rechecks it (%s)",
  async (authed) => {
    vi.mocked(startGoogleAuth).mockResolvedValue();
    vi.mocked(isAuthenticated).mockResolvedValue(authed);
    const changed = vi.fn<() => void>();
    render(<GoogleLoginButton onAuthChange={changed} />);
    fireEvent.click(screen.getByRole("button", { name: "Connect Google Calendar" }));
    expect(screen.getByRole("button", { name: "Connecting..." })).toBeDisabled();
    await waitFor(() => expect(isAuthenticated).toHaveBeenCalledOnce());
    expect(startGoogleAuth).toHaveBeenCalledOnce();
    expect(changed).toHaveBeenCalledTimes(authed ? 1 : 0);
  },
);

it.each([new Error("OAuth unavailable"), "failed"])(
  "keeps login errors visible and allows retry (%s)",
  async (error) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(startGoogleAuth).mockRejectedValueOnce(error).mockResolvedValue();
    vi.mocked(isAuthenticated).mockResolvedValue(true);
    render(<GoogleLoginButton />);
    fireEvent.click(screen.getByRole("button", { name: "Connect Google Calendar" }));
    await screen.findByText(
      error instanceof Error ? error.message : "Failed to connect to Google.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Connect Google Calendar" }));
    await screen.findByRole("button", { name: "Disconnect" });
    expect(startGoogleAuth).toHaveBeenCalledTimes(2);
  },
);
