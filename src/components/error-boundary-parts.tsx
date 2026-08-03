import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@/lib/router";

export function ErrorDisplay({
  message,
  reloadLabel,
  backLabel,
  backHref,
  onReload,
}: {
  message: string;
  reloadLabel: string;
  backLabel: string;
  backHref: string;
  onReload: () => void;
}) {
  return (
    <div
      className="flex min-h-[100svh] w-full items-center justify-center bg-background px-6 py-10"
      role="alert"
      aria-live="assertive"
    >
      <div className="w-full max-w-lg rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center shadow-sm">
        <AlertTriangle className="mx-auto size-10 text-destructive" aria-hidden />
        <p className="mt-4 text-sm font-medium text-foreground">{message}</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button onClick={onReload} variant="default" size="sm">
            {reloadLabel}
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={backHref}>{backLabel}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
