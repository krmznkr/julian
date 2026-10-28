import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DemoHud } from "./demo-hud";

function renderHud(status: "playing" | "interactive") {
  const props = {
    status,
    caption: "Open today and browse its events.",
    step: 1,
    replay: vi.fn<() => void>(),
    takeControl: vi.fn<() => void>(),
    addEvent: vi.fn<() => void>(),
    onReset: vi.fn<() => void>(),
  };
  render(<DemoHud {...props} />);
  return props;
}

describe("DemoHud", () => {
  afterEach(cleanup);

  it("keeps the idle hint for screen readers and offers the tour, a sample event and reset", () => {
    const props = renderHud("interactive");
    expect(
      screen.getByText("Your turn. Click a day to explore, or add a sample event."),
    ).toHaveAttribute("aria-live", "polite");
    fireEvent.click(screen.getByRole("button", { name: "Watch 15s tour" }));
    fireEvent.click(screen.getByRole("button", { name: "Add sample event" }));
    fireEvent.click(screen.getByRole("button", { name: "Reset demo" }));
    expect(props.replay).toHaveBeenCalledOnce();
    expect(props.addEvent).toHaveBeenCalledOnce();
    expect(props.onReset).toHaveBeenCalledOnce();
  });

  it("shows the tour step and caption while the tour plays", () => {
    const props = renderHud("playing");
    expect(screen.getByText("Tour 2/3")).toBeVisible();
    expect(screen.getByText("Open today and browse its events.")).not.toHaveClass("max-md:sr-only");
    fireEvent.click(screen.getByRole("button", { name: "Try it now" }));
    expect(props.takeControl).toHaveBeenCalledOnce();
  });
});
