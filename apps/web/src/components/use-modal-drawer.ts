import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
  type KeyboardEvent,
} from "react";

/** Tailwind's `md` breakpoint: from here up the sidebar is a column, not a drawer. */
export const DESKTOP_SIDEBAR_QUERY = "(min-width: 48rem)";

const FOCUSABLE =
  "a[href], button, input:not([type='hidden']), select, textarea, [tabindex], [contenteditable='true']";

function isRendered(element: HTMLElement) {
  // jsdom has no layout; real browsers drop display:none subtrees here.
  return typeof element.checkVisibility === "function" ? element.checkVisibility() : true;
}

function canTakeFocus(element: HTMLElement) {
  return !element.matches(":disabled") && !element.closest("[inert]") && isRendered(element);
}

/** The drawer's Tab stops, in document order. */
function tabStopsIn(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (element) => element.tabIndex >= 0 && canTakeFocus(element),
  );
}

function useMediaQuery(query: string) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/**
 * Keyboard behavior for the narrow-screen sidebar drawer, a modal dialog.
 *
 * Opening moves focus into the drawer; Tab and Shift+Tab wrap inside it; Escape
 * closes it; closing returns focus to whatever opened it. Crossing into the
 * desktop layout closes it, because the drawer is hidden there.
 *
 * There is deliberately no focusin guard. The background is `inert` and its
 * day-details portal is suspended while the drawer is open. A shortcut that
 * focuses something outside (`/`, Ctrl+K) closes the drawer first. Closing
 * only reclaims focus that the drawer still holds or has dropped to the body.
 * Focus already moved on purpose stays where it is.
 */
export function useModalDrawer({
  open,
  onOpenChange,
  onRestoreFocusFallback,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Where focus goes on close when the opener is gone or hidden. */
  onRestoreFocusFallback?: () => void;
}) {
  const drawerRef = useRef<HTMLElement | null>(null);
  const backdropRef = useRef<HTMLButtonElement | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);
  const isDesktop = useMediaQuery(DESKTOP_SIDEBAR_QUERY);

  useEffect(() => {
    if (open && isDesktop) onOpenChange(false);
  }, [isDesktop, onOpenChange, open]);

  // A layout effect, so a caller that closes the drawer inside `flushSync` can
  // move focus elsewhere straight after, once this restoration has run.
  useLayoutEffect(() => {
    const drawer = drawerRef.current;
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = open;
    if (!drawer || open === wasOpen) return;

    if (open) {
      const active = document.activeElement;
      // The body is no opener. Focus lands there when this same commit removed
      // the focused element, such as suspended day details; closing then falls
      // back instead of leaving focus on the body.
      openerRef.current =
        active instanceof HTMLElement &&
        active.isConnected &&
        active !== document.body &&
        !drawer.contains(active)
          ? active
          : null;
      (tabStopsIn(drawer)[0] ?? drawer).focus({ preventScroll: true });
      return;
    }

    const opener = openerRef.current;
    openerRef.current = null;
    const active = document.activeElement;
    const drawerHoldsFocus =
      active === null ||
      active === document.body ||
      active === backdropRef.current ||
      drawer.contains(active);
    if (!drawerHoldsFocus) return;
    if (opener?.isConnected && canTakeFocus(opener)) opener.focus({ preventScroll: true });
    else onRestoreFocusFallback?.();
  }, [onRestoreFocusFallback, open]);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      const drawer = drawerRef.current;
      if (!drawer || event.isDefaultPrevented()) return;
      // React bubbles events from portals through the component tree. A layer
      // portaled from inside the drawer handles its own keys.
      if (!(event.target instanceof Node) || !drawer.contains(event.target)) return;

      if (event.key === "Escape") {
        event.preventDefault();
        onOpenChange(false);
        return;
      }
      if (event.key !== "Tab") return;

      const stops = tabStopsIn(drawer);
      const first = stops[0];
      const last = stops.at(-1);
      const active = document.activeElement;
      if (!first || !last) {
        event.preventDefault();
        drawer.focus({ preventScroll: true });
      } else if (event.shiftKey && (active === first || active === drawer)) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    },
    [onOpenChange],
  );

  return { drawerRef, backdropRef, onKeyDown, modal: open && !isDesktop };
}
