import { startObservability } from "@julian/observability";

void startObservability({
  production: import.meta.env.PROD,
  channel: __APP_CHANNEL__,
  release: __APP_COMMIT__,
  origin: window.location.origin,
});
