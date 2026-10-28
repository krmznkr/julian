import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Manifest, Plugin } from "vite";

// The Worker caches `<name>-<hash>.js|css` under `/assets/` and `/_marketing/`
// for a year (apps/edge/src/cache.ts). That is only safe if a bundler wrote
// every script and stylesheet there: a hand-placed file with a hash-like name
// would be pinned in browsers with no way to update it.
const BUNDLER_ONLY_DIRS = ["assets", "_marketing"];

const SCRIPT_OR_STYLE = /\.(?:js|css)$/;

const toPosix = (file: string) => file.split(path.sep).join("/");

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

/**
 * Scripts and stylesheets under a reserved directory of `outDir` that are not
 * in `emitted`. Anything that is not a directory counts, symlinks included.
 */
export const unemittedScriptsAndStyles = (
  outDir: string,
  emitted: ReadonlySet<string>,
): readonly string[] =>
  BUNDLER_ONLY_DIRS.filter((dir) => existsSync(path.join(outDir, dir)))
    .flatMap((dir) => readdirSync(path.join(outDir, dir), { recursive: true, withFileTypes: true }))
    .filter((entry) => !entry.isDirectory() && SCRIPT_OR_STYLE.test(entry.name))
    .map((entry) => toPosix(path.relative(outDir, path.join(entry.parentPath, entry.name))))
    .filter((file) => !emitted.has(file))
    .sort();

const readManifest = (file: string): Manifest => JSON.parse(readFileSync(file, "utf8")) as Manifest;

type Options = {
  /** Vite manifests of other builds whose output is copied into this one. */
  readonly copiedManifests: readonly string[];
};

/**
 * Fails the build if anything but a bundler could put a script or stylesheet
 * in `assets/` or `_marketing/`:
 *   - at the start, if `public/` has either directory (Vite copies it as is);
 *   - at the end, after every plugin has written, if the output holds one that
 *     neither this bundle nor a copied build's manifest lists.
 */
export const bundlerOnlyAssetDirs = ({ copiedManifests }: Options): Plugin => {
  let dirs: { root: string; publicDir: string; outDir: string } | undefined;
  let written: readonly string[] | undefined;
  return {
    name: "julian:bundler-only-asset-dirs",
    apply: "build",
    configResolved(config) {
      dirs = {
        root: config.root,
        publicDir: config.publicDir,
        outDir: path.resolve(config.root, config.build.outDir),
      };
    },
    buildStart() {
      written = undefined;
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
    writeBundle(_, bundle) {
      written = Object.keys(bundle);
    },
    // Runs once every plugin's writeBundle has finished, so it also sees files
    // that a later plugin copied in (the marketing pages in vite.config.ts).
    closeBundle() {
      if (!dirs || !written) return;
      const missing = copiedManifests.filter((file) => !existsSync(file));
      if (missing.length > 0) {
        this.error(`${missing.join(", ")} is missing, so the copied build cannot be checked.`);
      }
      const emitted = new Set([
        ...written,
        ...copiedManifests.flatMap((file) => manifestFiles(readManifest(file))),
      ]);
      const stray = unemittedScriptsAndStyles(dirs.outDir, emitted);
      if (stray.length > 0) {
        this.error(
          `${stray.join(", ")} was not emitted by a bundler. The Worker caches ` +
            "scripts and styles in assets/ and _marketing/ as immutable for a year " +
            "(apps/edge/src/cache.ts), so only the bundler may write them.",
        );
      }
    },
  };
};
