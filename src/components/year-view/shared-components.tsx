import { cn } from "@/lib/utils";

export function YearRefreshNotice({ label }: { label: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/95 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur">
      <span className="size-2 rounded-full bg-primary/70 animate-pulse" />
      {label}
    </div>
  );
}

export function SyncBadge({
  label,
  kind,
}: {
  label: string;
  kind: "synced" | "syncing" | "issues";
}) {
  const colorClass =
    kind === "issues"
      ? "bg-destructive/70"
      : kind === "syncing"
        ? "bg-amber-500/80"
        : "bg-emerald-500/80";
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background px-3 py-1.5 text-xs font-medium text-foreground"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span className={cn("size-1.5 rounded-full", colorClass)} aria-hidden="true" />
      {label}
    </span>
  );
}
