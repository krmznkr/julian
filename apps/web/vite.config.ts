import { existsSync } from "node:fs";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { currentBuildInfo } from "@julian/release/node";
import { siteOrigin, withShareMeta, withTitle } from "@julian/release/share";
import { renderHeadersFile } from "@julian/security";
import { bundlerOnlyAssetDirs, copyBuildOutput } from "./asset-provenance.ts";
import { buildDefines } from "./build-defines.ts";

const resolvePath = (...parts: string[]) => path.resolve(import.meta.dirname, ...parts);

const securityHeadersFile = (): Plugin => ({
  name: "julian:security-headers",
  apply: "build",
  generateBundle() {
    this.emitFile({ type: "asset", fileName: "_headers", source: renderHeadersFile() });
  },
});

const marketingDist = resolvePath("../marketing/dist");

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
// same assets directory, so the Worker serves both from one binding. Its
// manifest (`.vite/`) is not deployed: `copyBuildOutput` copies only the scripts
// and stylesheets it lists, and `bundlerOnlyAssetDirs` reads it, with the
// original files, to check every copied one.
const marketingPages = (): Plugin => ({
  name: "julian:marketing-pages",
  apply: "build",
  writeBundle(options) {
    if (!existsSync(marketingDist)) {
      this.error("apps/marketing/dist is missing: build @julian/marketing first.");
    }
    copyBuildOutput(marketingDist, options.dir ?? resolvePath("dist"));
  },
});

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Checks the output after every other plugin has written (see its docs).
    bundlerOnlyAssetDirs({ copiedBuilds: [marketingDist] }),
    securityHeadersFile(),
    sharePreviews(),
    marketingPages(),
  ],
  define: buildDefines,
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
          if (id.includes("@sentry") || id.includes("posthog")) return "observability";
          if (id.includes("react-dom") || id.match(/[\\/]react[\\/]/)) return "react";
          if (id.includes("@tanstack")) return "tanstack";
          if (id.includes("radix-ui") || id.includes("@radix-ui")) return "radix";
          if (id.includes("lucide-react")) return "icons";
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
