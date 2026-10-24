// The shared chrome of the marketing pages, inlined at build time.
//
// Each page is a plain HTML file with `<!-- @name -->` markers; the Vite plugin
// in vite.config.ts replaces them with the partials below, so the output is
// static HTML with no client JavaScript.
import { GOOGLE_SCOPES } from "@julian/google/config";

const REPOSITORY_URL = "https://github.com/krmznkr/julian";
export const ISSUES_URL = `${REPOSITORY_URL}/issues`;

// Why each requested scope is needed, in the words the privacy page uses.
export const SCOPE_PURPOSES: Readonly<Record<string, string>> = {
  "https://www.googleapis.com/auth/calendar.readonly":
    "list your calendars and read their events for the year on screen",
  "https://www.googleapis.com/auth/calendar.events":
    "create, rename, move, and delete events when you ask it to",
  "https://www.googleapis.com/auth/tasks.readonly":
    "show your incomplete Google Tasks with due dates (read-only)",
};

const escapeHtml = (text: string) =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

const header = `<header class="site-header">
  <a class="brand" href="/home" aria-label="Julian home"><svg width="28" height="28" viewBox="0 0 64 64" fill="none" aria-hidden="true"><path d="M8 32C14.2667 21.6 22.9333 16 32 16C41.0667 16 49.7333 21.6 56 32C49.7333 42.4 41.0667 48 32 48C22.9333 48 14.2667 42.4 8 32Z" stroke="currentColor" stroke-width="4.75" stroke-linecap="round" stroke-linejoin="round" /><circle cx="32" cy="32" r="8.25" fill="currentColor" /></svg>Julian</a>
  <nav aria-label="Main">
    <a href="/demo">Live demo</a>
    <a href="${REPOSITORY_URL}">Source</a>
  </nav>
</header>`;

const footer = `<footer class="site-footer">
  <nav aria-label="Legal">
    <a href="/privacy">Privacy</a>
    <a href="/terms">Terms</a>
    <a href="${ISSUES_URL}">Contact</a>
  </nav>
  <p>Julian is an independent open-source project, not affiliated with Google.</p>
</footer>`;

export function renderScopes(scopes: ReadonlyArray<string> = GOOGLE_SCOPES): string {
  const items = scopes.map((scope) => {
    const purpose = SCOPE_PURPOSES[scope];
    if (purpose === undefined) throw new Error(`No privacy wording for the scope ${scope}`);
    return `  <li><code>${escapeHtml(scope)}</code>: to ${escapeHtml(purpose)}.</li>`;
  });
  return `<ul class="scopes">\n${items.join("\n")}\n</ul>`;
}

const PARTIALS: Readonly<Record<string, () => string>> = {
  header: () => header,
  footer: () => footer,
  scopes: () => renderScopes(),
};

export function renderPartials(html: string): string {
  return html.replaceAll(/<!--\s*@([a-z]+)\s*-->/g, (_, name: string) => {
    const partial = PARTIALS[name];
    if (partial === undefined) throw new Error(`Unknown partial @${name}`);
    return partial();
  });
}
