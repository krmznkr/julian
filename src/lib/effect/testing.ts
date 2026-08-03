// Test layer for the app's Effect service graph.
//
// Tests assemble the real services over a stubbed `fetch`, in-memory storage
// and recording navigation, rather than mutating globals and running through
// the shared app runtime. That matters here for a concrete reason:
// `FetchHttpClient.Fetch` is a `Context.Reference` whose default is resolved
// once per runtime, so a `vi.spyOn(globalThis, "fetch")` installed after the
// runtime is first used is silently ignored. Providing the reference explicitly
// makes the transport an ordinary, per-test dependency.
import { Effect, Layer, Ref } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { AppConfigShape, appConfigLayerWith } from "@/lib/effect/config";
import { keyValueStoreMemoryLayer } from "@/lib/effect/key-value-store";
import { NavigationCall, recordingNavigationLayer } from "@/lib/effect/navigation";
import { tokenStoreLayer } from "@/lib/effect/token-store";
import { googleHttpLayer } from "@/lib/effect/google-http";
import { googleAuthLayer } from "@/lib/effect/google-auth";
import { googleCalendarApiLayer } from "@/lib/effect/google-calendar-api";
import { googleTasksLayer } from "@/lib/effect/google-tasks";

export interface RecordedRequest {
  readonly url: string;
  readonly method: string;
}

export interface FetchStub {
  // Requests seen so far, in order.
  readonly requests: Ref.Ref<ReadonlyArray<RecordedRequest>>;
  readonly layer: Layer.Layer<never>;
}

export const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

// Build a fetch stub from an ordered list of responses; the last response is
// reused once the list is exhausted so retries stay deterministic.
export const makeFetchStub = (
  responses: ReadonlyArray<Response | (() => Response)>,
): Effect.Effect<FetchStub> =>
  Effect.gen(function* () {
    const requests = yield* Ref.make<ReadonlyArray<RecordedRequest>>([]);
    const cursor = yield* Ref.make(0);

    const fetchImpl: typeof globalThis.fetch = (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const method =
        init?.method ?? (typeof input === "object" && "method" in input ? input.method : "GET");

      Effect.runSync(Ref.update(requests, (seen) => [...seen, { url, method }]));

      const index = Effect.runSync(Ref.getAndUpdate(cursor, (n) => n + 1));
      const entry = responses[Math.min(index, responses.length - 1)];
      if (entry === undefined) return Promise.reject(new Error("No stubbed response"));
      return Promise.resolve(typeof entry === "function" ? entry() : entry.clone());
    };

    return {
      requests,
      layer: Layer.succeed(FetchHttpClient.Fetch, fetchImpl),
    };
  });

export interface TestEnv {
  readonly fetch: FetchStub;
  readonly navigations: Ref.Ref<ReadonlyArray<NavigationCall>>;
}

// The full application graph over test transports.
export const layer = (options: {
  readonly fetch: FetchStub;
  readonly navigations: Ref.Ref<ReadonlyArray<NavigationCall>>;
  readonly storage?: Readonly<Record<string, string>>;
  readonly config?: Partial<AppConfigShape>;
}) => {
  const infrastructure = Layer.mergeAll(
    FetchHttpClient.layer.pipe(Layer.provide(options.fetch.layer)),
    keyValueStoreMemoryLayer(options.storage),
    recordingNavigationLayer(options.navigations),
  );

  const credentials = tokenStoreLayer.pipe(
    Layer.provideMerge(appConfigLayerWith(options.config)),
    Layer.provideMerge(infrastructure),
  );

  return Layer.mergeAll(
    googleCalendarApiLayer,
    googleTasksLayer,
    googleAuthLayer.pipe(Layer.provide(credentials)),
  ).pipe(Layer.provide(googleHttpLayer), Layer.provideMerge(credentials));
};
