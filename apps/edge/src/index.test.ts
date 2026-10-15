// @vitest-environment node
import { expect, it } from "vitest";
import worker from "./index";

it("exports only the fetch handler", async () => {
  const module = await import("./index");
  expect(Object.keys(module)).toEqual(["default"]);
  const response = await worker.fetch(
    new Request("https://julian.krmznkr.com/version.json", {
      headers: { "User-Agent": "Mozilla/5.0" },
    }),
    {
      ASSETS: { fetch: async () => new Response("") },
      GOOGLE_CLIENT_ID: "id",
      GOOGLE_CLIENT_SECRET: "secret",
      SITE_RATELIMIT: { limit: async () => ({ success: true }) },
      OAUTH_RATELIMIT: { limit: async () => ({ success: true }) },
    },
  );
  expect(response.status).toBe(200);
});
