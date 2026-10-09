# DetailForge production container

- Playwright image is pinned to v1.63.0-noble.
- Chromium runs as non-root `pwuser`.
- Chromium sandbox must remain enabled.
- `deploy/seccomp_profile.json` is the official Playwright v1.63.0 profile.
- Production uses one application instance initially.
- `DETAILFORGE_EXPORT_BROWSER_CHANNEL` must remain unset so bundled Chromium is used.
- Runtime secrets live outside the repository in `/etc/detailforge/detailforge.env`.
- The application binds only to `127.0.0.1:3000`; HTTPS ingress is provided separately.
