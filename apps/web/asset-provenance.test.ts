// @vitest-environment node
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { build, type BuildEnvironmentOptions, type Manifest, type Plugin } from "vite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  bundlerOnlyAssetDirs,
  copiedBuildDigests,
  copyBuildOutput,
  digest,
  manifestFiles,
  mergeDigests,
  reservedPublicDirs,
  unprovenScriptsAndStyles,
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

// A second build's output plus its manifest, like apps/marketing/dist. Each
// file holds its own name, so a copy of the wrong file is told apart.
const writeMarketingBuild = (extraFiles: readonly string[] = []) => {
  write("marketing/.vite/manifest.json", JSON.stringify(marketingManifest));
  [...manifestFiles(marketingManifest), "home.html", ...extraFiles].forEach((file) =>
    write(path.join("marketing", file), `/* built ${file} */`),
  );
  return path.join(root, "marketing");
};

type Files = Readonly<Record<string, string>>;

const writeInto = (dir: string, files: Files) =>
  Object.entries(files).forEach(([file, content]) => {
    const target = path.join(dir, file);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, content);
  });

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Stands in for any late writer: writes files into the output from
// `writeBundle` or `closeBundle`, synchronously or after a delay.
const writeFrom = (
  hook: "writeBundle" | "closeBundle",
  files: Files | ((bundle: readonly string[]) => Files),
  mode: "sync" | "async" = "sync",
): Plugin => {
  let names: readonly string[] = [];
  const run = async () => {
    if (mode === "async") await sleep(50);
    writeInto(path.join(root, "dist"), typeof files === "function" ? files(names) : files);
  };
  return {
    name: `test:write-from-${hook}-${mode}`,
    writeBundle(_, bundle) {
      names = Object.keys(bundle);
      return hook === "writeBundle" ? run() : undefined;
    },
    closeBundle() {
      return hook === "closeBundle" ? run() : undefined;
    },
  };
};

// Copies a build into the output as apps/web/vite.config.ts copies the
// marketing pages.
const copyListed = (from: string): Plugin => ({
  name: "test:copy-listed",
  writeBundle(options) {
    copyBuildOutput(from, options.dir ?? "");
  },
});

// Copies a whole build, unlisted files included, leaving out its `.vite/`
// manifest: what the guard must catch if the copy step ever stops filtering.
const copyBuild = (from: string): Plugin => ({
  name: "test:copy-build",
  writeBundle(options) {
    cpSync(from, options.dir ?? "", {
      recursive: true,
      filter: (source) => path.basename(source) !== ".vite",
    });
  },
});

// The one emitted file in `bundle` whose name matches `pattern`.
const emittedFile = (bundle: readonly string[], pattern: RegExp) => {
  const [file] = bundle.filter((name) => pattern.test(name));
  if (!file) throw new Error(`no emitted file matches ${String(pattern)}`);
  return file;
};

const guard = (copiedBuilds: readonly string[] = []) => bundlerOnlyAssetDirs({ copiedBuilds });

// A small app shaped like apps/web: one page, a script, a lazy-loaded script
// and two stylesheets, bundled to `assets/<name>-<hash>.js|css`. `before` and
// `plugins` sit before and after the guard in the plugins array.
const buildApp = (
  options: {
    copiedBuilds?: readonly string[];
    before?: Plugin[];
    plugins?: Plugin[];
    publicDir?: false;
    build?: BuildEnvironmentOptions;
  } = {},
) => {
  write("index.html", '<!doctype html><script type="module" src="./main.js"></script>');
  write(
    "main.js",
    'import "./style.css";\nimport("./lazy.js").then((m) => m.run());\ndocument.title = "fixture";\n',
  );
  write("lazy.js", 'import "./lazy.css";\nexport const run = () => "lazy";\n');
  write("style.css", "body { color: red; }\n");
  write("lazy.css", "p { color: blue; }\n");
  return build({
    root,
    configFile: false,
    logLevel: "silent",
    publicDir: options.publicDir,
    build: options.build,
    plugins: [...(options.before ?? []), guard(options.copiedBuilds), ...(options.plugins ?? [])],
  });
};

