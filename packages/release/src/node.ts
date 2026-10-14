// Node-only helpers shared by the Vite build and the CLI.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildInfo, buildInputFromEnv, type BuildInfo } from "./index.ts";

const rootPackageJson = fileURLToPath(new URL("../../../package.json", import.meta.url));

const readRootVersion = (): string =>
  (JSON.parse(readFileSync(rootPackageJson, "utf8")) as { version: string }).version;

const readGitCommit = (): string => {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" });
  } catch {
    return "";
  }
};

export const currentBuildInfo = (
  env: Readonly<Record<string, string | undefined>> = process.env,
): BuildInfo =>
  buildInfo(
    buildInputFromEnv(env, {
      baseVersion: readRootVersion(),
      commit: readGitCommit(),
      date: new Date(),
    }),
  );
