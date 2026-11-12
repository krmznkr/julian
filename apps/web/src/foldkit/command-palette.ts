import type { Model } from "./model";
import type { act } from "./html";

type Choice = Readonly<{ name: string; hint?: string; action: Parameters<typeof act>[0] }>;

const commandChoices = (model: Model): readonly Choice[] => [
  { name: "Jump to today", hint: "T", action: "today" },
  { name: "New event", hint: "N", action: "create" },
  {
    name: model.mode === "grid" ? "Switch to timeline" : "Switch to year grid",
    hint: "V",
    action: "toggle-mode",
  },
  { name: "Refresh events", hint: "R", action: "refresh" },
  { name: "Show keyboard shortcuts", hint: "?", action: "help" },
  { name: "Toggle theme", hint: "Shift T", action: "theme" },
  { name: "Toggle sidebar", hint: "S", action: "sidebar" },
  { name: "Appearance settings", action: "settings" },
  { name: "Previous year", action: "previous-year" },
  { name: "Next year", action: "next-year" },
  model.page === "calendar"
    ? { name: "Disconnect Google Calendar", action: "logout" }
    : { name: "Connect Google Calendar", action: "connect" },
];

// The update resolves Enter against the latest query, so a fast Enter after
// typing never runs a command from a stale render.
export const commandMatches = (model: Model) =>
  commandChoices(model).filter((choice) =>
    choice.name.toLowerCase().includes(model.commandQuery.trim().toLowerCase()),
  );
