import { Search, X } from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import { useYearViewContext } from "@/components/year-view/year-view-context";

/** Filters the year by event text. "/" focuses it; Escape clears it. */
export function TopBarSearch() {
  const { searchQuery, setSearchQuery, searchInputRef, searchMatchCount, focusYearGrid } =
    useYearViewContext();
  const active = searchQuery.trim() !== "";
  // The "/" shortcut means nothing without a keyboard.
  const [placeholder] = useState(() =>
    window.matchMedia("(pointer: coarse)").matches ? "Search" : "Search  /",
  );

  const clear = () => {
    setSearchQuery("");
    focusYearGrid();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      clear();
    } else if (event.key === "Enter") {
      event.preventDefault();
      focusYearGrid();
    }
  };

  return (
    <div className="relative flex items-center" role="search">
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-2 size-3.5 text-muted-foreground"
      />
      <input
        ref={searchInputRef}
        type="search"
        value={searchQuery}
        onChange={(event) => setSearchQuery(event.target.value)}
        onKeyDown={onKeyDown}
        aria-label="Search events"
        aria-keyshortcuts="/"
        placeholder={placeholder}
        className="h-8 w-28 rounded-lg border border-border/60 bg-muted/30 pl-7 pr-7 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 sm:w-40 [&::-webkit-search-cancel-button]:hidden"
      />
      {active ? (
        <button
          type="button"
          onClick={clear}
          aria-label="Clear search"
          className="absolute right-1 inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <X aria-hidden="true" className="size-3.5" />
        </button>
      ) : null}
      <span aria-live="polite" className="sr-only">
        {active
          ? `${searchMatchCount} matching ${searchMatchCount === 1 ? "event" : "events"}`
          : ""}
      </span>
    </div>
  );
}
