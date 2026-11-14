import path from "node:path";
import { defineConfig } from "vitest/config";
import { buildDefines } from "./build-defines.ts";

const root = (...parts: string[]) => path.resolve(import.meta.dirname, ...parts);

export default defineConfig({
  define: buildDefines,
  resolve: {
    alias: {
      "@": root("src"),
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
    setupFiles: [root("src/test/setup-dom.ts")],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.ts"],
      exclude: [
        "**/*.test.ts",
        "**/*.d.ts",
        "**/node_modules/**",
        "src/test/**",
        // Entry point: mounts the Foldkit program into #root; exercised only by the e2e suite.
        "src/main.ts",
        "src/foldkit/entry.ts",
      ],
      // Set just under the current numbers so a drop fails the build. They were
      // previously below actual coverage, which made the gate unable to detect
      // any regression at all.
      thresholds: {
        lines: 95,
        functions: 93,
        branches: 84,
        statements: 93,
      },
    },
  },
});
