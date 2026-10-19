import { afterEach, expect, it, vi } from "vitest";
import { startObservability } from "@julian/observability";

vi.mock("@julian/observability", () => ({
  startObservability: vi.fn<typeof startObservability>().mockResolvedValue(undefined),
}));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it("passes the deployed channel, commit and actual origin to the shared production gate", async () => {
  vi.stubGlobal("window", { location: { origin: "https://julian-nightly.krmznkr.com" } });
  vi.stubGlobal("__APP_CHANNEL__", "nightly");
  vi.stubGlobal("__APP_COMMIT__", "abc1234");
  vi.stubEnv("PROD", true);
  await import("./observability");
  expect(startObservability).toHaveBeenCalledExactlyOnceWith({
    production: true,
    channel: "nightly",
    release: "abc1234",
    origin: "https://julian-nightly.krmznkr.com",
  });
});
