import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  EventSearchQueryProvider,
  HighlightedText,
  highlightParts,
  matchesEventQuery,
} from "@/components/year-view/event-search";

describe("matchesEventQuery", () => {
  const event = { title: "Lisbon offsite", description: "Bring the slides" };

  it.each([
    ["", true],
    ["   ", true],
    ["lisbon", true],
    ["OFFSITE", true],
    [" slides ", true],
    ["porto", false],
  ])("matches %j: %s", (query, expected) => {
    expect(matchesEventQuery(event, query)).toBe(expected);
  });

  it("tolerates a missing description", () => {
    expect(matchesEventQuery({ title: "Trip", description: null }, "notes")).toBe(false);
  });
});

describe("highlightParts", () => {
  it("splits the text around every case-insensitive match", () => {
    expect(highlightParts("Sprint review, sprint 2", "sprint")).toEqual([
      { text: "Sprint", match: true },
      { text: " review, ", match: false },
      { text: "sprint", match: true },
      { text: " 2", match: false },
    ]);
  });

  it("returns the text unmarked for an empty query or no match", () => {
    expect(highlightParts("Trip", "")).toEqual([{ text: "Trip", match: false }]);
    expect(highlightParts("Trip", "x")).toEqual([{ text: "Trip", match: false }]);
  });
});

describe("HighlightedText", () => {
  it("marks matches of the query in context", () => {
    const { container } = render(
      <EventSearchQueryProvider query="off">
        <HighlightedText text="Lisbon offsite" />
      </EventSearchQueryProvider>,
    );
    expect(container.querySelector("mark")?.textContent).toBe("off");
    expect(container.textContent).toBe("Lisbon offsite");
  });

  it("renders plain text without a query", () => {
    const { container } = render(<HighlightedText text="Trip" />);
    expect(container.querySelector("mark")).toBeNull();
  });
});
