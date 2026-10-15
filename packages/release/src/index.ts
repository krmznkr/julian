// The product carries one semver version (root package.json, bumped by
// release-please). Every other channel derives a prerelease of the *next minor*
// from it, so nightly and preview builds always sort above the last stable one
// and below the release they are heading towards.
export const CHANNELS = ["stable", "nightly", "preview", "dev"] as const;
export type Channel = (typeof CHANNELS)[number];

export interface BuildInfo {
  readonly version: string;
  readonly channel: Channel;
  readonly commit: string;
}

export interface BuildInput {
  readonly baseVersion: string;
  readonly channel: Channel;
  readonly commit: string;
  readonly date: Date;
  readonly prNumber?: number;
}

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

export const parseChannel = (value: string | undefined): Channel =>
  CHANNELS.find((channel) => channel === value) ?? "dev";

export const nextMinor = (version: string): string => {
  const match = SEMVER.exec(version);
  if (match === null) throw new Error(`Not a release version: ${version}`);
  return `${match[1]}.${Number(match[2]) + 1}.0`;
};

export const shortCommit = (sha: string): string => sha.trim().slice(0, 7) || "unknown";

// YYYYMMDD in UTC, so a nightly is named after the day the cron fired.
export const nightlyStamp = (date: Date): string =>
  date.toISOString().slice(0, 10).replaceAll("-", "");

export const appVersion = ({
  baseVersion,
  channel,
  commit,
  date,
  prNumber,
}: BuildInput): string => {
  const sha = shortCommit(commit);
  switch (channel) {
    case "stable":
      return baseVersion;
    case "nightly":
      return `${nextMinor(baseVersion)}-nightly.${nightlyStamp(date)}+${sha}`;
    case "preview":
      if (prNumber === undefined) throw new Error("A preview build needs a pull request number");
      return `${nextMinor(baseVersion)}-pr.${prNumber}+${sha}`;
    case "dev":
      return `${baseVersion}-dev+${sha}`;
  }
};

export const buildInfo = (input: BuildInput): BuildInfo => ({
  version: appVersion(input),
  channel: input.channel,
  commit: shortCommit(input.commit),
});

// Reads the channel inputs the CI workflows set; anything missing means a local build.
export const buildInputFromEnv = (
  env: Readonly<Record<string, string | undefined>>,
  fallback: { readonly baseVersion: string; readonly commit: string; readonly date: Date },
): BuildInput => {
  const prNumber = Number(env.APP_PR_NUMBER);
  return {
    baseVersion: fallback.baseVersion,
    channel: parseChannel(env.APP_CHANNEL),
    commit: env.APP_COMMIT || fallback.commit,
    date: fallback.date,
    ...(Number.isInteger(prNumber) && prNumber > 0 ? { prNumber } : {}),
  };
};
