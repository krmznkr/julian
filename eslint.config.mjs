import functional from "eslint-plugin-functional";
import tsParser from "@typescript-eslint/parser";

export default [
  {
    ignores: ["**/node_modules/**", "**/dist/**", "**/build/**", "**/out/**", "coverage/**"],
  },
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    ignores: ["**/node_modules/**", "**/dist/**", "**/build/**"],
    plugins: { functional },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "functional/no-let": "error",
      "functional/no-loop-statements": "error",
      "functional/no-classes": "error",
      "functional/immutable-data": "error",
    },
  },
  {
    files: ["**/*.test.ts", "**/*.test.tsx"],
    rules: {
      "functional/no-let": "off",
      "functional/no-loop-statements": "off",
      "functional/immutable-data": "off",
      "functional/no-expression-statements": "off",
    },
  },
  {
    // Effect's tagged errors are defined via `Data.TaggedError`, which requires
    // the `class extends` syntax. The boundary `AppErrorLike` (a plain `Error`
    // subclass carrying `_tag`/`status`) lives alongside them. This is the
    // library's idiomatic pattern.
    // Effect requires `class extends` for two of its core declaration forms:
    // tagged errors (`Schema.TaggedErrorClass`) and service keys
    // (`Context.Service`). Both are declaration syntax rather than OO design —
    // no inheritance, no mutable instance state, no methods on the class — so
    // the rule is disabled for the Effect layer only, not the app at large.
    files: ["src/lib/effect/*.ts"],
    rules: {
      "functional/no-classes": "off",
    },
  },
];
