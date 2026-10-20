import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useModalDrawer } from "@/components/use-modal-drawer";

export default function AppShell({
  sidebar,
  topbar,
  banner,
  mobileSidebarOpen,
  onMobileSidebarOpenChange,
  sidebarCollapsed = false,
  onRestoreFocusFallback,
  children,
}: {
  sidebar: ReactNode;
  topbar: ReactNode;
  banner?: ReactNode;
  mobileSidebarOpen: boolean;
  onMobileSidebarOpenChange: (open: boolean) => void;
  sidebarCollapsed?: boolean;
  /** Where focus goes when the drawer closes and its opener is gone or hidden. */
  onRestoreFocusFallback?: () => void;
  children: ReactNode;
}) {
  const drawer = useModalDrawer({
    open: mobileSidebarOpen,
    onOpenChange: onMobileSidebarOpenChange,
    onRestoreFocusFallback,
  });
  // While the drawer is a modal, everything behind it is out of reach.
  const behindModal = drawer.modal;

  return (
    <div className="flex h-[100svh] flex-col overflow-hidden bg-background text-foreground">
      <div className="print:hidden" inert={behindModal} data-app-chrome="">
        {topbar}
      </div>
      {banner ? (
        <div className="print:hidden" inert={behindModal} data-app-chrome="">
          {banner}
        </div>
      ) : null}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        <button
          ref={drawer.backdropRef}
          type="button"
          className={cn(
            "fixed inset-0 z-40 bg-black/40 transition-opacity print:hidden md:hidden",
            mobileSidebarOpen ? "opacity-100" : "pointer-events-none opacity-0",
          )}
          onClick={() => onMobileSidebarOpenChange(false)}
          aria-label="Close sidebar"
          aria-hidden={!mobileSidebarOpen}
          // A pointer target only: Escape closes the drawer from the keyboard.
          tabIndex={-1}
        />
        <aside
          ref={drawer.drawerRef}
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
          // Focusable as a fallback target, never a Tab stop of its own.
          tabIndex={-1}
          onKeyDown={drawer.onKeyDown}
          data-mobile-sidebar=""
        >
          <div className="h-full overflow-y-auto px-4 py-4 scrollbar-minimal" data-sidebar-root="">
            {sidebar}
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
            {sidebar}
          </div>
        </aside>
        <main
          id="main-content"
          inert={behindModal}
          className="flex min-h-0 min-w-0 flex-1 flex-col print:min-h-auto print:overflow-visible"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
