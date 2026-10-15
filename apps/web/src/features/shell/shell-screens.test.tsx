import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { GlobalErrorScreen } from "./global-error-screen";
import { NotFoundScreen } from "./not-found-screen";
import { RouteErrorScreen } from "./route-error-screen";

vi.mock("@/lib/router", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it("shows default copy without a retry button or error detail", () => {
  render(<GlobalErrorScreen />);
  expect(screen.getByRole("heading", { name: "We hit an unexpected error" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Go home" })).toHaveAttribute("href", "/");
});

it("labels a route error by context and retries through reset", () => {
  const reset = vi.fn<() => void>();
  render(<RouteErrorScreen error={new Error("fetch failed")} reset={reset} context="Calendar" />);
  expect(screen.getByText("Calendar error")).toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: "We couldn't finish loading calendar" }),
  ).toBeInTheDocument();
  expect(screen.getByText("fetch failed")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(reset).toHaveBeenCalledOnce();
});

it("offers the current year, home, and history back when a page is missing", () => {
  vi.useFakeTimers({ now: new Date(2031, 4, 2), toFake: ["Date"] });
  const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
  render(<NotFoundScreen />);
  expect(screen.getByRole("link", { name: "Open current year" })).toHaveAttribute("href", "/2031");
  expect(screen.getByRole("link", { name: "Go home" })).toHaveAttribute("href", "/home");
  fireEvent.click(screen.getByRole("button", { name: "Go back" }));
  expect(back).toHaveBeenCalledOnce();
});