const distFile = (file: string) => readFileSync(path.join(root, "dist", file), "utf8");

const distScripts = () =>
  readdirSync(path.join(root, "dist/assets")).filter((file) => file.endsWith(".js"));

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

describe("digest", () => {
  it("hashes strings as their UTF-8 bytes", () => {
    expect(digest("é")).toBe(digest(Buffer.from("é", "utf8")));
    expect(digest("a")).not.toBe(digest("b"));
  });
});

describe("copiedBuildDigests", () => {
  it("digests the pinned files the manifest lists, read from that build", () => {
    const outDir = writeMarketingBuild(["_marketing/unlisted-12345678.js"]);

    expect(copiedBuildDigests(outDir)).toEqual(
      new Map([
        ["_marketing/browser-eJafZdG_.js", digest("/* built _marketing/browser-eJafZdG_.js */")],
        [
          "_marketing/observability-DN_rWpjU.css",
          digest("/* built _marketing/observability-DN_rWpjU.css */"),
        ],
        [
          "_marketing/observability-miiFSapg.js",
          digest("/* built _marketing/observability-miiFSapg.js */"),
        ],
      ]),
    );
  });

  it("leaves out a listed file the build does not have", () => {
    const outDir = writeMarketingBuild();
    rmSync(path.join(outDir, "_marketing/browser-eJafZdG_.js"));

    expect([...copiedBuildDigests(outDir).keys()]).not.toContain("_marketing/browser-eJafZdG_.js");
  });
});

const toPosixPath = (file: string) => file.split(path.sep).join("/");

const filesUnder = (dir: string) =>
  readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => !entry.isDirectory())
    .map((entry) => toPosixPath(path.relative(dir, path.join(entry.parentPath, entry.name))))
    .sort();

describe("copyBuildOutput", () => {
  it("copies the listed files, their source maps and the pages, not the manifest", () => {
    const from = writeMarketingBuild([
      "_marketing/browser-eJafZdG_.js.map",
      "_marketing/observability-miiFSapg.js.map",
      "privacy.html",
    ]);

    copyBuildOutput(from, path.join(root, "out"));

    expect(filesUnder(path.join(root, "out"))).toEqual([
      "_marketing/browser-eJafZdG_.js",
      "_marketing/browser-eJafZdG_.js.map",
      "_marketing/logo-a1b2c3d4.svg",
      "_marketing/observability-DN_rWpjU.css",
      "_marketing/observability-miiFSapg.js",
      "_marketing/observability-miiFSapg.js.map",
      "home.html",
      "privacy.html",
    ]);
  });

  // A Turbo cache restore writes a build's outputs over apps/marketing/dist
  // without removing an earlier build's files.
  it("leaves out stale scripts, stylesheets and source maps the manifest does not list", () => {
    const from = writeMarketingBuild([
      "_marketing/browser-BZqGd55G.js",
      "_marketing/browser-BZqGd55G.js.map",
      "_marketing/observability-DMGK6C2U.js",
      "_marketing/observability-0ld0ld00.css",
      "_marketing/nested/stale-12345678.js",
    ]);

    copyBuildOutput(from, path.join(root, "out"));

    expect(filesUnder(path.join(root, "out"))).toEqual([
      "_marketing/browser-eJafZdG_.js",
      "_marketing/logo-a1b2c3d4.svg",
      "_marketing/observability-DN_rWpjU.css",
      "_marketing/observability-miiFSapg.js",
      "home.html",
    ]);
  });

  it("keeps other files in the reserved directories", () => {
    const from = writeMarketingBuild(["_marketing/font-12345678.woff2"]);

    copyBuildOutput(from, path.join(root, "out"));

    expect(filesUnder(path.join(root, "out"))).toContain("_marketing/font-12345678.woff2");
  });

  it("fails when the build has no manifest", () => {
    const from = path.join(root, "marketing");
    write("marketing/home.html");

    expect(() => copyBuildOutput(from, path.join(root, "out"))).toThrow(
      `${path.join(from, ".vite/manifest.json")} is missing, so the copied build cannot be checked.`,
    );
  });
});

