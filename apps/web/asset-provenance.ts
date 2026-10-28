import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Manifest, Plugin, Rolldown } from "vite";

// The Worker caches `<name>-<hash>.js|css` under `/assets/` and `/_marketing/`
// for a year (apps/edge/src/cache.ts). That is only safe if every script and
// stylesheet there holds exactly what a bundler emitted: a hand-placed or
// rewritten file would be pinned in browsers with no way to update it.
const BUNDLER_ONLY_DIRS = ["assets", "_marketing"];

const SCRIPT_OR_STYLE = /\.(?:js|css)$/;

const toPosix = (file: string) => file.split(path.sep).join("/");

/** Whether `file`, relative to an output directory, is a script or stylesheet the Worker pins. */
const isPinned = (file: string) =>
  SCRIPT_OR_STYLE.test(file) && BUNDLER_ONLY_DIRS.some((dir) => file.startsWith(`${dir}/`));

/** SHA-256 of a file's bytes; strings count as UTF-8, as the bundler writes them. */
export const digest = (content: string | Uint8Array): string =>
  createHash("sha256").update(content).digest("hex");

/** Reserved directories that `publicDir` would copy into the build unchanged. */
export const reservedPublicDirs = (publicDir: string): readonly string[] =>
  BUNDLER_ONLY_DIRS.filter((dir) => existsSync(path.join(publicDir, dir)));

/** Every file a Vite manifest names, relative to that build's output directory. */
export const manifestFiles = (manifest: Manifest): readonly string[] =>
  Object.values(manifest).flatMap((chunk) => [
    chunk.file,
    ...(chunk.css ?? []),
    ...(chunk.assets ?? []),
  ]);

type Digests = ReadonlyMap<string, string>;

/** The digest of every pinned script and stylesheet in a bundle, as it will be written. */
const bundleDigests = (bundle: Rolldown.OutputBundle): Digests =>
  new Map(
    Object.values(bundle)
      .filter((output) => isPinned(output.fileName))
      .map((output) => [
        output.fileName,
        digest(output.type === "chunk" ? output.code : output.source),
      ]),
  );

const manifestPath = (outDir: string) => path.join(outDir, ".vite/manifest.json");

/**
 * The digest of every pinned script and stylesheet that the manifest of the
 * build in `outDir` lists, read from that build's own output. A listed file
 * that is not there gets no digest, so a copy of it would count as unemitted.
 */
export const copiedBuildDigests = (outDir: string): Digests => {
  const manifest = JSON.parse(readFileSync(manifestPath(outDir), "utf8")) as Manifest;
  return new Map(
    manifestFiles(manifest)
      .filter((file) => isPinned(file) && existsSync(path.join(outDir, file)))
      .map((file) => [file, digest(readFileSync(path.join(outDir, file)))]),
  );
};

/** Merges digests from several builds. Two builds may not emit different bytes under one name. */
export const mergeDigests = (sources: readonly Digests[]): Digests => {
  const merged = new Map<string, string>();
  sources.forEach((source) =>
    source.forEach((hash, file) => {
      const known = merged.get(file);
      if (known !== undefined && known !== hash) {
        throw new Error(`${file} is emitted by two builds with different content.`);
      }
      merged.set(file, hash);
    }),
  );
  return merged;
};

/**
 * Scripts and stylesheets under a reserved directory of `outDir` that no
 * bundler emitted, and those whose bytes differ from what it emitted. Anything
 * that is not a directory counts, symlinks included (their target is read).
 */
export const unprovenScriptsAndStyles = (
  outDir: string,
  emitted: Digests,
): { readonly unemitted: readonly string[]; readonly altered: readonly string[] } => {
  const files = BUNDLER_ONLY_DIRS.filter((dir) => existsSync(path.join(outDir, dir)))
    .flatMap((dir) => readdirSync(path.join(outDir, dir), { recursive: true, withFileTypes: true }))
    .filter((entry) => !entry.isDirectory() && SCRIPT_OR_STYLE.test(entry.name))
    .map((entry) => toPosix(path.relative(outDir, path.join(entry.parentPath, entry.name))))
    .sort();
  return {
    unemitted: files.filter((file) => !emitted.has(file)),
    altered: files.filter(
      (file) =>
        emitted.has(file) && emitted.get(file) !== digest(readFileSync(path.join(outDir, file))),
    ),
  };
};

