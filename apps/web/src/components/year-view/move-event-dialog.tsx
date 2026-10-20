import { useId, useState, type FormEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { CalendarEvent } from "@julian/domain";

type MoveEventDialogProps = {
  event: CalendarEvent | null;
  onMove: (event: CalendarEvent, date: string) => void;
  onClose: () => void;
  // Where focus goes once the dialog closes; Radix would otherwise drop it on <body>.
  restoreFocus: () => void;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** The keyboard alternative to dragging an all-day event to another day. */
export default function MoveEventDialog({
  event,
  onMove,
  onClose,
  restoreFocus,
}: MoveEventDialogProps) {
  const [date, setDate] = useState(() => event?.start.slice(0, 10) ?? "");
  const inputId = useId();

  const submit = (formEvent: FormEvent) => {
    formEvent.preventDefault();
    if (!event || !DATE_PATTERN.test(date)) return;
    onMove(event, date);
    onClose();
  };

  return (
    <Dialog open={event !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent
        className="sm:max-w-sm"
        onCloseAutoFocus={(closeEvent) => {
          closeEvent.preventDefault();
          restoreFocus();
        }}
      >
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Move event</DialogTitle>
            <DialogDescription>
              Pick the day “{event?.title ?? ""}” should start on. Its length stays the same.
            </DialogDescription>
          </DialogHeader>
          <label htmlFor={inputId} className="grid gap-1.5 text-sm font-medium">
            Start date
            <Input
              id={inputId}
              type="date"
              required
              value={date}
              onChange={(changeEvent) => setDate(changeEvent.target.value)}
            />
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!DATE_PATTERN.test(date)}>
              Move
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
