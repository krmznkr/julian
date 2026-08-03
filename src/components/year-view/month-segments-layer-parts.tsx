import { memo } from "react";
import EventPopover from "@/components/year-view/event-popover";
import { monthColumnTemplateColumns } from "@/components/year-view/month-grid-layout";
import type { RenderedBar } from "@/components/year-view/use-month-column";

export const SegmentGrid = memo(function SegmentGrid({
  month,
  multiDayLanes,
  hasSingleStrip,
  bars,
}: {
  month: number;
  multiDayLanes: number;
  hasSingleStrip: boolean;
  bars: RenderedBar[];
}) {
  return (
    <div
      className="year-grid-rows pointer-events-none absolute inset-0 z-20 grid gap-y-0 gap-x-0 overflow-hidden"
      style={{ gridTemplateColumns: monthColumnTemplateColumns(multiDayLanes, hasSingleStrip) }}
    >
      {bars.map((bar) => (
        <EventPopover
          key={`${bar.segment.id}-${bar.segment.startDay}-${bar.segment.endDay}`}
          segment={bar.segment}
          event={bar.event}
          canEdit={bar.canEdit}
          month={month}
          fullWidth={bar.fullWidth}
          variant="chip"
          displayLane={bar.displayLane}
          renderMode={bar.renderMode}
          showTooltip={false}
        />
      ))}
    </div>
  );
});
