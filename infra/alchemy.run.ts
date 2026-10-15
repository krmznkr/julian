import * as Alchemy from "alchemy";
import { adopt } from "alchemy/AdoptPolicy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";
import { ZONE_NAME } from "./src/config.ts";

// Owns the zone-level settings. The Worker scripts, their bindings and custom
// domains stay with wrangler (rendered from src/config.ts); see
// docs/infrastructure.md for why.
export default Alchemy.Stack(
  "julian",
  { providers: Cloudflare.providers(), state: Cloudflare.state() },
  Effect.gen(function* () {
    // Pre-existing zone: adopted, and retained if ever removed from the stack.
    const zone = yield* Cloudflare.Zone.Zone("Zone", { name: ZONE_NAME }).pipe(adopt(true));

    // Cloudflare's managed robots.txt (already on): keeps AI crawlers out while
    // search crawlers can still read the noindex header.
    yield* Cloudflare.BotManagement.BotManagement("BotManagement", {
      zoneId: zone.zoneId,
      isRobotsTxtManaged: true,
    });

    return { zoneId: zone.zoneId };
  }),
);
