# Operations And Runtime Rules

Last updated: 2026-09-07

## Runtime Baseline

- Use Node.js 22.18 or newer as declared in package.json; Node 22 LTS is the CI baseline.
- Use pnpm 10.34.5 as pinned by package.json `packageManager` and `engines.pnpm`. Corepack can run this project version without changing the package manager used by other repositories.
- Use `pnpm install --frozen-lockfile` for clean installs, CI, and deployment. Use `pnpm add`, `pnpm remove`, or `pnpm install --no-frozen-lockfile` only when intentionally updating dependencies.
- Commit `pnpm-lock.yaml`; do not add `package-lock.json`, `yarn.lock`, or another dependency lockfile.
- Run commands with `pnpm dev`, `pnpm build`, `pnpm start`, `pnpm check:harness`, `pnpm lint`, `pnpm typecheck`, and `pnpm test`.
- The install guard rejects npm, Yarn, and mismatched pnpm versions. Keep its expected version aligned with package.json when upgrading pnpm.
- Keep dependency build-script permissions in `pnpm-workspace.yaml`; its single-package configuration does not turn Studio into a monorepo.
- Keep local development, build, and production commands aligned with package.json scripts.
- Run framework upgrades in a clean, reviewable change before product migration work.

## Deployment Surfaces

Xct Studio has separate deployable surfaces:

| Surface | Responsibility |
| --- | --- |
| Next application | Studio UI, route handlers, runtime configuration, server-side provider proxies. |
| Cloudflare media worker | R2 archive and upload transport, asset lists, share and community records, authorization records, state compatibility endpoints. |
| External providers | TokenHub, BytePlus, and model endpoints. |

Deploying one surface must not silently change contracts owned by another surface.

## Configuration Rules

- Keep secrets in deployment environment configuration only.
- A value prefixed with NEXT_PUBLIC_ is public and must never contain a secret.
- /api/config may return only browser-safe runtime configuration.
- Validate required server-side configuration at startup or on the first protected call with an actionable, secret-free error.
- Keep production, preview, and local Worker origins explicit. Do not use a production R2 bucket for unreviewed destructive testing.

## Media And Storage Operations

- Treat provider CDN links as expiring transport URLs, not permanent media.
- Verify archive success before relying on an R2 URL as a durable production asset.
- Preserve range requests and CORS behavior for browser-played media.
- Observe storage growth, archive failures, upload rejection rate, and Worker errors.
- Do not perform bulk deletion or object-key migrations without a written recovery plan.

## Logs And Incident Handling

- Log enough safe context to identify the operation, owner scope, provider, and error code.
- Do not log keys, authorization headers, raw scripts, private reference URLs, or authorization documents.
- Separate user-facing failure text from diagnostic logging.
- For a provider outage, preserve the failed job and allow an explicit retry path rather than losing the Shot state.

## Release Validation

Before a runtime release:

- install from the committed lockfile
- run harness checks, lint, typecheck, tests, and build
- test the primary Studio surface
- test /api/config
- test a configured and an unconfigured Worker state
- smoke test media playback from R2 when media behavior changes
- smoke test /zh and /en, query/hash preservation when switching languages, and the locale-independent portrait callback

## Recovery Rule

Do not make destructive state migrations, Worker deployments, or provider credential rotations as an incidental code task. They require an explicit operational plan and verification path.
