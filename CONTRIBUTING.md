# Contributing

Open an issue before a large change. Keep pull requests focused and run the
checks before pushing.

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test:run
pnpm build
```

Never commit `.env` files, OAuth secrets, or Cloudflare tokens.
