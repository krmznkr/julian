import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { startGoogleAuth } = vi.hoisted(() => ({
  startGoogleAuth: vi.fn<() => Promise<void>>(),
}));

vi.mock("@/lib/google-calendar", () => ({ startGoogleAuth }));
vi.mock("@/components/landing/demo-year-view", () => ({
  DemoYearView: ({ banner }: { banner: ReactNode }) => <main>{banner}</main>,
}));

import { LandingPage } from "./landing-page";

describe("LandingPage", () => {
  beforeEach(() => startGoogleAuth.mockReset());
  afterEach(cleanup);

  it("contains only the calendar demo banner, without a second marketing page", () => {
    render(<LandingPage />);
    expect(screen.getByText("Demo · Sample data")).toBeInTheDocument();
    expect(screen.queryByText("A year view for Google Calendar")).not.toBeInTheDocument();
    expect(screen.queryByText("View source")).not.toBeInTheDocument();
  });

  it("starts Google login directly", async () => {
    startGoogleAuth.mockResolvedValue();
    render(<LandingPage />);
    fireEvent.click(screen.getByRole("button", { name: "Connect my Google Calendar" }));
    await waitFor(() => expect(startGoogleAuth).toHaveBeenCalledOnce());
  });

  it("shows an authentication error and lets the visitor retry", async () => {
    startGoogleAuth.mockRejectedValueOnce(new Error("OAuth unavailable"));
    render(<LandingPage />);
    fireEvent.click(screen.getByRole("button", { name: "Connect my Google Calendar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("OAuth unavailable");
    expect(screen.getByRole("button", { name: "Connect my Google Calendar" })).toBeEnabled();
  });
});
