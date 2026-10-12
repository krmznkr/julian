export type DemoContext = {
  readonly signal: AbortSignal;
  readonly press: (spec: string, holdMs?: number) => Promise<void>;
  readonly wait: (ms: number) => Promise<void>;
  readonly type: (selector: string, text: string) => Promise<void>;
  readonly submitDialog: () => Promise<void>;
};

export type DemoBeat = {
  readonly id: string;
  readonly caption: string;
  readonly run: (ctx: DemoContext) => Promise<void>;
};

// One short pass through a real workflow, then hand control to the visitor.
export const DEMO_SCRIPT: readonly DemoBeat[] = [
  {
    id: "day",
    caption: "Open today and browse its events.",
    run: async ({ press, wait }) => {
      await press("t", 250);
      await press("Enter", 600);
      await press("ArrowDown", 500);
      await wait(800);
      await press("Escape", 250);
    },
  },
  {
    id: "add",
    caption: "Press N to add dinner to the sample calendar.",
    run: async ({ press, type, submitDialog, wait }) => {
      await press("n", 300);
      await type("[data-slot='dialog-content'] input", "Dinner with friends");
      await wait(400);
      await submitDialog();
      await wait(800);
    },
  },
  {
    id: "find",
    caption: "Open commands to jump to a month or change the view.",
    run: async ({ press, wait }) => {
      await press("Meta+k", 600);
      await wait(1100);
      await press("Escape", 250);
    },
  },
];
