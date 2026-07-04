import { isTauri } from "@tauri-apps/api/core";

// In the desktop app the webview ignores `window.open` / `<a target="_blank">`
// for external URLs, so links silently do nothing. Route them through the
// opener plugin (the `opener:default` capability already allows http/https).
// In the browser this is just a normal new-tab open.
export async function openExternal(url: string): Promise<void> {
  if (isTauri()) {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
