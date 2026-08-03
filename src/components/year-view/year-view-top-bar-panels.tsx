import { YEAR_GRID_SHORTCUTS } from "@/components/year-view/year-grid-keyboard";
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

export function isMacPlatform() {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPod|iPad/.test(navigator.platform);
}

export function modKeyLabel() {
  return isMacPlatform() ? "⌘" : "Ctrl";
}

export function CommandPaletteTrigger({ open, onOpen }: { open: boolean; onOpen: () => void }) {
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-label="Open command palette"
      onClick={onOpen}
      className="hidden h-8 min-w-[9.5rem] items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-2.5 text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 md:inline-flex"
    >
      <span className="truncate">Commands</span>
      <kbd className="ml-auto rounded border border-border/60 bg-background/80 px-1 py-0.5 font-mono text-[10px] leading-none text-muted-foreground">
        {modKeyLabel()}K
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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commands: CommandItemDef[];
}) {
  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
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
          {YEAR_GRID_SHORTCUTS.map((entry) => (
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
