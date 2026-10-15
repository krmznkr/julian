import { currentBuildInfo } from "@julian/release/node";

const info = currentBuildInfo();

// Shared by vite.config.ts and vitest.config.ts so tests see the same globals.
export const buildDefines = {
  __APP_VERSION__: JSON.stringify(info.version),
  __APP_CHANNEL__: JSON.stringify(info.channel),
  __APP_COMMIT__: JSON.stringify(info.commit),
};
