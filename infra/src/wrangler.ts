import {
  ASSETS_DIRECTORY,
  COMPATIBILITY_DATE,
  GOOGLE_CLIENT_ID,
  RATE_LIMITS,
  WORKERS,
  type Channel,
} from "./config.ts";

export const WRANGLER_CONFIG_PATH = "apps/edge/wrangler.jsonc";

const HEADER = `// Generated from infra/src/config.ts by \`bun run --cwd infra wrangler:generate\`.
// Do not edit by hand: change infra/src/config.ts and regenerate.
`;

const perWorker = (channel: Channel) => {
  const worker = WORKERS[channel];
  return {
    name: worker.name,
    preview_urls: worker.previewUrls,
    vars: {
      GOOGLE_CLIENT_ID,
      APP_VERSION: "unknown",
      APP_CHANNEL: worker.channel,
      APP_COMMIT: "unknown",
    },
    ratelimits: RATE_LIMITS.map((limit) => ({
      name: limit.binding,
      namespace_id: limit.namespaceIds[channel],
      simple: { limit: limit.limit, period: limit.period },
    })),
    routes: [{ pattern: worker.domain, custom_domain: true }],
  };
};

// Wrangler environments inherit `assets` and `main` but not vars, bindings or
// routes, so those are repeated for nightly (with its own rate-limit namespaces).
export const wranglerConfig = () => {
  const { name, preview_urls, ...stable } = perWorker("stable");
  return {
    name,
    compatibility_date: COMPATIBILITY_DATE,
    workers_dev: false,
    preview_urls,
    main: "src/index.ts",
    assets: {
      directory: ASSETS_DIRECTORY,
      html_handling: "auto-trailing-slash",
      not_found_handling: "single-page-application",
      binding: "ASSETS",
      run_worker_first: true,
    },
    ...stable,
    env: { nightly: perWorker("nightly") },
  };
};

export const renderWranglerConfig = (): string =>
  `${HEADER}${JSON.stringify(wranglerConfig(), null, 2)}\n`;
