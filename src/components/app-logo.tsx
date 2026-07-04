import { cn } from "@/lib/utils";
import { useLogoStyles, LogoIcon, LogoWordmark } from "@/components/app-logo-parts";

const APP_NAME = "Julian";

type AppLogoProps = {
  className?: string;
  /** Show wordmark inside the logo (default true); when false, icon-only inside same container */
  showWordmark?: boolean;
  /** "default" = full lockup; "sm" = compact */
  size?: "default" | "sm";
  /** Logo treatment used by different app surfaces */
  variant?: "default" | "minimal" | "capsule" | "wordmark";
};

export default function AppLogo({
  className,
  showWordmark = true,
  size = "default",
  variant = "default",
}: AppLogoProps) {
  const { gap, iconSize, svgSize, wordmarkClass, containerClass, usesSansWordmark } = useLogoStyles(
    variant,
    size,
  );

  return (
    <div
      className={cn("inline-flex items-center text-foreground", gap, containerClass, className)}
      aria-hidden="true"
    >
      <span className="sr-only">{APP_NAME}</span>
      {variant !== "wordmark" && (
        <LogoIcon variant={variant} iconSize={iconSize} svgSize={svgSize} />
      )}
      {showWordmark && (
        <LogoWordmark
          usesSansWordmark={usesSansWordmark}
          variant={variant}
          wordmarkClass={wordmarkClass}
          appName={APP_NAME}
        />
      )}
    </div>
  );
}
