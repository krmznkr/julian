import path from "node:path";
import { defineConfig } from "vitest/config";

const root = (...parts: string[]) => path.resolve(import.meta.dirname, ...parts);

export default defineConfig({
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
      exclude: ["**/*.test.ts", "**/*.test.tsx", "**/*.d.ts", "**/node_modules/**"],
      thresholds: {
        lines: 14,
        functions: 14,
        branches: 16,
        statements: 14,
      },
    },
  },
});
