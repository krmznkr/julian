import { beforeEach, describe, expect, it, vi } from "vitest";
import { isProduction, startObservability } from ".";

const initialize = vi.hoisted(() =>
  vi.fn<(release: string) => ((error: unknown) => void) | undefined>(),
);
vi.mock("./browser", () => ({ initialize }));
const build = {
  production: true,
  channel: "stable",
  origin: "https://julian.krmznkr.com",
  release: "sha",
};

beforeEach(() => {
  initialize.mockReset();
});
describe("production gate", () => {
  it.each([
    { ...build, production: false },
    { ...build, channel: "dev" },
    { ...build, channel: "nightly" },
    { ...build, channel: "preview" },
    { ...build, origin: "http://127.0.0.1:3000" },
    { ...build, origin: "https://julian-nightly.krmznkr.com" },
    { ...build, origin: "https://pr-1.example.workers.dev" },
  ])("does not load SDKs outside the production build and origin: %j", async (value) => {
    expect(isProduction(value)).toBe(false);
    await startObservability(value);
    expect(initialize).not.toHaveBeenCalled();
  });
  it("starts SDKs on the stable production origin", async () => {
    await startObservability(build);
    expect(initialize).toHaveBeenCalledExactlyOnceWith("sha");
  });
  it("keeps the app usable when SDK loading fails", async () => {
    initialize.mockImplementation(() => {
      throw new Error("blocked");
    });
    await expect(startObservability(build)).resolves.toBeUndefined();
  });
});
