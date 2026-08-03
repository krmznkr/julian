import { describe, expect, it } from "vitest";
import {
  applyArrowMoveStep,
  clampCell,
  digitFromKeyboardCode,
  firstDayOfMonth,
  lastDayOfMonth,
  moveCellByDays,
  moveCellByMonths,
  resolveDayTypeaheadInput,
  resolveArrowMoveStep,
  shouldHandleGridKeys,
} from "@/components/year-view/year-grid-keyboard";

describe("year-grid keyboard helpers", () => {
  it("clamps day to month length", () => {
    expect(clampCell({ month: 1, day: 31 }, 2026)).toEqual({ month: 1, day: 28 });
  });

  it("moves to first and last day of month", () => {
    expect(firstDayOfMonth({ month: 5, day: 12 })).toEqual({ month: 5, day: 1 });
    expect(lastDayOfMonth({ month: 1, day: 12 }, 2026)).toEqual({ month: 1, day: 28 });
  });

  it("moves by weeks across month boundaries", () => {
    expect(moveCellByDays({ month: 0, day: 5 }, 7, 2026)).toEqual({ month: 0, day: 12 });
    expect(moveCellByDays({ month: 0, day: 30 }, 7, 2026)).toEqual({ month: 1, day: 6 });
  });

  it("resolves fast arrow steps", () => {
    expect(resolveArrowMoveStep({ key: "ArrowDown", shiftKey: true, altKey: false })).toEqual({
      verticalDays: 7,
      horizontalMonths: 0,
      yearDelta: 0,
    });
    expect(resolveArrowMoveStep({ key: "ArrowRight", altKey: true, shiftKey: false })).toEqual({
      verticalDays: 0,
      horizontalMonths: 0,
      yearDelta: 1,
    });
    expect(
      applyArrowMoveStep(
        { month: 0, day: 10 },
        { verticalDays: 7, horizontalMonths: 0, yearDelta: 0 },
        2026,
      ),
    ).toEqual({
      month: 0,
      day: 17,
    });
    expect(moveCellByMonths({ month: 0, day: 31 }, 1, 2026)).toEqual({ month: 1, day: 28 });
  });

  it("resolves typed day jumps with a short ambiguity buffer", () => {
    expect(resolveDayTypeaheadInput({ buffer: "", key: "4", maxDay: 31 })).toEqual({
      nextBuffer: "",
      commitDay: 4,
      pendingDay: null,
    });
    expect(resolveDayTypeaheadInput({ buffer: "", key: "1", maxDay: 31 })).toEqual({
      nextBuffer: "1",
      commitDay: null,
      pendingDay: 1,
    });
    expect(resolveDayTypeaheadInput({ buffer: "1", key: "2", maxDay: 31 })).toEqual({
      nextBuffer: "",
      commitDay: 12,
      pendingDay: null,
    });
    expect(resolveDayTypeaheadInput({ buffer: "", key: "3", maxDay: 28 })).toEqual({
      nextBuffer: "",
      commitDay: 3,
      pendingDay: null,
    });
    expect(resolveDayTypeaheadInput({ buffer: "3", key: "2", maxDay: 31 })).toEqual({
      nextBuffer: "2",
      commitDay: 3,
      pendingDay: 2,
    });
  });

  it("reads the physical digit from a key code, ignoring the Shift modifier", () => {
    expect(digitFromKeyboardCode("Digit1")).toBe("1");
    expect(digitFromKeyboardCode("Numpad9")).toBe("9");
    expect(digitFromKeyboardCode("KeyN")).toBeNull();
    expect(digitFromKeyboardCode("Slash")).toBeNull();
  });

  it("resolves Shift+number month jumps with a max of 12", () => {
    // Single digits 2–9 commit immediately as that month.
    expect(resolveDayTypeaheadInput({ buffer: "", key: "9", maxDay: 12 })).toEqual({
      nextBuffer: "",
      commitDay: 9,
      pendingDay: null,
    });
    // "1" is ambiguous (could become 10/11/12), so it stays pending.
    expect(resolveDayTypeaheadInput({ buffer: "", key: "1", maxDay: 12 })).toEqual({
      nextBuffer: "1",
      commitDay: null,
      pendingDay: 1,
    });
    // "1" then "1" → November.
    expect(resolveDayTypeaheadInput({ buffer: "1", key: "1", maxDay: 12 })).toEqual({
      nextBuffer: "",
      commitDay: 11,
      pendingDay: null,
    });
    // "1" then "3" exceeds 12 → commits January, drops the stray digit.
    expect(resolveDayTypeaheadInput({ buffer: "1", key: "3", maxDay: 12 })).toEqual({
      nextBuffer: "",
      commitDay: 1,
      pendingDay: null,
    });
  });
});

describe("shouldHandleGridKeys", () => {
  it("allows grid keys from the top bar but not from the sidebar", () => {
    const topBar = document.createElement("header");
    const sidebar = document.createElement("aside");
    sidebar.setAttribute("data-sidebar-root", "");
    const dialog = document.createElement("div");
    dialog.setAttribute("data-slot", "dialog-content");

    expect(shouldHandleGridKeys(topBar, false)).toBe(true);
    expect(shouldHandleGridKeys(sidebar, false)).toBe(false);
    expect(shouldHandleGridKeys(dialog, false)).toBe(false);
    expect(shouldHandleGridKeys(sidebar, true)).toBe(true);
  });
});
