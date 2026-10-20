import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useDesktopSidebar } from "@/lib/use-desktop-sidebar";

export default function AppShell({
  sidebar,
  topbar,
  banner,
  mobileSidebarOpen,
  onMobileSidebarOpenChange,
  sidebarCollapsed = false,
  children,
}: {
  sidebar: ReactNode;
  topbar: ReactNode;
  banner?: ReactNode;
  mobileSidebarOpen: boolean;
  onMobileSidebarOpenChange: (open: boolean) => void;
  sidebarCollapsed?: boolean;
  children: ReactNode;
}) {
  const isDesktop = useDesktopSidebar();
  const drawerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!mobileSidebarOpen) return;
    // A drawer must not keep trapping focus after its subtree moves to desktop.
    if (isDesktop) {
      onMobileSidebarOpenChange(false);
      return;
    }
    const drawer = drawerRef.current;
    if (!drawer) return;
    const opener = document.activeElement;
    const focusable = () =>
      Array.from(
        drawer.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.getClientRects().length > 0);
    const focusFirst = () => (focusable()[0] ?? drawer).focus();
    const onFocus = (event: FocusEvent) => {
      if (drawer.contains(event.target as Node)) return;
      // Opening a portaled dialog (for example Ctrl+K) replaces the drawer.
      // Leave that dialog's focus scope in charge until it closes.
      if (document.querySelector('[data-slot="dialog-content"][data-state="open"]')) {
        onMobileSidebarOpenChange(false);
      } else focusFirst();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onMobileSidebarOpenChange(false);
      } else if (event.key === "Tab") {
        const targets = focusable();
        const first = targets[0] ?? drawer;
        const last = targets.at(-1) ?? drawer;
        if (
          event.shiftKey &&
          (document.activeElement === first || document.activeElement === drawer)
        ) {
          event.preventDefault();
          last.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last || document.activeElement === drawer)
        ) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    focusFirst();
    drawer.addEventListener("keydown", onKeyDown);
    document.addEventListener("focusin", onFocus);
    return () => {
      drawer.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("focusin", onFocus);
      if (
        opener instanceof HTMLElement &&
        opener.isConnected &&
        opener.getClientRects().length > 0
      ) {
        opener.focus();
      } else {
        document.querySelector<HTMLElement>("[data-year-grid-root]")?.focus();
      }
    };
  }, [isDesktop, mobileSidebarOpen, onMobileSidebarOpenChange]);
  return (
    <div className="flex h-[100svh] flex-col overflow-hidden bg-background text-foreground">
      <div className="print:hidden">{topbar}</div>
      {banner ? <div className="print:hidden">{banner}</div> : null}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        <button
          type="button"
          className={cn(
            "fixed inset-0 z-40 bg-black/40 transition-opacity print:hidden md:hidden",
            mobileSidebarOpen ? "opacity-100" : "pointer-events-none opacity-0",
          )}
          onClick={() => onMobileSidebarOpenChange(false)}
          aria-label="Close sidebar"
          aria-hidden={!mobileSidebarOpen}
          tabIndex={mobileSidebarOpen ? 0 : -1}
        />
        <aside
          ref={drawerRef}
          className={cn(
            "fixed inset-y-0 left-0 z-50 w-72 border-r border-border/60 bg-card shadow-xl transition-transform print:hidden md:hidden",
            mobileSidebarOpen ? "translate-x-0" : "-translate-x-full",
          )}
          role="dialog"
          aria-modal="true"
          aria-label="Calendars"
          aria-hidden={!mobileSidebarOpen}
          // Off-screen, its checkboxes and buttons must not stay tabbable.
          inert={!mobileSidebarOpen}
          tabIndex={mobileSidebarOpen ? 0 : -1}
        >
          <div className="h-full overflow-y-auto px-4 py-4 scrollbar-minimal" data-sidebar-root="">
            {isDesktop ? null : sidebar}
          </div>
        </aside>
        <aside
          className={cn(
            "relative hidden shrink-0 flex-col bg-card transition-all duration-200 print:hidden md:flex",
            sidebarCollapsed ? "w-0 border-r border-transparent" : "w-72 border-r border-border/60",
          )}
        >
          <div
            className={cn(
              "h-full scrollbar-minimal transition-opacity duration-200",
              sidebarCollapsed
                ? "pointer-events-none overflow-hidden px-0 py-0 opacity-0"
                : "overflow-y-auto px-4 py-4",
            )}
            aria-hidden={sidebarCollapsed}
            inert={sidebarCollapsed}
            data-sidebar-root=""
          >
            {isDesktop ? sidebar : null}
          </div>
        </aside>
        <main
          id="main-content"
          className="flex min-h-0 min-w-0 flex-1 flex-col print:min-h-auto print:overflow-visible"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
