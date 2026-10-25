import path from "node:path";
import { defineConfig, type Plugin } from "vite";
import { currentBuildInfo } from "@julian/release/node";
import { siteOrigin, withShareMeta } from "@julian/release/share";
import { renderPartials } from "./src/partials.ts";

const info = currentBuildInfo();

const page = (name: string) => path.resolve(import.meta.dirname, `${name}.html`);

// The Worker serves the landing page at `/` (apps/edge/src/site.ts).
const publicPath = (file: string) => {
  const name = path.basename(file, ".html");
  return name === "home" ? "/" : `/${name}`;
};

// Link-preview tags first: `<!-- @share -->` is not one of the partials.
const partials = (): Plugin => ({
  name: "julian:marketing-partials",
  transformIndexHtml: {
    order: "pre",
    handler: (html, { filename }) =>
      renderPartials(
        withShareMeta(html, { origin: siteOrigin(info.channel), path: publicPath(filename) }),
      ),
  },
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
