import {
  currentPlatform,
  modKeyLabel,
  yearGridShortcuts,
} from "@/components/year-view/year-grid-keyboard";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

function isInOpenDialog(element: Element | null) {
  return element?.closest("[data-slot='dialog-content'][data-state='open']") != null;
}

export function CommandPaletteTrigger({ open, onOpen }: { open: boolean; onOpen: () => void }) {
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={onOpen}
      className="hidden h-8 min-w-[9.5rem] items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-2.5 text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 md:inline-flex"
    >
      <span className="truncate">Commands</span>
      <kbd className="ml-auto rounded border border-border/60 bg-background/80 px-1 py-0.5 font-mono text-[10px] leading-none text-muted-foreground">
        {modKeyLabel(currentPlatform())}K
      </kbd>
    </button>
  );
}

type CommandItemDef = {
  id: string;
  label: string;
  hint?: string;
  onSelect: () => void;
};

export function YearViewCommandPalette({
  open,
  onOpenChange,
  commands,
  restoreFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commands: CommandItemDef[];
  /** Runs once the palette has closed, unless a command opened another dialog. */
  restoreFocus: () => void;
}) {
  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      onCloseAutoFocus={(closeEvent) => {
        // Radix would return focus to whatever had it on open, which may be
        // gone (the drawer) or would steal it from a dialog a command opened.
        closeEvent.preventDefault();
        if (!isInOpenDialog(document.activeElement)) restoreFocus();
      }}
      title="Commands"
      description="Search for a command to run"
    >
      <CommandInput placeholder="Search commands…" />
      <CommandList>
        <CommandEmpty>No matching commands.</CommandEmpty>
        <CommandGroup heading="Actions">
          {commands.map((command) => (
            <CommandItem
              key={command.id}
              value={command.label}
              onSelect={() => {
                command.onSelect();
                onOpenChange(false);
              }}
            >
              <span>{command.label}</span>
              {command.hint ? <CommandShortcut>{command.hint}</CommandShortcut> : null}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

export function TopBarKeyboardShortcuts({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
        </DialogHeader>
        <dl className="grid max-h-[min(60vh,28rem)] gap-x-6 gap-y-2 overflow-y-auto sm:grid-cols-2">
          {yearGridShortcuts(currentPlatform()).map((entry) => (
            <div
              key={`${entry.keys}-${entry.action}`}
              className="flex items-start justify-between gap-3 text-sm"
            >
              <dt className="shrink-0 font-mono text-xs text-muted-foreground">{entry.keys}</dt>
              <dd className="text-right text-foreground">{entry.action}</dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
