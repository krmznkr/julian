import { spawnSync } from "node:child_process";

for (const TZ of [
  "UTC",
  "America/Los_Angeles",
  "Europe/Paris",
  "Pacific/Auckland",
  "Africa/Casablanca",
]) {
  console.log(`Date checks in ${TZ}`);
  const result = spawnSync(
    "bun",
    [
      "run",
      "--cwd",
      "packages/domain",
      "vitest",
      "run",
      "src/date.test.ts",
      "src/events.test.ts",
      "src/year-grid.test.ts",
      "src/event-boundaries.test.ts",
    ],
    {
      stdio: "inherit",
      env: { ...process.env, TZ },
    },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
}
