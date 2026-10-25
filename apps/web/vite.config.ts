import { cpSync, existsSync } from "node:fs";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
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

const DEMO_TITLE = "Julian demo · Your whole year on one screen";

// Link-preview tags for the app shell, plus `demo.html`: the same shell under
// its own title, which static assets serve at `/demo` as they serve `home.html`
// at `/home`. Deeper demo paths still get the shell through the SPA fallback.
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
  plugins: [react(), tailwindcss(), securityHeadersFile(), sharePreviews(), marketingPages()],
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