describe("mergeDigests", () => {
  it("merges builds that agree on shared files", () => {
    expect(
      mergeDigests([
        new Map([
          ["assets/a-1.js", "x"],
          ["assets/b-2.js", "y"],
        ]),
        new Map([
          ["assets/a-1.js", "x"],
          ["_marketing/c-3.js", "z"],
        ]),
      ]),
    ).toEqual(
      new Map([
        ["assets/a-1.js", "x"],
        ["assets/b-2.js", "y"],
        ["_marketing/c-3.js", "z"],
      ]),
    );
  });

  it("rejects two builds that emit different bytes under one name", () => {
    expect(() =>
      mergeDigests([new Map([["assets/a-1.js", "x"]]), new Map([["assets/a-1.js", "y"]])]),
    ).toThrow("assets/a-1.js is emitted by two builds with different content.");
  });
});

describe("unprovenScriptsAndStyles", () => {
  const dist = () => path.join(root, "dist");

  it("is empty when every script and stylesheet is what was emitted", () => {
    write("dist/assets/index-AbCd1234.js", "js");
    write("dist/assets/index-AbCd1234.css", "css");
    write("dist/_marketing/home-EfGh5678.js", "home");

    expect(
      unprovenScriptsAndStyles(
        dist(),
        new Map([
          ["assets/index-AbCd1234.js", digest("js")],
          ["assets/index-AbCd1234.css", digest("css")],
          ["_marketing/home-EfGh5678.js", digest("home")],
        ]),
      ),
    ).toEqual({ unemitted: [], altered: [] });
  });

  it("is empty when neither reserved directory exists", () => {
    write("dist/index.html");

    expect(unprovenScriptsAndStyles(dist(), new Map())).toEqual({ unemitted: [], altered: [] });
  });

  it("names planted scripts and stylesheets, nested ones and symlinks included", () => {
    write("dist/assets/index-AbCd1234.js", "js");
    write("dist/assets/planted-12345678.js");
    write("dist/_marketing/planted-ABCDEFGH.css");
    write("dist/_marketing/nested/deep-12345678.js");
    symlinkSync(
      path.join(root, "dist/assets/index-AbCd1234.js"),
      path.join(root, "dist/assets/linked-87654321.js"),
    );

    expect(
      unprovenScriptsAndStyles(dist(), new Map([["assets/index-AbCd1234.js", digest("js")]])),
    ).toEqual({
      unemitted: [
        "_marketing/nested/deep-12345678.js",
        "_marketing/planted-ABCDEFGH.css",
        "assets/linked-87654321.js",
        "assets/planted-12345678.js",
      ],
      altered: [],
    });
  });

  it("names emitted files whose bytes changed", () => {
    write("dist/assets/index-AbCd1234.js", "rewritten");
    write("dist/assets/index-AbCd1234.css", "css");
    write("dist/_marketing/home-EfGh5678.js", "home\n");

    expect(
      unprovenScriptsAndStyles(
        dist(),
        new Map([
          ["assets/index-AbCd1234.js", digest("js")],
          ["assets/index-AbCd1234.css", digest("css")],
          ["_marketing/home-EfGh5678.js", digest("home")],
        ]),
      ),
    ).toEqual({
      unemitted: [],
      altered: ["_marketing/home-EfGh5678.js", "assets/index-AbCd1234.js"],
    });
  });

  it("ignores other file types and files outside the reserved directories", () => {
    write("dist/assets/font-12345678.woff2");
    write("dist/assets/index-AbCd1234.js.map");
    write("dist/bootstrap.js");
    write("dist/other/planted-12345678.js");

    expect(unprovenScriptsAndStyles(dist(), new Map())).toEqual({ unemitted: [], altered: [] });
  });
});

