import {
  ASSETS_DIRECTORY,
  COMPATIBILITY_DATE,
  GOOGLE_CLIENT_ID,
  RATE_LIMITS,
  WORKERS,
  type WorkerConfig,
} from "./config.ts";

export const WRANGLER_CONFIG_PATH = "apps/edge/wrangler.jsonc";

const HEADER = `// Generated from infra/src/config.ts by \`pnpm --filter @julian/infra wrangler:generate\`.
// Do not edit by hand: change infra/src/config.ts and regenerate.
`;

const perWorker = (worker: WorkerConfig) => ({
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
    namespace_id: limit.namespaceId,
    simple: { limit: limit.limit, period: limit.period },
  })),
  routes: [{ pattern: worker.domain, custom_domain: true }],
});

// Wrangler environments inherit `assets` and `main` but not vars, bindings or
// routes, so those are repeated for nightly.
export const wranglerConfig = () => {
  const { name, preview_urls, ...stable } = perWorker(WORKERS.stable);
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
    env: { nightly: perWorker(WORKERS.nightly) },
  };
};

export const renderWranglerConfig = (): string =>
  `${HEADER}${JSON.stringify(wranglerConfig(), null, 2)}\n`;
