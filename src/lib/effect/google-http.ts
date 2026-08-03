// The authorized HTTP boundary for every Google API call.
//
// One service owns the whole outgoing-request boundary: bearer auth, status
// classification, transient retry, and schema-checked JSON decoding. Call sites
// therefore describe *what* they want, not how requests are authenticated or
// how failures are classified.
//
// Auth is applied as a client transform (`HttpClient.mapRequest`) rather than
// threaded through every helper, and transient failures retry through a bounded
// jittered schedule because Google rate-limits aggressively.
import { Context, Effect, Layer, Option, Schema, Stream } from "effect";
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/unstable/http";
import { GoogleApiError, NotAuthenticatedError } from "@/lib/effect/errors";
import { googleApiError } from "@/lib/effect/http-errors";
import { okClientWithRetry, retryingClient } from "@/lib/effect/http-policy";
import { AppConfig } from "@/lib/effect/config";
import { TokenStore } from "@/lib/effect/token-store";

// Schemas used at this boundary decode plain JSON, so they carry no decoding
// services. Constraining that here keeps the services out of the `R` channel
// and off every call site's type.
type JsonSchema = Schema.Constraint & { readonly DecodingServices: never };

export interface GoogleHttpShape {
  // Execute a request and decode its JSON body, failing on any non-2xx status.
  readonly json: <S extends JsonSchema>(
    schema: S,
    request: HttpClientRequest.HttpClientRequest,
    operation: string,
    message: string,
  ) => Effect.Effect<S["Type"], GoogleApiError | NotAuthenticatedError>;

  // As `json`, for a plain GET.
  readonly getJson: <S extends JsonSchema>(
    schema: S,
    url: string,
    operation: string,
    message: string,
  ) => Effect.Effect<S["Type"], GoogleApiError | NotAuthenticatedError>;

  // Execute a request for its status only, tolerating the given extra statuses.
  readonly send: (
    request: HttpClientRequest.HttpClientRequest,
    operation: string,
    message: string,
    tolerate?: ReadonlyArray<number>,
  ) => Effect.Effect<void, GoogleApiError | NotAuthenticatedError>;

  // Follow `nextPageToken` pagination as a stream of decoded pages. The caller
  // supplies the token accessor so this stays typed against the page schema
  // instead of casting an opaque decoded value.
  readonly paginate: <S extends JsonSchema>(
    schema: S,
    url: (pageToken: Option.Option<string>) => string,
    nextPageToken: (page: S["Type"]) => string | undefined,
    operation: string,
    message: string,
  ) => Stream.Stream<S["Type"], GoogleApiError | NotAuthenticatedError>;
}

export class GoogleHttp extends Context.Service<GoogleHttp, GoogleHttpShape>()(
  "@julian/GoogleHttp",
) {}

export const googleHttpLayer: Layer.Layer<
  GoogleHttp,
  never,
  AppConfig | TokenStore | HttpClient.HttpClient
> = Layer.effect(
  GoogleHttp,
  Effect.gen(function* () {
    const config = yield* AppConfig;
    const tokens = yield* TokenStore;
    const httpClient = yield* HttpClient.HttpClient;

    const baseClient = retryingClient(httpClient, config.retryTimes);
    const okClient = okClientWithRetry(httpClient, config.retryTimes);

    // Yields the current access token or fails with `NotAuthenticatedError`.
    const requireToken = Effect.gen(function* () {
      const token = yield* tokens.current;
      if (Option.isNone(token)) {
        return yield* new NotAuthenticatedError({ message: "Not authenticated" });
      }
      return token.value;
    });

    // Auth as a single client transform rather than a per-call header.
    const authorized = (client: HttpClient.HttpClient) =>
      Effect.map(requireToken, (token) =>
        HttpClient.mapRequest(client, HttpClientRequest.bearerToken(token)),
      );

    const json: GoogleHttpShape["json"] = Effect.fn("GoogleHttp.json")(
      function* (schema, request, operation, message) {
        const client = yield* authorized(okClient);
        return yield* client
          .execute(request)
          .pipe(
            Effect.flatMap(HttpClientResponse.schemaBodyJson(schema)),
            googleApiError(operation, message),
          );
      },
    );

    const getJson: GoogleHttpShape["getJson"] = (schema, url, operation, message) =>
      json(schema, HttpClientRequest.get(url), operation, message);

    const send: GoogleHttpShape["send"] = Effect.fn("GoogleHttp.send")(
      function* (request, operation, message, tolerate) {
        // Uses the unfiltered client so specific statuses (e.g. 410 Gone on a
        // delete that already happened) can be treated as success.
        const client = yield* authorized(baseClient);
        const response = yield* client.execute(request).pipe(googleApiError(operation, message));

        const ok = response.status >= 200 && response.status < 300;
        if (ok || (tolerate?.includes(response.status) ?? false)) return;

        return yield* new GoogleApiError({
          operation,
          message,
          status: response.status,
          cause: response,
        });
      },
    );

    const paginate: GoogleHttpShape["paginate"] = (
      schema,
      url,
      nextPageToken,
      operation,
      message,
    ) =>
      Stream.paginate(Option.none<string>(), (pageToken) =>
        json(schema, HttpClientRequest.get(url(pageToken)), operation, message).pipe(
          Effect.map((page) => {
            const next = nextPageToken(page);
            // The paginate state is itself `Option<string>`, so continuing
            // wraps the next token twice: once as "there is a next page",
            // once as "that page has a token".
            return [
              [page],
              next === undefined
                ? Option.none<Option.Option<string>>()
                : Option.some(Option.some(next)),
            ] as const;
          }),
        ),
      );

    return GoogleHttp.of({ json, getJson, send, paginate });
  }),
);
