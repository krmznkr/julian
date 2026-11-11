import { Runtime } from "foldkit";
import { isProduction, startObservability } from "@julian/observability";
import { BUILD_INFO } from "@/lib/build-info";
import { init, update } from "./app";
import { Model, Message } from "./model";
import { browserPortsLayer } from "./services";
import { subscriptions } from "./subscriptions";
import { view } from "./view";
import "@/styles/globals.css";
import "./app.css";

const telemetryBuild = {
  production: import.meta.env.PROD,
  channel: BUILD_INFO.channel,
  release: BUILD_INFO.commit,
  origin: window.location.origin,
};
const telemetry = startObservability(telemetryBuild);

Runtime.run(
  Runtime.makeApplication({
    Model,
    init,
    update,
    view,
    subscriptions,
    container: document.getElementById("root"),
    resources: browserPortsLayer,
    devTools: false,
    routing: {
      onUrlRequest: (request) => Message.ClickedLink({ request }),
      onUrlChange: (url) => Message.ChangedUrl({ url }),
    },
    // The crash context also contains calendar state. Only the Error may cross
    // the existing telemetry boundary; DevTools and its MCP bridge stay disabled.
    crash: {
      report: isProduction(telemetryBuild)
        ? ({ error }) => {
            void telemetry.then((report) => report?.(error)).catch(() => undefined);
          }
        : undefined,
    },
  }),
);
