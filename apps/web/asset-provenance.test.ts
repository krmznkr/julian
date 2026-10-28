// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { build, type Manifest, type Plugin } from "vite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  bundlerOnlyAssetDirs,
  manifestFiles,
  reservedPublicDirs,
  unemittedScriptsAndStyles,
} from "./asset-provenance.ts";

let root: string;

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "julian-asset-provenance-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

const write = (file: string, content = "") => {
  const target = path.join(root, file);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, content);
};

// The marketing build's manifest as Vite writes it (apps/marketing).
const marketingManifest: Manifest = {
  "../../packages/observability/src/browser.ts": {
    file: "_marketing/browser-eJafZdG_.js",
    name: "browser",
    src: "../../packages/observability/src/browser.ts",
    isDynamicEntry: true,
    imports: ["_observability-miiFSapg.js"],
  },
  "_observability-DN_rWpjU.css": {
    file: "_marketing/observability-DN_rWpjU.css",
    src: "_observability-DN_rWpjU.css",
  },
  "_observability-miiFSapg.js": {
    file: "_marketing/observability-miiFSapg.js",
    name: "observability",
    dynamicImports: ["../../packages/observability/src/browser.ts"],
    css: ["_marketing/observability-DN_rWpjU.css"],
    assets: ["_marketing/logo-a1b2c3d4.svg"],
  },
};

// A second build's output plus its manifest, like apps/marketing/dist.
const writeMarketingBuild = (extraFiles: readonly string[] = []) => {
  write("marketing/.vite/manifest.json", JSON.stringify(marketingManifest));
  [...manifestFiles(marketingManifest), "home.html", ...extraFiles].forEach((file) =>
    write(path.join("marketing", file), "/* built */"),
  );
  return path.join(root, "marketing/.vite/manifest.json");
};

// Stands in for the marketing copy step and any other late writer: copies
// files into the output after the bundle is written.
const writeAfterBundle = (files: Readonly<Record<string, string>>): Plugin => ({
  name: "test:write-after-bundle",
  writeBundle(options) {
    Object.entries(files).forEach(([file, from]) => {
      const target = path.join(options.dir ?? "", file);
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, from);
    });
  },
});

// A small app shaped like apps/web: one page, a script and a stylesheet,
// bundled to `assets/<name>-<hash>.js|css`.
const buildApp = (
  options: { copiedManifests?: readonly string[]; plugins?: Plugin[]; publicDir?: false } = {},
) => {
  write("index.html", '<!doctype html><script type="module" src="./main.js"></script>');
  write("main.js", 'import "./style.css";\ndocument.title = "fixture";\n');
  write("style.css", "body { color: red; }\n");
  return build({
    root,
    configFile: false,
    logLevel: "silent",
    publicDir: options.publicDir,
    plugins: [
      bundlerOnlyAssetDirs({ copiedManifests: options.copiedManifests ?? [] }),
      ...(options.plugins ?? []),
    ],
  });
};

describe("reservedPublicDirs", () => {
  it("is empty when public/ has neither reserved directory", () => {
    write("public/favicon.ico");
    write("public/bootstrap.js");

    expect(reservedPublicDirs(path.join(root, "public"))).toEqual([]);
  });

  it.each([
    [["assets"], ["assets"]],
    [["_marketing"], ["_marketing"]],
    [
      ["assets", "_marketing"],
      ["assets", "_marketing"],
    ],
  ])("finds %j", (dirs, expected) => {
    dirs.forEach((dir) => mkdirSync(path.join(root, "public", dir), { recursive: true }));

    expect(reservedPublicDirs(path.join(root, "public"))).toEqual(expected);
  });
});

describe("manifestFiles", () => {
  it("lists every script, stylesheet and asset a manifest names", () => {
    expect(new Set(manifestFiles(marketingManifest))).toEqual(
      new Set([
        "_marketing/browser-eJafZdG_.js",
        "_marketing/observability-DN_rWpjU.css",
        "_marketing/observability-miiFSapg.js",
        "_marketing/logo-a1b2c3d4.svg",
      ]),
    );
  });
});

