import { cn } from "@/lib/utils";

// Class strings of the shadcn/ui primitives the React app used, so Foldkit
// views keep the same look.
const buttonBase =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive touch-manipulation";

const buttonVariants = {
  default: "bg-primary text-primary-foreground hover:bg-primary/90",
  destructive:
    "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
  outline:
    "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  ghost: "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
  link: "text-primary underline-offset-4 hover:underline",
} as const;

const buttonSizes = {
  default: "h-9 px-4 py-2 has-[>svg]:px-3 min-h-[44px] md:h-9 md:min-h-0",
  xs: "h-8 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3 min-h-[44px] md:h-6 md:min-h-0",
  sm: "h-9 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5 min-h-[44px] md:h-8 md:min-h-0",
  lg: "h-10 rounded-md px-6 has-[>svg]:px-4 min-h-[44px] md:min-h-0",
  icon: "size-11 md:size-9",
  "icon-xs": "size-11 rounded-md [&_svg:not([class*='size-'])]:size-3 md:size-6",
  "icon-sm": "size-11 md:size-8",
  "icon-lg": "size-11 md:size-10",
} as const;

export const buttonClass = (
  variant: keyof typeof buttonVariants = "default",
  size: keyof typeof buttonSizes = "default",
  className = "",
) => cn(buttonBase, buttonVariants[variant], buttonSizes[size], className);

export const inputClass = (className = "") =>
  cn(
    "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
    "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
    "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
    className,
  );

// A native checkbox styled like the shadcn Checkbox; the check mark is a
// background image so it needs no extra element.
export const checkboxClass = cn(
  "peer size-4 shrink-0 appearance-none rounded-[4px] border border-border/70 bg-background bg-center bg-no-repeat shadow-xs transition-shadow outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation",
  "checked:border-primary checked:bg-primary checked:bg-[length:0.875rem] checked:bg-[image:var(--checkbox-mark)]",
);
