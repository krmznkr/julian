import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import YearViewErrorBoundary from "./year-view-error-boundary";

vi.mock("@/lib/router", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

function Boom(): never {
  throw new Error("boom");
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("renders children when nothing throws", () => {
  render(
    <YearViewErrorBoundary year={2026}>
      <p>calendar</p>
    </YearViewErrorBoundary>,
  );
  expect(screen.getByText("calendar")).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("shows the fallback with a link back to the year and reloads on demand", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const reload = vi.fn<() => void>();
  vi.stubGlobal("location", { ...window.location, reload });
  render(
    <YearViewErrorBoundary year={2026}>
      <Boom />
    </YearViewErrorBoundary>,
  );
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Something went wrong loading the year view.",
  );
  expect(screen.getByRole("link", { name: "Back to year view" })).toHaveAttribute("href", "/2026");
  fireEvent.click(screen.getByRole("button", { name: "Reload" }));
  expect(reload).toHaveBeenCalledOnce();
});

it("links home when no year is known", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  render(
    <YearViewErrorBoundary>
      <Boom />
    </YearViewErrorBoundary>,
  );
  expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
});
