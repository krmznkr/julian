// Typed errors for the app's effectful layer.
//
// These use `Schema.TaggedErrorClass` rather than hand-rolled `_tag` classes so
// the error payloads are schema-described: they can be encoded/decoded, they
// carry operation labels for diagnosis, and they stay discriminable in the
// Effect error channel instead of becoming untyped thrown values.
import { Schema } from "effect";

// A network/API failure while talking to Google (or the OAuth Worker proxy).
// `operation` labels the boundary that failed, which is what makes a report
// actionable; `status` is present when the failure came back as an HTTP status.
//
// `status` uses `Schema.optional`, not `optionalKey`: transport failures never
// saw a response, so callers legitimately construct this error with an explicit
// `status: undefined`. `optionalKey` would reject that at construction time.
export class GoogleApiError extends Schema.TaggedErrorClass<GoogleApiError>()("Google.ApiError", {
  operation: Schema.String,
  message: Schema.String,
  status: Schema.optional(Schema.Number),
  cause: Schema.Defect(),
}) {}

// The user is not authenticated (no valid or renewable token).
export class NotAuthenticatedError extends Schema.TaggedErrorClass<NotAuthenticatedError>()(
  "Google.NotAuthenticated",
  { message: Schema.String },
) {}

// A local configuration problem (missing client id) or malformed OAuth state
// (missing PKCE verifier).
export class AuthConfigError extends Schema.TaggedErrorClass<AuthConfigError>()(
  "Google.AuthConfigError",
  { message: Schema.String },
) {}

export type AppError = GoogleApiError | NotAuthenticatedError | AuthConfigError;

// The failure set every authenticated Google API call can produce.
export type GoogleApiFailure = GoogleApiError | NotAuthenticatedError;

// A plain `Error` that still carries the tagged-error metadata (`_tag` and,
// when relevant, HTTP `status`). React code keeps catching `Error`s, while
// callers that care can branch on `error.tag === "Google.NotAuthenticated"`.
export class AppErrorLike extends Error {
  readonly tag: string | undefined;
  readonly status: number | undefined;

  constructor(message: string, options?: { tag?: string; status?: number; cause?: unknown }) {
    super(message, options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = options?.tag ?? "AppErrorLike";
    this.tag = options?.tag;
    this.status = options?.status;
  }
}

const isAppError = (error: unknown): error is AppError =>
  error instanceof GoogleApiError ||
  error instanceof NotAuthenticatedError ||
  error instanceof AuthConfigError;

// Collapse an app error (or unknown defect) into an `Error` for React code that
// still speaks in Errors, preserving `_tag`/`status` when present.
//
// This is a narrow, typed check against our own error classes rather than the
// previous structural `_tag`/`status` property sniffing, which required
// unchecked casts through `unknown`.
export function toError(error: unknown): Error {
  if (error instanceof AppErrorLike) return error;

  if (isAppError(error)) {
    return new AppErrorLike(error.message, {
      tag: error._tag,
      status: error instanceof GoogleApiError ? error.status : undefined,
      cause: error,
    });
  }

  if (error instanceof Error) return error;

  return new AppErrorLike(typeof error === "string" ? error : "Unknown error", { cause: error });
}
