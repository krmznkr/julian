import type { ReactNode } from "react";
import { ThemeProvider } from "next-themes";
import { I18nProvider } from "@/i18n/context";

export function CoreProviders({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        {children}
      </ThemeProvider>
    </I18nProvider>
  );
}
