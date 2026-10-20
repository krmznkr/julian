import type { Page } from "@playwright/test";
import { expect, test, yearGrid } from "./fixtures";

type Numeral = {
  where: "cell" | "gutter";
  label: string;
  state: "today" | "focused" | "weekend" | "weekday";
  ratio: number;
};

/**
 * Measures the day numbers as the browser paints them: the computed text
 * colour, alpha included, composited in a canvas over every background painted
 * beneath it. The stack comes from hit-testing the numeral's centre, so
 * numbers hidden under an event chip, a sticky header, or the viewport edge
 * are skipped rather than measured against the wrong background.
 */
function measureDayNumbers(page: Page): Promise<Numeral[]> {
  return page.evaluate(() => {
    // The numbers and day frames ignore pointer events, which also hides them
    // from hit-testing. Re-enable them only while measuring.
    const probe = document.createElement("style");
    probe.textContent = ".year-grid, .year-grid * { pointer-events: auto !important; }";
    document.head.append(probe);

    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("No 2D canvas context");
    const paint = (color: string, alpha: number) => {
      context.globalAlpha = alpha;
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      context.globalAlpha = 1;
    };
    const read = () => Array.from(context.getImageData(0, 0, 1, 1).data.slice(0, 3));
    const luminance = (rgb: number[]) => {
      const [r = 0, g = 0, b = 0] = rgb.map((value) => {
        const channel = value / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const opacity = (element: Element) => {
      let value = 1;
      for (let node: Element | null = element; node; node = node.parentElement) {
        value *= Number(getComputedStyle(node).opacity);
      }
      return value;
    };
    const transparent = "rgba(0, 0, 0, 0)";
    const paintsOver = (element: Element) =>
      getComputedStyle(element).backgroundColor !== transparent ||
      Array.from(element.childNodes).some(
        (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
      );

    const numerals = document.querySelectorAll<HTMLElement>(
      "[data-day-cell-frame] > span:not(:empty), .year-grid-text-day > span:not(:empty)",
    );
    const results = Array.from(numerals).flatMap((numeral): Numeral[] => {
      const rect = numeral.getBoundingClientRect();
      const stack = document.elementsFromPoint(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
      );
      const index = stack.indexOf(numeral);
      if (index < 0 || stack.slice(0, index).some(paintsOver)) return [];

      context.clearRect(0, 0, 1, 1);
      paint("#ffffff", 1);
      stack
        .slice(index)
        .reverse()
        .forEach((element) => {
          const background = getComputedStyle(element).backgroundColor;
          if (background !== transparent) paint(background, opacity(element));
        });
      const background = read();
      paint(getComputedStyle(numeral).color, opacity(numeral));
      const foreground = read();
      const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);

      const frame = numeral.parentElement;
      const gutter = frame?.classList.contains("year-grid-text-day") ?? false;
      const classes = `${frame?.className ?? ""} ${numeral.className}`;
      const state = classes.includes("ring-2")
        ? "focused"
        : classes.includes("accent-brand")
          ? "today"
          : classes.includes("bg-muted")
            ? "weekend"
            : "weekday";
      const month = frame?.closest("[data-month-column]")?.getAttribute("data-month-column");
      return [
        {
          where: gutter ? "gutter" : "cell",
          label: gutter ? `gutter ${numeral.textContent}` : `${month}/${numeral.textContent}`,
          state,
          ratio: ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05),
        },
      ];
    });
    probe.remove();
    return results;
  });
}

async function expectReadableDayNumbers(
  page: Page,
  expected: Numeral["state"][],
  { todayIn = [] as Numeral["where"][] } = {},
) {
  await page.waitForFunction(() =>
    document.getAnimations().every((animation) => animation.playState !== "running"),
  );
  const numerals = await measureDayNumbers(page);
  // Guard against a vacuous pass: every state under test was actually painted.
  for (const state of expected) {
    expect(
      numerals.some((numeral) => numeral.state === state),
      state,
    ).toBe(true);
  }
  for (const where of todayIn) {
    expect(
      numerals.some((numeral) => numeral.state === "today" && numeral.where === where),
      `today in the ${where}`,
    ).toBe(true);
  }
  const unreadable = numerals
    .filter((numeral) => numeral.ratio < 4.5)
    .map(({ where, label, state, ratio }) => `${where} ${label} (${state}) ${ratio.toFixed(2)}:1`);
  expect(unreadable).toEqual([]);
}

for (const colorScheme of ["light", "dark"] as const) {
  test(`day numbers reach 4.5:1 on every background (${colorScheme})`, async ({ demo: page }) => {
    await page.emulateMedia({ colorScheme });
    const html = expect(page.locator("html"));
    await (colorScheme === "dark"
      ? html.toHaveClass(/\bdark\b/)
      : html.not.toHaveClass(/\bdark\b/));
    const grid = yearGrid(page);

    // Plain and weekend rows, with today focused under its events.
    await expectReadableDayNumbers(page, ["weekday", "weekend"]);

    // Keyboard focus on a weekend: Mar 14, 2026 is a Saturday.
    for (let step = 0; step < 4; step++) await page.keyboard.press("ArrowDown");
    await expectReadableDayNumbers(page, ["weekday", "weekend", "focused"]);

    // Hide every calendar so no chip covers today's number, then move focus
    // off today so its own colour shows in both the cell and the day gutter.
    await hideCalendars(page);
    await grid.focus();
    await expectReadableDayNumbers(page, ["weekday", "weekend", "focused", "today"], {
      todayIn: ["cell", "gutter"],
    });
  });

  test(`day numbers reach 4.5:1 when printed from the ${colorScheme} theme`, async ({
    demo: page,
  }) => {
    await page.emulateMedia({ colorScheme });
    // Same setup as on screen: no chips over today, focus moved off today.
    for (let step = 0; step < 4; step++) await page.keyboard.press("ArrowDown");
    await hideCalendars(page);
    await yearGrid(page).focus();

    // Printing keeps the theme class but paints on white paper.
    await page.emulateMedia({ colorScheme, media: "print" });
    await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
    await expectReadableDayNumbers(page, ["weekday", "weekend", "today"], {
      todayIn: ["cell", "gutter"],
    });
  });
}

async function hideCalendars(page: Page) {
  const shown = page.getByRole("checkbox", { checked: true });
  while ((await shown.count()) > 0) await shown.first().uncheck();
  await expect(shown).toHaveCount(0);
}
