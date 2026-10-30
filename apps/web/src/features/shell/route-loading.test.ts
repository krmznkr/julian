import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { CALENDAR_LOADING_LABEL, ROUTE_LOADING_CLASS, RouteLoading } from "./route-loading";

const shellHtml = readFileSync(path.resolve(import.meta.dirname, "../../../index.html"), "utf8");
const shell = new DOMParser().parseFromString(shellHtml, "text/html");

afterEach(cleanup);

it("paints the calendar loading screen in #root before any script runs", () => {
  const main = shell.querySelector("#root > main");
  expect(main?.className).toBe(ROUTE_LOADING_CLASS);
  expect(main?.querySelector("[data-boot-loading]")?.textContent).toBe(CALENDAR_LOADING_LABEL);
});

it("matches what RouteLoading renders once React takes over", () => {
  const { container } = render(createElement(RouteLoading, { label: CALENDAR_LOADING_LABEL }));
  const main = container.querySelector("main");
  expect(main?.className).toBe(ROUTE_LOADING_CLASS);
  expect(main?.textContent).toBe(CALENDAR_LOADING_LABEL);
});

it("tells visitors without JavaScript why the calendar never loads", () => {
  expect(shell.querySelector("#root noscript")?.textContent).toMatch(/needs JavaScript/);
  // Without scripts the loading text would wait forever, so it is hidden.
  expect(shell.querySelector("head noscript")?.textContent).toContain(
    "[data-boot-loading]{display:none}",
  );
});
