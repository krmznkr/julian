import path from "node:path";
import { defineConfig } from "vitest/config";
import { buildDefines } from "./build-defines";

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
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: [root("src/test/setup-dom.ts")],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: [
        "**/*.test.ts",
        "**/*.test.tsx",
        "**/*.d.ts",
        "**/node_modules/**",
        "src/test/**",
        // Entry point: mounts the router into #root; exercised only by the e2e suite.
        "src/main.tsx",
        // Vendored shadcn/ui primitives (see components.json), thin wrappers over
        // Radix and cmdk that are tested upstream.
        "src/components/ui/**",
      ],
      // Set just under the current numbers so a drop fails the build. They were
      // previously below actual coverage, which made the gate unable to detect
      // any regression at all.
      thresholds: {
        lines: 91,
        functions: 87,
        branches: 78,
        statements: 89,
      },
    },
  },
});
