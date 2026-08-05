// The scripted tour. Each beat drives the real year view with real input; the
// captions only narrate what the app is already doing.
import { sleep } from "@/components/landing/demo-input";

export type DemoContext = {
  readonly signal: AbortSignal;
  /** Presses a chord, flashing its keycaps on the HUD. */
  readonly press: (spec: string, holdMs?: number) => Promise<void>;
  readonly wait: (ms: number) => Promise<void>;
  /** Types into the first input matching `selector`, keycap by keycap. */
  readonly type: (selector: string, text: string) => Promise<void>;
  /** Moves the on-screen cursor to an element and clicks it. */
  readonly clickOn: (selector: string) => Promise<void>;
  /** Submits the open dialog's form, the way Return does. */
  readonly submitDialog: () => Promise<void>;
  readonly focusGrid: () => void;
  readonly query: (selector: string) => Element | null;
};

export type DemoBeat = {
  readonly id: string;
  readonly caption: string;
  readonly run: (ctx: DemoContext) => Promise<void>;
  /** Pause after the beat, before the next caption. */
  readonly restMs?: number;
};

const DIALOG = "[data-slot='dialog-content']";

export const DEMO_SCRIPT: readonly DemoBeat[] = [
  {
    id: "intro",
    caption: "This is the real app. Twelve months, one screen.",
    run: ({ wait }) => wait(2600),
  },
  {
    id: "today",
    caption: "T lands you on today.",
    run: async ({ press, wait }) => {
      await press("t", 900);
      await wait(900);
    },
  },
  {
    id: "open-day",
    caption: "Return opens the day — here's what's actually on it.",
    run: async ({ press, wait }) => {
      await press("Enter", 700);
      await wait(1600);
    },
  },
  {
    id: "browse-day",
    caption: "Arrows walk through the day, event by event.",
    run: async ({ press }) => {
      await press("ArrowDown", 850);
      await press("ArrowDown", 850);
      await press("ArrowDown", 1100);
    },
  },
  {
    id: "close-day",
    caption: "Escape puts it away.",
    run: async ({ press, wait }) => {
      await press("Escape", 600);
      await wait(500);
    },
  },
  {
    id: "jump",
    caption: "Shift + arrows cover three months a step.",
    // Left first, then right: jumping forward from late in the year clamps at
    // December, and the tour would never find its way back to today.
    run: async ({ press, wait }) => {
      await press("Shift+ArrowLeft", 900);
      await press("Shift+ArrowLeft", 900);
      await wait(700);
      await press("Shift+ArrowRight", 900);
      await press("Shift+ArrowRight", 900);
    },
  },
  {
    id: "quick-add",
    caption: "N adds an event right where you're standing.",
    run: async ({ press, wait, type, submitDialog, query }) => {
      await press("n", 800);
      await wait(500);
      if (!query(DIALOG)) return;
      await type(`${DIALOG} input`, "Roast chicken with the Alaouis");
      await wait(600);
      await submitDialog();
      await wait(1300);
    },
  },
  {
    id: "palette",
    caption: "⌘K for everything that isn't a shortcut yet.",
    run: async ({ press, wait }) => {
      await press("Meta+k", 800);
      await wait(700);
      await press("ArrowDown", 550);
      await press("ArrowDown", 550);
      await press("ArrowDown", 900);
      await press("Escape", 600);
      await wait(400);
    },
  },
  {
    id: "calendars",
    caption: "Every calendar is a switch. Flip one and the year changes.",
    run: async ({ clickOn, wait, focusGrid }) => {
      await clickOn("[data-sidebar-root] [role='checkbox']");
      await wait(1500);
      await clickOn("[data-sidebar-root] [role='checkbox']");
      await wait(900);
      focusGrid();
    },
  },
  {
    id: "sidebar",
    caption: "S gets the sidebar out of the way.",
    run: async ({ press, wait }) => {
      await press("s", 900);
      await wait(1100);
      await press("s", 900);
      await wait(500);
    },
  },
  {
    id: "theme",
    caption: "⇧T cycles light, dark, and whatever your system says.",
    // Three presses is a full lap of the cycle, so the tour hands the visitor
    // back the theme they arrived with.
    run: async ({ press, wait }) => {
      await press("Shift+t", 1000);
      await wait(1100);
      await press("Shift+t", 1000);
      await wait(1100);
      await press("Shift+t", 1000);
      await wait(500);
    },
  },
  {
    id: "outro",
    caption: "That's the whole thing. Connect your calendar and it's your year.",
    run: () => sleep(3200),
    restMs: 1600,
  },
];
