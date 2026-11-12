import { describe, expect, it } from "vitest";
import { update } from "./app";
import { placeDayPanel } from "./dialogs";
import { Message, initialModel } from "./model";

const seed = { ...initialModel("/2026"), page: "calendar" as const };

describe("day panel placement", () => {
  it("places the panel and reveals it", async () => {
    const cell = document.createElement("div");
    const panel = document.createElement("div");
    document.body.append(cell, panel);
    await placeDayPanel(cell, panel);
    expect(panel.style.visibility).toBe("visible");
    expect(panel.style.left).toMatch(/px$/);
    cell.remove();
    panel.remove();
  });
});

describe("command palette", () => {
  it("runs the first command matching the latest query on Enter", () => {
    const typed = { ...seed, dialog: "commands" as const, commandQuery: "keyboard" };
    expect(update(typed, Message.SubmittedCommand()).model.dialog).toBe("help");
    const none = { ...typed, commandQuery: "zzz" };
    expect(update(none, Message.SubmittedCommand()).model).toBe(none);
  });
});
