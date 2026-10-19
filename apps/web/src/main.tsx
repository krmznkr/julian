import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import "@/styles/globals.css";
import { AppProviders } from "@/providers";
import { router } from "@/router";

import { isProduction, startObservability } from "@julian/observability";
import { BUILD_INFO } from "@/lib/build-info";

const telemetryBuild = {
  production: import.meta.env.PROD,
  channel: BUILD_INFO.channel,
  release: BUILD_INFO.commit,
  origin: window.location.origin,
};
const telemetry = startObservability(telemetryBuild);

const container = document.getElementById("root");

if (!container) {
  throw new Error("Missing #root element");
}

createRoot(container, {
  onCaughtError: isProduction(telemetryBuild)
    ? (error) => {
        void telemetry.then((report) => report?.(error)).catch(() => undefined);
      }
    : undefined,
}).render(
  <StrictMode>
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
);
