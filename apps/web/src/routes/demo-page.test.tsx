import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { startGoogleAuth } = vi.hoisted(() => ({
  startGoogleAuth: vi.fn<() => Promise<void>>(),
}));

vi.mock("@/lib/google-calendar", () => ({ startGoogleAuth }));
vi.mock("@/components/year-view/use-route-port", () => ({
  useRoutePort: () => ({ search: {}, navigate: vi.fn<() => void>() }),
}));
vi.mock("@/components/landing/demo-year-view", () => ({
  DemoYearView: ({ banner }: { banner: ReactNode }) => <main>{banner}</main>,
}));

import { DemoPage } from "./demo-page";

describe("DemoPage", () => {
  beforeEach(() => startGoogleAuth.mockReset());
  afterEach(cleanup);

  it("labels the sample data and links back to the marketing site", () => {
    render(<DemoPage year={2026} />);
    expect(screen.getByText("Demo · Sample data")).toBeInTheDocument();
    // Phones get the short notice, wider screens the full one; CSS picks which shows.
    expect(screen.getByText(". Changes stay here.", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("Try it here. Changes stay in this demo.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "About Julian" })).toHaveAttribute("href", "/home");
  });

  it("starts Google login directly", async () => {
    startGoogleAuth.mockResolvedValue();
    render(<DemoPage year={2026} />);
    fireEvent.click(screen.getByRole("button", { name: "Connect my Google Calendar" }));
    await waitFor(() => expect(startGoogleAuth).toHaveBeenCalledOnce());
  });

  it("shows an authentication error and lets the visitor retry", async () => {
    startGoogleAuth.mockRejectedValueOnce(new Error("OAuth unavailable"));
    render(<DemoPage year={2026} />);
    fireEvent.click(screen.getByRole("button", { name: "Connect my Google Calendar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("OAuth unavailable");
    expect(screen.getByRole("button", { name: "Connect my Google Calendar" })).toBeEnabled();
  });
});
