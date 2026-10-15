// Injected at build time by Vite `define` (see vite.config.ts and @julian/release).
export const BUILD_INFO = {
  version: __APP_VERSION__,
  channel: __APP_CHANNEL__,
  commit: __APP_COMMIT__,
} as const;

export const buildLabel = ({ version, channel }: typeof BUILD_INFO): string =>
  channel === "stable" ? `v${version}` : `v${version} (${channel})`;
