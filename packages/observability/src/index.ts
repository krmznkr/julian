import { PRODUCTION_ORIGIN } from "./privacy";

export interface TelemetryBuild {
  readonly production: boolean;
  readonly channel: string;
  readonly release: string;
  readonly origin: string;
}

export const isProduction = (build: TelemetryBuild): boolean =>
  build.production && build.channel === "stable" && build.origin === PRODUCTION_ORIGIN;

export const startObservability = async (
  build: TelemetryBuild,
): Promise<((error: unknown) => void) | undefined> => {
  if (!isProduction(build)) return;
  // Blockers or a failed download must never stop the calendar from mounting.
  try {
    const { initialize } = await import("./browser");
    return initialize(build.release);
  } catch {
    // Telemetry is optional, including when an SDK cannot initialize.
  }
};
