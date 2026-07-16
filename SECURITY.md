# Security policy

Please do not open a public issue for a suspected vulnerability or leaked
credential. Use GitHub's private vulnerability reporting for this repository.

This application must not contain credentials. The Google OAuth client ID is
public configuration; the client secret must exist only in 1Password and the
Cloudflare Worker secret store.

## How the deployment is hardened

The running site (`julian.krmznkr.com`) enforces bot filtering, per-IP rate
limiting, an OAuth-proxy origin lock, response security headers (CSP/HSTS/…),
and search de-indexing — all in code, deployed via CI. See
[`docs/security.md`](docs/security.md) for the full design, tuning guide, and
production smoke tests.
