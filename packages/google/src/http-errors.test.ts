// Status extraction when HTTP failures are mapped into `GoogleApiError`.
import { describe, expect } from "vitest";
import { it } from "@effect/vitest";
import { Effect } from "effect";
import { HttpClientError, HttpClientRequest, HttpClientResponse } from "effect/http";
import { googleApiError } from "./http-errors";

const request = HttpClientRequest.get("https://www.googleapis.com/calendar/v3/users/me");
const response = (status: number) =>
  HttpClientResponse.fromWeb(request, new Response(null, { status }));

const mappedStatus = (cause: unknown) =>
  Effect.fail(cause).pipe(
    googleApiError("Test.operation", "Test failed"),
    Effect.flip,
    Effect.map((error) => error.status),
  );

describe("googleApiError", () => {
  it.effect("keeps the status of every response-carrying reason", () =>
    Effect.gen(function* () {
      const statusCode = new HttpClientError.HttpClientError({
        reason: new HttpClientError.StatusCodeError({ request, response: response(503) }),
      });
      const decode = new HttpClientError.HttpClientError({
        reason: new HttpClientError.DecodeError({ request, response: response(200) }),
      });
      const emptyBody = new HttpClientError.HttpClientError({
        reason: new HttpClientError.EmptyBodyError({ request, response: response(204) }),
      });

      expect(yield* mappedStatus(statusCode)).toBe(503);
      expect(yield* mappedStatus(decode)).toBe(200);
      expect(yield* mappedStatus(emptyBody)).toBe(204);
    }),
  );

  it.effect("has no status when no response was received", () =>
    Effect.gen(function* () {
      const transport = new HttpClientError.HttpClientError({
        reason: new HttpClientError.TransportError({ request }),
      });

      expect(yield* mappedStatus(transport)).toBeUndefined();
      expect(yield* mappedStatus(new Error("not an HTTP error"))).toBeUndefined();
    }),
  );
});
