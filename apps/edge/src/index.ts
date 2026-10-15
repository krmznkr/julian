// Cloudflare Worker entry for julian.krmznkr.com. workerd allows only the
// default export here; the request pipeline lives in pipeline.ts.
import type { Env } from "./env";
import { serve } from "./pipeline";

export default {
  fetch: (request: Request, env: Env): Promise<Response> => serve(request, env),
};
