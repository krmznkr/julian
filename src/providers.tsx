import { type PropsWithChildren } from "react";
import { CoreProviders } from "@/features/shell/core-providers";

export function AppProviders({ children }: PropsWithChildren) {
  return <CoreProviders>{children}</CoreProviders>;
}