const CACHE_NOTE =
  "The Worker caches scripts and styles in assets/ and _marketing/ as immutable " +
  "for a year (apps/edge/src/cache.ts), so only the bundler may write them.";

type Options = {
  /**
   * Output directories of other Vite builds (with `build.manifest: true`) that
   * a plugin copies into this one. Their copies must match these files.
   */
  readonly copiedBuilds: readonly string[];
};

/**
 * Fails the build if a script or stylesheet in `assets/` or `_marketing/` is
 * not byte for byte what a bundler emitted:
 *   - at the start, if `public/` has either directory (Vite copies it as is);
 *   - at the end, after every other plugin has written, if the output holds
 *     one that is in neither this bundle nor a copied build's manifest, or
 *     whose bytes differ from the bundle or from the copied build's own file.
 *
 * Ordering: `enforce: "post"` puts this plugin after the app's plugins, and
 * `order: "post"` runs its `generateBundle` and `closeBundle` after every hook
 * of the same name without an order, Vite's own build plugins included (one of
 * them rewrites `chunk.code` in `generateBundle`). Rolldown runs `closeBundle`
 * hooks one at a time and waits for async ones (`sequential` is deprecated and
 * always on), so earlier writers have finished when the check reads the output.
 * Limit: a plugin whose `closeBundle` is also `order: "post"` and that sorts
 * after this one (a later `enforce: "post"` plugin) still writes after the
 * check. Builds with `write: false`, or that already failed, are not checked.
 */
export const bundlerOnlyAssetDirs = ({ copiedBuilds }: Options): Plugin => {
  let dirs: { root: string; publicDir: string; outDir: string } | undefined;
  let digests: Digests | undefined;
  let emitted: Digests | undefined;
  return {
    name: "julian:bundler-only-asset-dirs",
    apply: "build",
    enforce: "post",
    configResolved(config) {
      dirs = {
        root: config.root,
        publicDir: config.publicDir,
        outDir: path.resolve(config.root, config.build.outDir),
      };
    },
    buildStart() {
      digests = undefined;
      emitted = undefined;
      // `publicDir` is "" when the build sets `publicDir: false`.
      if (!dirs?.publicDir) return;
      const taken = reservedPublicDirs(dirs.publicDir);
      if (taken.length > 0) {
        const publicDir = toPosix(path.relative(dirs.root, dirs.publicDir));
        this.error(
          `${taken.map((dir) => `${publicDir}/${dir}`).join(", ")} is reserved for hashed build output.`,
        );
      }
    },
    generateBundle: {
      order: "post",
      handler(_, bundle) {
        digests = bundleDigests(bundle);
      },
    },
    // Only a build that wrote its bundle, with no writeBundle hook failing
    // first, is checked: one that failed keeps its own error.
    writeBundle: {
      order: "post",
      handler() {
        emitted = digests;
      },
    },
    closeBundle: {
      order: "post",
      handler() {
        if (!dirs || !emitted) return;
        const missing = copiedBuilds.map(manifestPath).filter((file) => !existsSync(file));
        if (missing.length > 0) {
          this.error(`${missing.join(", ")} is missing, so the copied build cannot be checked.`);
        }
        const expected = mergeDigests([emitted, ...copiedBuilds.map(copiedBuildDigests)]);
        const { unemitted, altered } = unprovenScriptsAndStyles(dirs.outDir, expected);
        const problems = [
          ...(unemitted.length > 0
            ? [`${unemitted.join(", ")} was not emitted by a bundler.`]
            : []),
          ...(altered.length > 0
            ? [`${altered.join(", ")} differs from what the bundler emitted.`]
            : []),
        ];
        if (problems.length > 0) this.error(`${problems.join(" ")} ${CACHE_NOTE}`);
      },
    },
  };
};
