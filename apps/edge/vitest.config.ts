import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.ts"],
      exclude: ["**/*.test.ts"],
      // Just under current numbers so a drop fails CI.
      thresholds: { lines: 96, functions: 92, branches: 92, statements: 95 },
    },
  },
});
