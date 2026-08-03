import { memo, useCallback, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { formatDateRange, formatTimeRange } from "@/components/year-helpers";
import type { DayPanelAnchorRect } from "@/components/year-view/use-month-day-panel";
import type { DayEventItem } from "@/components/year-view/use-month-column";
import { useYearViewSharedData } from "@/components/year-view/year-view-context";
import { openEventInGoogle } from "@/lib/open-event";
import { cn } from "@/lib/utils";

const EventDetail = memo(function EventDetail({ item }: { item: DayEventItem | undefined }) {
  const { calendars } = useYearViewSharedData();
  const calendar = useMemo(
    () => calendars.find((entry) => entry.id === item?.event.calendarId),
    [calendars, item?.event.calendarId],
  );

  if (!item) {
    return (
      <aside className="flex min-h-40 w-72 items-center justify-center border-l border-border/80 px-3 py-2">
        <p className="text-sm text-muted-foreground">No events on this day</p>
      </aside>
    );
  }

  const color = item.event.calendarColor ?? "#8b8b8b";

  return (
    <aside className="min-h-40 w-72 border-l border-border/80 px-3 py-2">
      <div className="flex items-start gap-2">
        <span
          className="mt-1 size-2.5 shrink-0 rounded-[3px] border-2"
          style={{
            borderColor: color,
            backgroundColor: item.allDay ? color : "transparent",
          }}
          aria-hidden="true"
        />
        <div className="min-w-0">
          <p className="line-clamp-3 text-sm font-medium leading-snug text-foreground">
            {item.event.title}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">{formatTimeRange(item.event)}</p>
        </div>
      </div>

      <div className="mt-3 space-y-1.5 text-[11px] text-muted-foreground">
        <p className="truncate">{formatDateRange(item.event)}</p>
        <p className="truncate">{calendar?.summary ?? "Calendar"}</p>
        <p>{item.event.allDay ? "All-day event" : "Timed event"}</p>
      </div>

      {item.event.description && (
        <p className="mt-3 line-clamp-4 text-[11px] leading-relaxed text-muted-foreground">
          {item.event.description}
        </p>
      )}
    </aside>
  );
});

const DayPanelListItem = memo(function DayPanelListItem({
  item,
  isActive,
  onSelect,
}: {
  item: DayEventItem;
  isActive: boolean;
  onSelect: (key: string) => void;
}) {
  const color = item.event.calendarColor ?? "#8b8b8b";

  return (
    <li role="presentation">
      <button
        type="button"
        id={`day-panel-event-${item.key}`}
        tabIndex={-1}
        data-active={isActive ? "true" : undefined}
        aria-selected={isActive}
        role="option"
        onClick={() => {
          onSelect(item.key);
          openEventInGoogle(item.event);
        }}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
          isActive ? "bg-muted" : "hover:bg-muted/60",
        )}
      >
        <span
          className="size-2.5 shrink-0 rounded-[3px] border-2"
          style={{
            borderColor: color,
            backgroundColor: item.allDay ? color : "transparent",
          }}
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1 truncate text-[12px] text-foreground">
          {item.event.title}
        </span>
        <span className="shrink-0 text-[10px] text-muted-foreground">
          {formatTimeRange(item.event)}
        </span>
      </button>
    </li>
  );
});

const DayPanelList = memo(function DayPanelList({
  label,
  items,
  activeKey,
  onSelect,
}: {
  label: string;
  items: DayEventItem[];
  activeKey: string | undefined;
  onSelect: (key: string) => void;
}) {
  return (
    <div className="w-64 overflow-y-auto p-2">
      <p className="px-1.5 pb-1.5 text-[11px] font-medium text-muted-foreground">{label}</p>
      {items.length === 0 ? (
        <p className="px-1.5 text-[12px] text-muted-foreground">No events</p>
      ) : (
        <ul
          className="space-y-0.5"
          role="listbox"
          aria-label={`Events for ${label}`}
          aria-activedescendant={activeKey ? `day-panel-event-${activeKey}` : undefined}
        >
          {items.map((item) => (
            <DayPanelListItem
              key={item.key}
              item={item}
              isActive={item.key === activeKey}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </div>
  );
});

function getPanelPosition(anchorRect: DayPanelAnchorRect) {
  const panelWidth = 544;
  const panelMaxHeight = Math.min(window.innerHeight * 0.6, 480);
  const sideOffset = 6;
  const padding = 8;
  const fitsRight =
    anchorRect.left + anchorRect.width + sideOffset + panelWidth <= window.innerWidth - padding;
  const left = fitsRight
    ? anchorRect.left + anchorRect.width + sideOffset
    : Math.max(padding, anchorRect.left - panelWidth - sideOffset);
  const top = Math.min(
    anchorRect.top,
    Math.max(padding, window.innerHeight - panelMaxHeight - padding),
  );

  return { left, top, maxHeight: panelMaxHeight };
}

export function DayHoverPopover({
  open,
  label,
  items,
  activeKey,
  anchorEl,
  anchorRect,
  onSelect,
  setPopoverEl,
}: {
  open: boolean;
  label: string;
  items: DayEventItem[];
  activeKey: string | undefined;
  anchorEl: HTMLElement | null;
  anchorRect: DayPanelAnchorRect | null;
  onSelect: (key: string) => void;
  setPopoverEl: (node: HTMLElement | null) => void;
}) {
  const itemsByKey = useMemo(() => new Map(items.map((item) => [item.key, item])), [items]);
  const activeItem = activeKey ? itemsByKey.get(activeKey) : items[0];

  const contentRef = useCallback(
    (node: HTMLDivElement | null) => {
      setPopoverEl(node);
    },
    [setPopoverEl],
  );

  useEffect(() => {
    if (!open || !activeKey) return;
    document.getElementById(`day-panel-event-${activeKey}`)?.scrollIntoView({ block: "nearest" });
  }, [activeKey, open]);

  if (!open || !anchorEl || !anchorRect) {
    return null;
  }

  const panelPosition = getPanelPosition(anchorRect);

  return createPortal(
    <div
      ref={contentRef}
      role="dialog"
      aria-modal="true"
      aria-label={`${label} events`}
      className="fixed z-50 flex overflow-hidden rounded-[12px] border border-border bg-popover shadow-lg outline-none"
      style={{
        left: panelPosition.left,
        top: panelPosition.top,
        maxHeight: panelPosition.maxHeight,
      }}
    >
      <DayPanelList
        label={label}
        items={items}
        activeKey={activeKey ?? items[0]?.key}
        onSelect={onSelect}
      />
      <EventDetail item={activeItem} />
    </div>,
    document.body,
  );
}
