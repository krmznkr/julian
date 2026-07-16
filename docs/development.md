# Development

Julian is now a single browser-only Vite app.

## Requirements

- Node 24
- pnpm 10

## Commands

| Command              | Purpose                         |
| -------------------- | ------------------------------- |
| `pnpm dev`           | Start the local Vite dev server |
| `pnpm build`         | Build the browser app           |
| `pnpm preview`       | Preview the production build    |
| `pnpm typecheck`     | Run TypeScript checks           |
| `pnpm test:run`      | Run unit tests                  |
| `pnpm quality:static` | Run static quality checks       |

## Data

The app uses local sample calendar data from `src/lib/local-calendar-data.ts`. Calendar visibility is persisted in browser localStorage.

## Security

Production hardening (bot filtering, rate limiting, OAuth origin lock, security
headers, de-indexing) is documented in [`security.md`](security.md).
