import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderWranglerConfig, WRANGLER_CONFIG_PATH } from "../src/wrangler.ts";

const target = fileURLToPath(new URL(`../../${WRANGLER_CONFIG_PATH}`, import.meta.url));
const rendered = renderWranglerConfig();

if (process.argv.includes("--check")) {
  if (readFileSync(target, "utf8") !== rendered) {
    console.error(
      `${WRANGLER_CONFIG_PATH} is stale. Run: pnpm --filter @julian/infra wrangler:generate`,
    );
    process.exit(1);
  }
} else {
  writeFileSync(target, rendered);
}
