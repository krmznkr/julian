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
    "pnpm",
    [
      "exec",
      "vitest",
      "run",
      "src/domain/date.test.ts",
      "src/domain/events.test.ts",
      "src/domain/year-grid.test.ts",
      "src/domain/event-boundaries.test.ts",
    ],
    {
      stdio: "inherit",
      env: { ...process.env, TZ },
    },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
}
