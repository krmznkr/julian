import path from "node:path";
import { defineConfig, type Plugin } from "vite";
import { currentBuildInfo } from "@julian/release/node";
import { renderPartials } from "./src/partials.ts";

const info = currentBuildInfo();

const page = (name: string) => path.resolve(import.meta.dirname, `${name}.html`);

const partials = (): Plugin => ({
  name: "julian:marketing-partials",
  transformIndexHtml: { order: "pre", handler: renderPartials },
});

// The build is copied into the web app's dist (see apps/web/vite.config.ts), so
// its assets live under their own directory and the pages are `<name>.html`,
// which Workers static assets serve at `/<name>`.
export default defineConfig({
  plugins: [partials()],
  define: {
    __APP_CHANNEL__: JSON.stringify(info.channel),
    __APP_COMMIT__: JSON.stringify(info.commit),
  },
  publicDir: false,
  build: {
    sourcemap: process.env.JULIAN_SOURCEMAPS === "true" ? "hidden" : false,
    assetsDir: "_marketing",
    rolldownOptions: {
      input: { home: page("home"), privacy: page("privacy"), terms: page("terms") },
    },
  },
  server: { host: "127.0.0.1", port: 3001, strictPort: true },
});
