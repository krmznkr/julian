// Opens an external URL in a new browser tab.
//
// Backed by the `Navigation` service so all external navigation flows through a
// single, injectable effect rather than touching `window.open` at call sites.
import { Effect } from "effect";
import { runFork } from "@/lib/effect/runtime";
import { Navigation } from "@/lib/effect/navigation";

export function openExternal(url: string): void {
  runFork(Effect.flatMap(Navigation, (navigation) => navigation.openExternal(url)));
}
