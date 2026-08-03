// Mapping transport/status/decode failures into the app's typed error channel.
//
// Effect's `HttpClientError` already distinguishes request-side failures from
// response-side ones, and the response-side reasons carry the actual
// `HttpClientResponse`. Reading the status through those typed reasons removes
// the structural property-sniffing (and the `unknown` casts it required) that
// the previous implementation used to recover a status code.
import { Effect } from "effect";
import { HttpClientError } from "effect/unstable/http";
import { GoogleApiError } from "@/lib/effect/errors";

// Response-carrying reasons are exactly `StatusCodeError | DecodeError |
// EmptyBodyError`; everything else never saw a response.
const responseStatus = (error: HttpClientError.HttpClientError): number | undefined => {
  const reason = error.reason;
  return reason instanceof HttpClientError.StatusCodeError ||
    reason instanceof HttpClientError.DecodeError ||
    reason instanceof HttpClientError.EmptyBodyError
    ? reason.response.status
    : undefined;
};

// Curried so it reads as an operation label at the call site:
//   effect.pipe(googleApiError("GoogleCalendar.listEvents"))
export const googleApiError =
  (operation: string, message: string) =>
  <A, R>(effect: Effect.Effect<A, unknown, R>): Effect.Effect<A, GoogleApiError, R> =>
    effect.pipe(
      Effect.mapError(
        (cause) =>
          new GoogleApiError({
            operation,
            message,
            status:
              cause instanceof HttpClientError.HttpClientError ? responseStatus(cause) : undefined,
            cause,
          }),
      ),
    );