describe("unemittedScriptsAndStyles", () => {
  it("is empty when every script and stylesheet was emitted", () => {
    write("dist/assets/index-AbCd1234.js");
    write("dist/assets/index-AbCd1234.css");
    write("dist/_marketing/home-EfGh5678.js");

    expect(
      unemittedScriptsAndStyles(
        path.join(root, "dist"),
        new Set([
          "assets/index-AbCd1234.js",
          "assets/index-AbCd1234.css",
          "_marketing/home-EfGh5678.js",
        ]),
      ),
    ).toEqual([]);
  });

  it("is empty when neither reserved directory exists", () => {
    write("dist/index.html");

    expect(unemittedScriptsAndStyles(path.join(root, "dist"), new Set())).toEqual([]);
  });

  it("names planted scripts and stylesheets, nested ones and symlinks included", () => {
    write("dist/assets/index-AbCd1234.js");
    write("dist/assets/planted-12345678.js");
    write("dist/_marketing/planted-ABCDEFGH.css");
    write("dist/_marketing/nested/deep-12345678.js");
    symlinkSync(
      path.join(root, "dist/assets/index-AbCd1234.js"),
      path.join(root, "dist/assets/linked-87654321.js"),
    );

    expect(
      unemittedScriptsAndStyles(path.join(root, "dist"), new Set(["assets/index-AbCd1234.js"])),
    ).toEqual([
      "_marketing/nested/deep-12345678.js",
      "_marketing/planted-ABCDEFGH.css",
      "assets/linked-87654321.js",
      "assets/planted-12345678.js",
    ]);
  });

  it("ignores other file types and files outside the reserved directories", () => {
    write("dist/assets/font-12345678.woff2");
    write("dist/assets/index-AbCd1234.js.map");
    write("dist/bootstrap.js");
    write("dist/other/planted-12345678.js");

    expect(unemittedScriptsAndStyles(path.join(root, "dist"), new Set())).toEqual([]);
  });
});

describe("bundlerOnlyAssetDirs", () => {
  it("passes a build whose reserved directories hold only bundler output", async () => {
    write("public/favicon.ico");

    await expect(buildApp()).resolves.toBeDefined();
  });

  it.each(["assets", "_marketing"])("fails the build when public/%s exists", async (dir) => {
    write(`public/${dir}/app-12345678.js`);

    await expect(buildApp()).rejects.toThrow(`public/${dir} is reserved for hashed build output.`);
  });

  it("names both reserved directories when public/ has both", async () => {
    write("public/assets/app-12345678.js");
    write("public/_marketing/home-12345678.css");

    await expect(buildApp()).rejects.toThrow(
      "public/assets, public/_marketing is reserved for hashed build output.",
    );
  });

  it("skips the public/ check when the build has no public directory", async () => {
    await expect(buildApp({ publicDir: false })).resolves.toBeDefined();
  });

  it("passes a copied build whose files its manifest lists", async () => {
    const manifest = writeMarketingBuild();
    const copy = Object.fromEntries(
      manifestFiles(marketingManifest).map((file) => [file, "/* built */"]),
    );

    await expect(
      buildApp({ copiedManifests: [manifest], plugins: [writeAfterBundle(copy)] }),
    ).resolves.toBeDefined();
  });

  it("fails the build when a copy adds a hashed-looking file no manifest lists", async () => {
    const manifest = writeMarketingBuild(["_marketing/planted-12345678.js"]);
    const copy = Object.fromEntries(
      [...manifestFiles(marketingManifest), "_marketing/planted-12345678.js"].map((file) => [
        file,
        "/* copied */",
      ]),
    );

    await expect(
      buildApp({ copiedManifests: [manifest], plugins: [writeAfterBundle(copy)] }),
    ).rejects.toThrow("_marketing/planted-12345678.js was not emitted by a bundler.");
  });

  it("fails the build when a later plugin writes a script into assets/", async () => {
    const late = writeAfterBundle({ "assets/late-AbCdEfGh.js": "console.log('late')" });

    await expect(buildApp({ plugins: [late] })).rejects.toThrow(
      "assets/late-AbCdEfGh.js was not emitted by a bundler.",
    );
  });

  it("fails the build when a copied build's manifest is missing", async () => {
    const missing = path.join(root, "marketing/.vite/manifest.json");

    await expect(buildApp({ copiedManifests: [missing] })).rejects.toThrow(
      `${missing} is missing, so the copied build cannot be checked.`,
    );
  });
});
