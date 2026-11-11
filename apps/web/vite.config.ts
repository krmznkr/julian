import { cpSync, existsSync } from "node:fs";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vite";
import { currentBuildInfo } from "@julian/release/node";
import { siteOrigin, withShareMeta, withTitle } from "@julian/release/share";
import { renderHeadersFile } from "@julian/security";
import { buildDefines } from "./build-defines.ts";

const resolvePath = (...parts: string[]) => path.resolve(import.meta.dirname, ...parts);

const securityHeadersFile = (): Plugin => ({
  name: "julian:security-headers",
  apply: "build",
  generateBundle() {
    this.emitFile({ type: "asset", fileName: "_headers", source: renderHeadersFile() });
  },
});

// The Worker caches `<name>-<hash>.js|css` under `/assets/` and `/_marketing/`
// for a year (apps/edge/src/cache.ts). Only the bundler may write there, so a
// hand-placed public file can never be served as immutable.
const bundlerOnlyAssetDirs = (): Plugin => ({
  name: "julian:bundler-only-asset-dirs",
  apply: "build",
  buildStart() {
    const taken = ["assets", "_marketing"].filter((dir) => existsSync(resolvePath("public", dir)));
    if (taken.length > 0) {
      this.error(`apps/web/public/${taken.join(", ")} is reserved for hashed build output.`);
    }
  },
});

const DEMO_TITLE = "Julian demo · Your whole year on one screen";

// Link-preview tags for the app shell, plus `demo.html`: the same shell under
// its own title, which static assets serve at `/demo` as they serve `home.html`
// at `/home`. The Worker (apps/edge/src/site.ts) also serves it for deeper demo
// routes such as `/demo/2026`, so a copied demo link keeps the demo's tags.
const sharePreviews = (): Plugin => ({
  name: "julian:share-previews",
  apply: "build",
  enforce: "post",
  generateBundle(_, bundle) {
    const index = bundle["index.html"];
    if (index?.type !== "asset" || typeof index.source !== "string") {
      return this.error("index.html is missing from the bundle.");
    }
    const origin = siteOrigin(currentBuildInfo().channel);
    this.emitFile({
      type: "asset",
      fileName: "demo.html",
      source: withShareMeta(withTitle(index.source, DEMO_TITLE), { origin, path: "/demo" }),
    });
    index.source = withShareMeta(index.source, { origin });
  },
});

// The marketing pages (@julian/marketing, built first by Turborepo) ship in the
// same assets directory, so the Worker serves both from one binding.
const marketingPages = (): Plugin => ({
  name: "julian:marketing-pages",
  apply: "build",
  writeBundle(options) {
    const source = resolvePath("../marketing/dist");
    if (!existsSync(source)) {
      this.error("apps/marketing/dist is missing: build @julian/marketing first.");
    }
    cpSync(source, options.dir ?? resolvePath("dist"), { recursive: true });
  },
});

export default defineConfig({
  plugins: [
    tailwindcss(),
    bundlerOnlyAssetDirs(),
    securityHeadersFile(),
    sharePreviews(),
    marketingPages(),
  ],
  define: buildDefines,
  // Foldkit's hot-reload bridge serializes the Model to the dev server.
  // Calendar state must stay in the browser, including during development.
  optimizeDeps: {
    rolldownOptions: { transform: { define: { "import.meta.hot": "undefined" } } },
  },
  envDir: resolvePath("../.."),
  envPrefix: ["VITE_"],
  resolve: {
    alias: {
      "@": resolvePath("./src"),
    },
  },
  build: {
    sourcemap: process.env.JULIAN_SOURCEMAPS === "true" ? "hidden" : false,
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          // Keep the Effect services and Foldkit renderer in separate chunks.
          if (id.match(/[\\/]effect[\\/]/) || id.includes("@effect/")) return "effect";
          if (id.includes("foldkit")) return "foldkit";
          if (id.includes("@sentry") || id.includes("posthog")) return "observability";
          return "vendor";
        },
      },
    },
  },
  server: {
    host: "127.0.0.1",
    port: 3000,
    strictPort: true,
    hmr: {
      host: "127.0.0.1",
      port: 3000,
    },
  },
});
