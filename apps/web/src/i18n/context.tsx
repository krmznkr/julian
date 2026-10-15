import { createContext, type ReactNode, use, useCallback } from "react";

const DEFAULT_LOCALE = "en" as const;
type Locale = typeof DEFAULT_LOCALE;

interface I18nContextValue {
  locale: Locale;
  formatDate: (date: Date, options?: Intl.DateTimeFormatOptions) => string;
  formatDateRange: (start: Date, end: Date) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const locale = DEFAULT_LOCALE;

  const formatDate = useCallback((date: Date, options?: Intl.DateTimeFormatOptions): string => {
    return new Intl.DateTimeFormat(DEFAULT_LOCALE, options).format(date);
  }, []);

  const formatDateRange = useCallback((start: Date, end: Date): string => {
    const startYear = start.getFullYear();
    const endYear = end.getFullYear();
    const startMonth = start.getMonth();
    const endMonth = end.getMonth();
    const startDay = start.getDate();
    const endDay = end.getDate();

    const monthFormat = new Intl.DateTimeFormat(DEFAULT_LOCALE, { month: "short" });
    const dayFormat = new Intl.DateTimeFormat(DEFAULT_LOCALE, { day: "numeric" });

    // Same day
    if (startYear === endYear && startMonth === endMonth && startDay === endDay) {
      return new Intl.DateTimeFormat(DEFAULT_LOCALE, {
        month: "short",
        day: "numeric",
      }).format(start);
    }

    // Same month
    if (startYear === endYear && startMonth === endMonth) {
      return `${monthFormat.format(start)} ${dayFormat.format(start)}–${dayFormat.format(end)}`;
    }

    // Same year
    if (startYear === endYear) {
      const startStr = new Intl.DateTimeFormat(DEFAULT_LOCALE, {
        month: "short",
        day: "numeric",
      }).format(start);
      const endStr = new Intl.DateTimeFormat(DEFAULT_LOCALE, {
        month: "short",
        day: "numeric",
      }).format(end);
      return `${startStr} – ${endStr}`;
    }

    // Different years
    const startStr = new Intl.DateTimeFormat(DEFAULT_LOCALE, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(start);
    const endStr = new Intl.DateTimeFormat(DEFAULT_LOCALE, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(end);
    return `${startStr} – ${endStr}`;
  }, []);

  const value: I18nContextValue = {
    locale,
    formatDate,
    formatDateRange,
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = use(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return context;
}
