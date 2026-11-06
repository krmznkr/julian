import { describe, expect, it } from "vitest";
import { appConfigLayerWith, AppConfig } from "@julian/google/config";
import { Effect } from "effect";
import { withPreviewSignIn } from "@/lib/preview-sign-in";

const config = (appOrigin: string) =>
  Effect.runSync(
    Effect.provide(
      Effect.map(AppConfig, (value) => value),
      appConfigLayerWith({ appOrigin, redirectUri: `${appOrigin}/auth/callback` }),
    ),
  );

describe("withPreviewSignIn", () => {
  it("points a PR preview at the production callback", () => {
    const preview = "https://pr-109-julian.julian-93527c9983d1.workers.dev";
    expect(withPreviewSignIn(config(preview)).redirectUri).toBe(
      "https://julian.krmznkr.com/auth/callback",
    );
  });

  it("leaves every other origin on its own callback", () => {
    const local = config("http://localhost:3000");
    expect(withPreviewSignIn(local)).toBe(local);
  });
});
