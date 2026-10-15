// Text search over the year's events: which events match a query, and how a
// title splits around its matches so the grid can highlight them.
import { createContext, useContext, type ReactNode } from "react";
import type { CalendarEvent } from "@julian/domain";

const normalize = (text: string) => text.toLocaleLowerCase();

export function matchesEventQuery(
  event: Pick<CalendarEvent, "title" | "description">,
  query: string,
): boolean {
  const needle = normalize(query.trim());
  if (needle === "") return true;
  return [event.title, event.description ?? ""].some((text) => normalize(text).includes(needle));
}

export type HighlightPart = { readonly text: string; readonly match: boolean };

export function highlightParts(text: string, query: string): ReadonlyArray<HighlightPart> {
  const needle = normalize(query.trim());
  if (needle === "") return [{ text, match: false }];
  const haystack = normalize(text);
  const step = (from: number): ReadonlyArray<HighlightPart> => {
    const at = haystack.indexOf(needle, from);
    if (at < 0) return from < text.length ? [{ text: text.slice(from), match: false }] : [];
    const end = at + needle.length;
    return [
      ...(at > from ? [{ text: text.slice(from, at), match: false }] : []),
      { text: text.slice(at, end), match: true },
      ...step(end),
    ];
  };
  return step(0);
}

const EventSearchQueryContext = createContext("");

export function EventSearchQueryProvider({
  query,
  children,
}: {
  query: string;
  children: ReactNode;
}) {
  return <EventSearchQueryContext value={query}>{children}</EventSearchQueryContext>;
}

/** The title with the current search matches wrapped in `<mark>`. */
export function HighlightedText({ text }: { text: string }) {
  const query = useContext(EventSearchQueryContext);
  const parts = highlightParts(text, query);
  if (parts.length === 1 && !parts[0]?.match) return text;
  return parts.map((part, index) =>
    part.match ? (
      // oxlint-disable-next-line react/no-array-index-key -- parts have no identity beyond position
      <mark
        key={index}
        className="rounded-sm bg-yellow-300/80 px-px text-inherit dark:bg-yellow-500/60"
      >
        {part.text}
      </mark>
    ) : (
      part.text
    ),
  );
}
