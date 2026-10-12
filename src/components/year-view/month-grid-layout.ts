// Google Calendar-style collision layout. Every visible year-view event gets a
// lane for the part of the month it occupies. A lane is reused as soon as the
// previous event ends, so overlapping blocks sit beside one another while
// non-overlapping blocks can expand back into the same column.

import type { EventSegment } from "@/domain";

export function visibleYearEventLaneMap(segments: ReadonlyArray<EventSegment>) {
  const visible = segments
    .filter((segment) => segment.allDay || segment.isMultiDay)
    .sort((a, b) => a.startDay - b.startDay || b.endDay - a.endDay || a.id.localeCompare(b.id));
  const laneEnds: number[] = [];
  const lanes = new Map<string, number>();

  // eslint-disable-next-line functional/no-loop-statements
  for (const segment of visible) {
    const reusableLane = laneEnds.findIndex((endDay) => segment.startDay > endDay);
    const laneIndex = reusableLane >= 0 ? reusableLane : laneEnds.length;
    // eslint-disable-next-line functional/immutable-data
    laneEnds[laneIndex] = segment.endDay;
    // eslint-disable-next-line functional/immutable-data
    lanes.set(segment.id, laneIndex + 1);
  }

  return { lanes, laneCount: laneEnds.length };
}

export function monthColumnTemplateColumns(lanes: number): string {
  return `repeat(${Math.max(1, lanes)}, minmax(0, 1fr))`;
}