describe("bundlerOnlyAssetDirs", () => {
  it("passes a build whose reserved directories hold only bundler output", async () => {
    write("public/favicon.ico");

    await expect(buildApp()).resolves.toBeDefined();
    expect(distScripts()).toHaveLength(2);
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

  it("does not check a build that writes nothing", async () => {
    write("dist/assets/stale-12345678.js");

    await expect(buildApp({ build: { write: false } })).resolves.toBeDefined();
  });

  it("passes a copied build whose files match its manifest and its output", async () => {
    const marketing = writeMarketingBuild();

    await expect(
      buildApp({ copiedBuilds: [marketing], plugins: [copyListed(marketing)] }),
    ).resolves.toBeDefined();
    expect(distFile("_marketing/observability-miiFSapg.js")).toBe(
      "/* built _marketing/observability-miiFSapg.js */",
    );
  });

  it("passes when the copied build's directory also holds an earlier build's files", async () => {
    const marketing = writeMarketingBuild([
      "_marketing/browser-BZqGd55G.js",
      "_marketing/observability-DMGK6C2U.js",
    ]);

    await expect(
      buildApp({ copiedBuilds: [marketing], plugins: [copyListed(marketing)] }),
    ).resolves.toBeDefined();
    expect(readdirSync(path.join(root, "dist/_marketing")).sort()).toEqual([
      "browser-eJafZdG_.js",
      "logo-a1b2c3d4.svg",
      "observability-DN_rWpjU.css",
      "observability-miiFSapg.js",
    ]);
  });

  it("fails the build when a copy adds a hashed-looking file no manifest lists", async () => {
    const marketing = writeMarketingBuild(["_marketing/planted-12345678.js"]);

    await expect(
      buildApp({ copiedBuilds: [marketing], plugins: [copyBuild(marketing)] }),
    ).rejects.toThrow("_marketing/planted-12345678.js was not emitted by a bundler.");
  });

  it("fails the build when a later plugin writes a script into assets/", async () => {
    const late = writeFrom("writeBundle", { "assets/late-AbCdEfGh.js": "console.log('late')" });

    await expect(buildApp({ plugins: [late] })).rejects.toThrow(
      "assets/late-AbCdEfGh.js was not emitted by a bundler.",
    );
  });

  it("fails the build when a copied build's manifest is missing", async () => {
    const missing = path.join(root, "marketing/.vite/manifest.json");

    await expect(buildApp({ copiedBuilds: [path.join(root, "marketing")] })).rejects.toThrow(
      `${missing} is missing, so the copied build cannot be checked.`,
    );
  });

  it("leaves the error of a build that already failed alone", async () => {
    const failing: Plugin = {
      name: "test:failing-write",
      writeBundle() {
        writeInto(path.join(root, "dist"), { "assets/planted-12345678.js": "" });
        throw new Error("the copy step failed");
      },
    };

    await expect(
      buildApp({ copiedBuilds: [path.join(root, "marketing")], plugins: [failing] }),
    ).rejects.toThrow(
      /^Build failed with 1 error:\s+\[plugin test:failing-write\]\s+Error: the copy step failed\n/,
    );
  });

  // Review round 1, finding 1: the check must run after every closeBundle
  // writer, wherever it sits in the plugins array and however it writes.
  it.each([
    ["sync", "before"],
    ["async", "before"],
    ["sync", "after"],
    ["async", "after"],
  ] as const)(
    "fails the build when a %s closeBundle hook placed %s the guard plants a script",
    async (mode, place) => {
      const planter = writeFrom(
        "closeBundle",
        { "assets/planted-12345678.js": "console.log('planted')" },
        mode,
      );

      await expect(
        buildApp({ [place === "before" ? "before" : "plugins"]: [planter] }),
      ).rejects.toThrow("assets/planted-12345678.js was not emitted by a bundler.");
    },
  );

  // Review round 1, finding 2: a file with an emitted name but other bytes.
  it("fails the build when writeBundle overwrites an emitted script", async () => {
    const overwrite = writeFrom("writeBundle", (bundle) => ({
      [emittedFile(bundle, /^assets\/index-.*\.js$/)]: "console.log('unrelated')",
    }));

    await expect(buildApp({ plugins: [overwrite] })).rejects.toThrow(
      /^assets\/index-[\w-]+\.js differs from what the bundler emitted\./,
    );
  });

  it.each(["before", "after"] as const)(
    "fails the build when an async closeBundle hook placed %s the guard overwrites a stylesheet",
    async (place) => {
      const overwrite = writeFrom(
        "closeBundle",
        (bundle) => ({ [emittedFile(bundle, /^assets\/lazy-.*\.css$/)]: "p { color: red; }" }),
        "async",
      );

      await expect(
        buildApp({ [place === "before" ? "before" : "plugins"]: [overwrite] }),
      ).rejects.toThrow(/^assets\/lazy-[\w-]+\.css differs from what the bundler emitted\./);
    },
  );

  it("fails the build when a copied script differs from the copied build's own file", async () => {
    const marketing = writeMarketingBuild();
    const overwrite = writeFrom("writeBundle", {
      "_marketing/observability-miiFSapg.js": "console.log('unrelated')",
    });

    await expect(
      buildApp({ copiedBuilds: [marketing], plugins: [copyBuild(marketing), overwrite] }),
    ).rejects.toThrow(
      "_marketing/observability-miiFSapg.js differs from what the bundler emitted.",
    );
  });

  it("fails the build when a copied stylesheet is overwritten after the copy", async () => {
    const marketing = writeMarketingBuild();
    const overwrite = writeFrom(
      "closeBundle",
      { "_marketing/observability-DN_rWpjU.css": "body { color: red; }" },
      "async",
    );

    await expect(
      buildApp({ copiedBuilds: [marketing], plugins: [copyBuild(marketing), overwrite] }),
    ).rejects.toThrow(
      "_marketing/observability-DN_rWpjU.css differs from what the bundler emitted.",
    );
  });

  it("names unemitted and altered files together", async () => {
    const both = writeFrom("writeBundle", (bundle) => ({
      [emittedFile(bundle, /^assets\/index-.*\.js$/)]: "console.log('unrelated')",
      "assets/planted-12345678.js": "console.log('planted')",
    }));

    await expect(buildApp({ plugins: [both] })).rejects.toThrow(
      /^assets\/planted-12345678\.js was not emitted by a bundler\. assets\/index-[\w-]+\.js differs from what the bundler emitted\. The Worker caches/,
    );
  });

  // JULIAN_SOURCEMAPS=true builds with "hidden" maps; `true` is the case that
  // adds a sourceMappingURL comment to each script.
  it.each([
    [false, false],
    [true, true],
    ["hidden", false],
  ] as const)(
    "matches emitted scripts with sourcemap %s (comment: %s) and ignores the maps",
    async (sourcemap, comment) => {
      const editMaps = writeFrom("writeBundle", (bundle) =>
        Object.fromEntries(
          bundle.filter((file) => file.endsWith(".map")).map((file) => [file, "{}"]),
        ),
      );

      await expect(buildApp({ build: { sourcemap }, plugins: [editMaps] })).resolves.toBeDefined();
      const scripts = distScripts();
      expect(scripts).toHaveLength(2);
      scripts.forEach((file) => {
        expect(distFile(`assets/${file}`).includes("//# sourceMappingURL=")).toBe(comment);
      });
    },
  );

  it("fails the build when a script with a sourceMappingURL comment is overwritten", async () => {
    const overwrite = writeFrom("writeBundle", (bundle) => {
      const file = emittedFile(bundle, /^assets\/lazy-.*\.js$/);
      const code = readFileSync(path.join(root, "dist", file), "utf8");
      return { [file]: code.replace(/\/\/# sourceMappingURL=.*$/, "") };
    });

    await expect(buildApp({ build: { sourcemap: true }, plugins: [overwrite] })).rejects.toThrow(
      /^assets\/lazy-[\w-]+\.js differs from what the bundler emitted\./,
    );
  });
});
