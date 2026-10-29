// The fetch stub records what the HTTP client actually sends, whatever shape
// the request arrives in, so these cases call it directly.
import { describe, expect } from "vitest";
import { it } from "@effect/vitest";
import { Effect, Ref } from "effect";
import { FetchHttpClient } from "effect/http";
import * as TestEnv from "./testing";

const stubbedFetch = (responses: ReadonlyArray<Response | (() => Response)>) =>
  Effect.gen(function* () {
    const stub = yield* TestEnv.makeFetchStub(responses);
    const fetch = yield* Effect.gen(function* () {
      return yield* FetchHttpClient.Fetch;
    }).pipe(Effect.provide(stub.layer));
    return { stub, fetch };
  });

describe("makeFetchStub", () => {
  it.effect("records string, URL and Request inputs", () =>
    Effect.gen(function* () {
      const { stub, fetch } = yield* stubbedFetch([TestEnv.jsonResponse({ ok: true })]);

      yield* Effect.promise(() => fetch("https://a.example/"));
      yield* Effect.promise(() =>
        fetch(new URL("https://b.example/"), {
          method: "POST",
          headers: { "X-Test": "1" },
          body: new TextEncoder().encode("bytes"),
        }),
      );
      yield* Effect.promise(() =>
        fetch(new Request("https://c.example/", { method: "PUT", headers: { "X-Req": "2" } })),
      );

      expect(yield* Ref.get(stub.requests)).toEqual([
        { url: "https://a.example/", method: "GET", headers: {}, body: undefined },
        { url: "https://b.example/", method: "POST", headers: { "x-test": "1" }, body: "bytes" },
        { url: "https://c.example/", method: "PUT", headers: { "x-req": "2" }, body: undefined },
      ]);
    }),
  );

  it.effect("reuses the last response once the list runs out", () =>
    Effect.gen(function* () {
      const { fetch } = yield* stubbedFetch([
        TestEnv.jsonResponse({ n: 1 }),
        () => TestEnv.jsonResponse({ n: 2 }, 201),
      ]);

      const statuses = yield* Effect.promise(async () => [
        (await fetch("https://a.example/")).status,
        (await fetch("https://a.example/")).status,
        (await fetch("https://a.example/")).status,
      ]);

      expect(statuses).toEqual([200, 201, 201]);
    }),
  );

  it.effect("rejects when no response was stubbed", () =>
    Effect.gen(function* () {
      const { fetch } = yield* stubbedFetch([]);

      const error = yield* Effect.flip(Effect.tryPromise(() => fetch("https://a.example/")));

      expect(String(error.cause)).toContain("No stubbed response");
    }),
  );
});
