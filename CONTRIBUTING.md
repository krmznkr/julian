# Contributing

Open an issue before a large change. Keep pull requests focused and run the
checks before pushing.

```bash
bun install --frozen-lockfile
bun run typecheck
bun run test:run
bun run build
```

Never commit `.env` files, OAuth secrets, or Cloudflare tokens.
