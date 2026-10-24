// Every way a request can be turned away, as tagged errors.
//
// Each one knows its HTTP status and the response body it renders to, so the
// pipeline just fails with the right error and `toResponse` in `index.ts` is the
// single place errors become HTTP.
import { Schema } from "effect";

// Plain-text rejections for the whole site (bots, volumetric abuse).
export class BlockedClient extends Schema.TaggedError<BlockedClient>()("BlockedClient", {}) {}

export class SiteRateLimited extends Schema.TaggedError<SiteRateLimited>()("SiteRateLimited", {}) {}

// JSON rejections for the OAuth proxy, in Google's `error` / `error_description` shape.
class OAuthRejected extends Schema.TaggedError<OAuthRejected>()("OAuthRejected", {
  status: Schema.Number,
  error: Schema.String,
  description: Schema.optional(Schema.String),
}) {}

export type EdgeError = BlockedClient | SiteRateLimited | OAuthRejected;

export const rejectOAuth = (status: number, error: string, description?: string) =>
  new OAuthRejected({ status, error, description });
