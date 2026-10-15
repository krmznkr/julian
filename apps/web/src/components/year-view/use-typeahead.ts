import { useCallback, useEffect, useRef } from "react";
import {
  resolveDayTypeaheadInput,
  type KeyboardCell,
} from "@/components/year-view/year-grid-keyboard";

/** How long a half-typed number waits for a second digit before committing. */
const COMMIT_DELAY_MS = 650;
/** How long the preview lingers after a number commits immediately. */
const FEEDBACK_MS = 450;

export type TypeaheadDeps = {
  /** Flashes the destination cell so the jump is visible before it happens. */
  showPreview: (cell: KeyboardCell, durationMs: number) => void;
  announce: (message: string) => void;
};

export type TypeaheadSpec = {
  /** Largest accepted value: days in the current month, or 12 for months. */
  max: number;
  /** The cell to preview for a candidate value. */
  toPreviewCell: (value: number) => KeyboardCell;
  toLabel: (value: number) => string;
  onCommit: (value: number, keepDialog: boolean) => void;
};

/**
 * Type a number to jump to it — "1" then "5" goes to 15, but a bare "7" goes to
 * 7 without waiting, because no second digit could extend it.
 *
 * The grid runs two of these: days (1–31, plain digits) and months (1–12,
 * Shift+digit). They were written out twice and had already begun to drift, so
 * the buffer, the two timers and the commit/pending decision live here once and
 * the callers supply only what differs.
 */
export function useTypeahead({ showPreview, announce }: TypeaheadDeps) {
  const bufferRef = useRef("");
  const timeoutRef = useRef<number | null>(null);

  const clear = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    bufferRef.current = "";
  }, []);

  useEffect(() => clear, [clear]);

  const restartTimer = useCallback((onElapsed: () => void, delayMs: number) => {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(onElapsed, delayMs);
  }, []);

  /**
   * Feeds one keystroke to the machine. Returns false when the key is not a
   * digit this typeahead wants, so the caller can go on matching other keys.
   */
  const handleKey = useCallback(
    (key: string, keepDialog: boolean, spec: TypeaheadSpec): boolean => {
      const result = resolveDayTypeaheadInput({
        buffer: bufferRef.current,
        key,
        maxDay: spec.max,
      });
      if (!result) return false;

      if (result.commitDay !== null) {
        const value = result.commitDay;
        spec.onCommit(value, keepDialog);
        bufferRef.current = "";
        showPreview(spec.toPreviewCell(value), FEEDBACK_MS);
        announce(spec.toLabel(value));
        restartTimer(clear, FEEDBACK_MS);
      }

      if (result.pendingDay !== null) {
        const value = result.pendingDay;
        bufferRef.current = result.nextBuffer;
        showPreview(spec.toPreviewCell(value), COMMIT_DELAY_MS);
        announce(spec.toLabel(value));
        restartTimer(() => {
          clear();
          spec.onCommit(value, keepDialog);
        }, COMMIT_DELAY_MS);
      }

      return true;
    },
    [announce, clear, restartTimer, showPreview],
  );

  return { handleKey, clear };
}
