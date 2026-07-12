# Security policy

Please do not open a public issue for a suspected vulnerability or leaked
credential. Use GitHub's private vulnerability reporting for this repository.

This application must not contain credentials. The Google OAuth client ID is
public configuration; the client secret must exist only in 1Password and the
Cloudflare Worker secret store.
