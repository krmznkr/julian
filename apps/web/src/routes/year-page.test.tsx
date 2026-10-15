import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { STORAGE_KEYS } from "@julian/google/token-store";

const { startGoogleAuth } = vi.hoisted(() => ({
  startGoogleAuth: vi.fn<() => Promise<void>>(),
}));

vi.mock("@/lib/google-calendar", () => ({ startGoogleAuth }));
vi.mock("@/components/year-view", () => ({
  default: ({ initialYear }: { initialYear: number }) => <main>grid {initialYear}</main>,
}));

import { YearPage } from "./year-page";

describe("YearPage", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
    startGoogleAuth.mockReset();
  });

  it("offers sign-in or the demo when no Google session is stored", () => {
    render(<YearPage year={2026} />);
    expect(screen.queryByText("grid 2026")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open the demo" })).toHaveAttribute(
      "href",
      "/demo/2026",
    );
    fireEvent.click(screen.getByRole("button", { name: "Connect Google Calendar" }));
    expect(startGoogleAuth).toHaveBeenCalledOnce();
  });

  it("reports a failed sign-in start", async () => {
    startGoogleAuth.mockRejectedValueOnce(new Error("OAuth unavailable"));
    render(<YearPage year={2026} />);
    fireEvent.click(screen.getByRole("button", { name: "Connect Google Calendar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("OAuth unavailable");
  });

  it("renders the year for a signed-in visitor", () => {
    localStorage.setItem(STORAGE_KEYS.refreshToken, "refresh");
    render(<YearPage year={2026} />);
    expect(screen.getByText("grid 2026")).toBeInTheDocument();
  });
});
