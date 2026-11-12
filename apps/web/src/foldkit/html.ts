import type { HtmlBuilder } from "foldkit/html";
import { Message, type Model } from "./model";

export type Builder = HtmlBuilder<Message>;
export const act = (action: Parameters<typeof Message.ClickedAction>[0]["action"]) =>
  Message.ClickedAction({ action });
const longMonth = new Intl.DateTimeFormat("en", { month: "long" });
const shortMonth = new Intl.DateTimeFormat("en", { month: "short" });
const dayFormat = new Intl.DateTimeFormat("en", { month: "long", day: "numeric" });
export const monthName = (month: number, short = false) =>
  (short ? shortMonth : longMonth).format(new Date(2026, month, 1));
export const dateLabel = (date: string) => dayFormat.format(new Date(`${date}T00:00:00`));
export const highlighted = (title: string, model: Model, h: Builder) => {
  const needle = model.query.trim().toLocaleLowerCase();
  if (!needle) return [title];
  const parts = (from: number): readonly { readonly text: string; readonly match: boolean }[] => {
    const at = title.toLocaleLowerCase().indexOf(needle, from);
    if (at < 0) return from < title.length ? [{ text: title.slice(from), match: false }] : [];
    const end = at + needle.length;
    return [
      ...(at > from ? [{ text: title.slice(from, at), match: false }] : []),
      { text: title.slice(at, end), match: true },
      ...parts(end),
    ];
  };
  return parts(0).map((part) => (part.match ? h.mark([], [part.text]) : part.text));
};
