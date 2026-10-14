import { useEffect, useRef, useState } from "react";
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

type EventFormDialogProps = {
  open: boolean;
  mode: "create" | "edit";
  initialTitle?: string;
  dateLabel: string;
  calendarName: string | null;
  // Whether the form may be submitted at all (e.g. a writable calendar exists).
  submittable: boolean;
  // Shown under the field when the form cannot be submitted.
  hint?: string | null;
  submitting: boolean;
  error: string | null;
  onSubmit: (title: string) => void;
  onOpenChange: (open: boolean) => void;
};

const COPY = {
  create: { title: "New event", submit: "Add event", pending: "Adding…" },
  edit: { title: "Edit event", submit: "Save", pending: "Saving…" },
} as const;

export default function EventFormDialog({
  open,
  mode,
  initialTitle,
  dateLabel,
  calendarName,
  submittable,
  hint,
  submitting,
  error,
  onSubmit,
  onOpenChange,
}: EventFormDialogProps) {
  const [title, setTitle] = useState(initialTitle ?? "");
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Seed the field from the current event each time the dialog opens so an edit
  // starts from the existing title and a create starts blank.
  useEffect(() => {
    if (open) setTitle(initialTitle ?? "");
  }, [open, initialTitle]);

  const copy = COPY[mode];
  const trimmed = title.trim();
  const canSubmit = trimmed.length > 0 && !submitting && submittable;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          inputRef.current?.focus();
          inputRef.current?.select();
        }}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (canSubmit) onSubmit(trimmed);
          }}
        >
          <DialogHeader>
            <DialogTitle>{copy.title}</DialogTitle>
            <DialogDescription>
              {dateLabel}
              {calendarName ? ` · ${calendarName}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <Input
              ref={inputRef}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Event title"
              aria-label="Event title"
              disabled={submitting}
            />
            {!submittable && hint && <p className="mt-2 text-sm text-muted-foreground">{hint}</p>}
            {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {submitting ? copy.pending : copy.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
