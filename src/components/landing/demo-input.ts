// Synthetic input for the landing-page demo.
//
// The year view listens for keydown on `window` and never checks `isTrusted`,
// so dispatching events here drives the *real* application logic — the same
// code path a visitor's own keyboard would take. Nothing is simulated.

export type KeyChord = {
  readonly key: string;
  readonly code: string;
  readonly shiftKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
  /** Mac-style keycaps for the on-screen HUD. */
  readonly caps: readonly string[];
};

const NAMED_CODES = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Enter",
  "Escape",
  "Home",
  "End",
  "PageUp",
  "PageDown",
  "Backspace",
  "Delete",
  "Tab",
]);

const CAP_LABELS: Record<string, string> = {
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
  Enter: "return",
  Escape: "esc",
  Backspace: "delete",
  " ": "space",
  Meta: "⌘",
  Shift: "⇧",
  Alt: "⌥",
};

function codeFor(key: string) {
  if (NAMED_CODES.has(key)) return key;
  if (key === " ") return "Space";
  if (/^[a-z]$/i.test(key)) return `Key${key.toUpperCase()}`;
  if (/^\d$/.test(key)) return `Digit${key}`;
  return key;
}

function capFor(key: string) {
  return CAP_LABELS[key] ?? (key.length === 1 ? key.toUpperCase() : key);
}

/**
 * Parses `"Meta+K"`, `"Shift+ArrowRight"`, `"t"` into a dispatchable chord.
 * The bare key is written the way the browser reports it, so letters stay
 * lowercase unless Shift is held.
 */
export function chord(spec: string): KeyChord {
  const parts = spec.split("+");
  const key = parts[parts.length - 1] ?? "";
  const modifiers = new Set(parts.slice(0, -1));
  const shiftKey = modifiers.has("Shift");

  return {
    key: shiftKey && /^[a-z]$/i.test(key) ? key.toUpperCase() : key,
    code: codeFor(key),
    shiftKey,
    metaKey: modifiers.has("Meta"),
    altKey: modifiers.has("Alt"),
    caps: [
      ...(modifiers.has("Meta") ? ["⌘"] : []),
      ...(modifiers.has("Alt") ? ["⌥"] : []),
      ...(shiftKey ? ["⇧"] : []),
      capFor(key),
    ],
  };
}

/**
 * Where a synthetic key should land. Using the focused element (rather than
 * always `window`) keeps the app's own guards honest: typing into the quick-add
 * field must *not* also move the grid cursor, and it doesn't.
 */
function keyTarget(): EventTarget {
  const active = document.activeElement;
  return active instanceof HTMLElement ? active : document.body;
}

export function pressChord(input: KeyChord) {
  const target = keyTarget();
  const init: KeyboardEventInit = {
    key: input.key,
    code: input.code,
    shiftKey: input.shiftKey,
    metaKey: input.metaKey,
    altKey: input.altKey,
    bubbles: true,
    cancelable: true,
  };
  target.dispatchEvent(new KeyboardEvent("keydown", init));
  target.dispatchEvent(new KeyboardEvent("keyup", init));
}

export function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const timer = window.setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      window.clearTimeout(timer);
      resolve();
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

// React tracks the last value it wrote on the DOM node, so assigning `.value`
// directly is swallowed as a no-op change. Going through the prototype setter
// is the supported way to make a controlled input observe an external write.
const nativeValueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;

function setInputValue(input: HTMLInputElement, value: string) {
  nativeValueSetter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

/** Types character by character, at a speed that reads as human rather than robotic. */
export async function typeInto(
  input: HTMLInputElement,
  text: string,
  { signal, perCharMs = 55 }: { signal?: AbortSignal; perCharMs?: number } = {},
) {
  await [...text].reduce(
    (chain, _char, index) =>
      chain.then(async () => {
        if (signal?.aborted || !input.isConnected) return;
        setInputValue(input, text.slice(0, index + 1));
        // Jitter keeps the rhythm from sounding mechanical.
        await sleep(perCharMs + Math.round(Math.random() * 40), signal);
      }),
    Promise.resolve(),
  );
}

export function centerOf(element: Element) {
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/** A real pointer sequence, so React's own handlers run exactly as for a visitor. */
export function clickElement(element: Element) {
  const { x, y } = centerOf(element);
  const init = { bubbles: true, cancelable: true, clientX: x, clientY: y };
  element.dispatchEvent(new PointerEvent("pointerdown", { ...init, pointerId: 1 }));
  element.dispatchEvent(new MouseEvent("mousedown", init));
  element.dispatchEvent(new PointerEvent("pointerup", { ...init, pointerId: 1 }));
  element.dispatchEvent(new MouseEvent("mouseup", init));
  element.dispatchEvent(new MouseEvent("click", init));
}
