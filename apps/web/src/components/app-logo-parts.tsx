import { cn } from "@/lib/utils";

type LogoVariant = "default" | "minimal" | "capsule" | "wordmark";
type LogoSize = "default" | "sm";

export function useLogoStyles(variant: LogoVariant, size: LogoSize) {
  const isCompact = size === "sm";
  const usesSansWordmark = variant !== "default";
  const gap =
    variant === "wordmark"
      ? "gap-0"
      : variant === "minimal" && !isCompact
        ? "gap-1.5"
        : isCompact
          ? "gap-1.5"
          : "gap-2";
  const iconSize =
    variant === "minimal"
      ? isCompact
        ? "h-6 w-6"
        : "h-10 w-10"
      : variant === "capsule"
        ? isCompact
          ? "h-5 w-5"
          : "h-6 w-6"
        : isCompact
          ? "h-4 w-4"
          : "h-5 w-5";
  const svgSize =
    variant === "minimal"
      ? isCompact
        ? "h-[17px] w-[17px]"
        : "h-7 w-7"
      : variant === "capsule"
        ? isCompact
          ? "h-3 w-3"
          : "h-3.5 w-3.5"
        : isCompact
          ? "h-3.5 w-3.5"
          : "h-4 w-4";
  const wordmarkClass =
    variant === "minimal"
      ? isCompact
        ? "text-[12px] font-semibold tracking-[-0.01em]"
        : "text-[18px] font-semibold tracking-[-0.012em]"
      : variant === "capsule"
        ? isCompact
          ? "text-[12px] font-semibold tracking-[-0.01em]"
          : "text-[16px] font-semibold tracking-[-0.01em]"
        : isCompact
          ? "text-[11px] font-semibold tracking-tight"
          : "text-sm font-semibold tracking-tight";
  const containerClass =
    variant === "capsule"
      ? "rounded-full border border-border/70 bg-muted/30 px-2.5 py-1.5"
      : variant === "minimal"
        ? "h-10 rounded-lg px-0.5"
        : "";

  return { isCompact, usesSansWordmark, gap, iconSize, svgSize, wordmarkClass, containerClass };
}

export function LogoIcon({
  variant,
  iconSize,
  svgSize,
}: {
  variant: LogoVariant;
  iconSize: string;
  svgSize: string;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center",
        iconSize,
        variant === "minimal" && "rounded-md",
        variant === "capsule" && "rounded-full bg-background/90",
      )}
    >
      <svg
        viewBox="0 0 24 24"
        className={svgSize}
        fill="none"
        stroke="currentColor"
        strokeWidth={variant === "minimal" ? "2.4" : "1.25"}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M2.8 12c2.35-3.9 5.77-6 9.2-6s6.85 2.1 9.2 6c-2.35 3.9-5.77 6-9.2 6s-6.85-2.1-9.2-6Z" />
        <circle cx="12" cy="12" r={variant === "minimal" ? "3.15" : "2.25"} fill="currentColor" />
      </svg>
    </div>
  );
}

export function LogoWordmark({
  usesSansWordmark,
  variant,
  wordmarkClass,
  appName,
}: {
  usesSansWordmark: boolean;
  variant: LogoVariant;
  wordmarkClass: string;
  appName: string;
}) {
  return (
    <span
      className={cn(
        usesSansWordmark ? "font-sans text-foreground/90" : "font-serif",
        variant === "minimal" && "leading-none",
        wordmarkClass,
      )}
    >
      {appName}
    </span>
  );
}
