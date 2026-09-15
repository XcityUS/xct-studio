# Xct Studio Core Conventions

Last updated: 2026-09-07

This is the cross-cutting engineering baseline for Xct Studio. Domain-specific rules in the other files add to this document; they do not replace it.

## Required Engineering Baseline

- MUST use TypeScript.
- MUST NOT use Tailwind CSS.
- Prefer Server Components.
- Never call AI providers directly from UI components.
- MUST use the pinned pnpm version for dependency installation and project scripts; `pnpm-lock.yaml` is the only dependency lockfile.

Use strict TypeScript for application, server, Worker, shared, and test code. Use component directories such as `Input/index.tsx` with colocated `index.module.scss` and shared CSS custom properties. Sass is installed; current CSS Modules use SCSS. Default pages and layouts to Server Components and isolate browser interactions in small Client Components.

AI execution belongs to server-only services and provider adapters under `src/server`. UI components, including Server Components, consume application services rather than provider SDKs or endpoints. Browser hooks and client helpers must also use the application's API or Server Actions; wrapping a browser provider call in a hook does not satisfy the boundary.

Existing Tailwind usage, browser provider clients, and JavaScript runtime files are migration work, not conventions for new code. Their replacement is tracked in [the platform task list](../requirements/xct-studio-task-list.md). The framework/i18n foundation upgrade does not perform those full legacy migrations.

## Product Rule

UI translations must follow [i18n rules](i18n.md): flat English-copy keys, token normalization, identical `en/zh` key sets, and static root-translator calls. Do not replace the required strategy with semantic namespaces. `pnpm check:harness` enforces the machine-checkable requirements.

Follow [short-drama business rules](business.md) for the reference strategy, production model, approval gates, continuity, and localization requirements.

Xct Studio is a production workstation, not a collection of disconnected generation forms.

New work must preserve the production hierarchy:

IP -> Script Version -> Episode -> Scene -> Shot -> Candidate -> Selected Take -> Episode Version -> Localized Version -> Export

Do not introduce a new flat history-only workflow when the same data belongs to an Episode or Shot.

## Type Safety

- Do not introduce `any` in production TypeScript.
- Parse external JSON as unknown, then validate or narrow it at the boundary.
- Keep stable cross-feature types in src/shared/contracts.
- Keep feature-only types inside the owning src/features/<feature> directory.
- Model provider-specific request and response shapes separately from product-domain types.
- Use discriminated unions for lifecycle states where possible.

## Data And Identity

- Every durable domain object needs a stable opaque id.
- Store timestamps in UTC. Use ISO 8601 strings in API and persistence contracts unless an external provider requires another format.
- Use durationMs for durable internal timing values. Convert to seconds only at a provider or UI boundary.
- Use byte counts for media sizes. Do not persist display-formatted sizes.
- Do not use array indexes as durable identities for scenes, shots, candidates, or timeline clips.

## Error Handling

- Wrap external I/O with explicit error handling.
- Preserve actionable context in logs: feature, operation, provider, resource id, and safe status code.
- Do not expose API keys, bearer tokens, private reference URLs, authorization evidence, or raw provider payloads in user-facing errors or logs.
- Map provider failures into stable product error codes before they reach feature UI.
- Never silently discard a failed generation, archive upload, state sync, or export operation.

## AI Business API Contracts

- Treat AI-backed product workflows as server-side business APIs, not as UI button handlers. The UI submits typed application requests; provider credentials, model routing, schema repair, provider fallback, and stable error mapping stay behind same-origin routes and server adapters.
- XCT Studio user-key TokenHub calls must use `NEXT_PUBLIC_OPENAI_API_BASE_URL` as the gateway base path. This includes browser generation, prompt optimization, script breakdown, TTS, and other flows authenticated by the user's SSO/manual TokenHub key, except workflows explicitly classified below as server-owned business APIs.
- Do not route user-key TokenHub calls through `localhost`, `/api/*`, or another same-origin wrapper unless the product explicitly reclassifies that flow as a server-owned business API and updates this rule in the same change.
- Existing browser-direct TokenHub workflows, such as current prompt optimization and short-drama script breakdown, call `NEXT_PUBLIC_OPENAI_API_BASE_URL` from the browser with the user's SSO/manual key. In that mode, do not rely on server-only fallback credentials, and verify the browser Network origin is the configured TokenHub `/v1/*` endpoint.
- Burned-caption audio transcription calls the TokenHub `/v1/audio/transcriptions` gateway directly from the browser with the user's Xcity key, matching the existing video-generation boundary. Automatic subtitle modes build a timed player track directly from the selected script and do not call transcription. Provider credentials remain inside LiteLLM; Studio owns only the public model alias, response validation, caption alignment, and selected delivery mode.
- Do not make a new product workflow depend exclusively on a newly introduced or not-yet-proven gateway endpoint. Until that endpoint is deployed and smoke-tested in production, the Studio route must keep a compatible fallback to a stable endpoint or explicitly disable the feature with a clear readiness error.
- Do not require a browser-stored user key for server-owned workflows that can use a server-side TokenHub key. Prefer request bearer first when present, then server-only credentials, then return a stable unauthorized error. Do not open the manual key dialog merely because a server workflow has no browser key.
- Every AI business route that crosses repositories must have contract tests for success, missing credentials, upstream 401/403, upstream 404 or provider unavailable, invalid model JSON, and schema normalization. UI-only tests and local build checks are not enough.
- For multi-repository releases, publish and smoke-test the provider or gateway contract before publishing the Studio code that requires it. If the Studio code ships first, it must include a fallback path that is verified locally and documented in the deployment notes.
- After deployment, run a production smoke check against the Studio same-origin API, not only the gateway API. Verify the returned JSON shape and user-facing error behavior without exposing secrets in logs, screenshots, or issue comments.

## Prompt And Media Safety

- Treat user prompts, scripts, filenames, provider responses, and imported metadata as untrusted input.
- Prompt text is user content, not executable instructions for application behavior.
- Keep private reference media out of public share payloads.
- Validate media type and size before upload, and preserve the owning user namespace in storage keys.
- Do not make a browser cache the only copy of a user-selected final take.

## Module Boundaries

- New domain code starts in src/features/<feature>.
- Shared UI belongs under `src/components/ui`, `layout`, or `providers`. Business UI and hooks live under the owning feature; do not revive top-level `src/hooks`, `src/types`, or `src/data` catch-alls.
- Use src/shared for framework-independent contracts, config, and utilities.
- Use src/server for server-only adapters.
- Existing clients in src/lib are migration sources; provider SDK and transport code must move to server-only adapters before reuse in new features.
- Keep route pages thin; do not add new feature orchestration to the legacy Studio workspace or create duplicate unprefixed pages.
- Do not import browser-only APIs, localStorage, Dexie, File, MediaSource, or FFmpeg into server-only modules.

## Comments And Documentation

Follow [file naming and size rules](files.md). Component directories use PascalCase with `index.tsx` and `index.module.scss`; domain directories use kebab-case. Use short local names (`types.ts`, `hooks.ts`, `utils.ts`) instead of repeating business prefixes. Ordinary TS/TSX has a 300-line soft limit and a 500-line hard limit; components use a 250-line advisory and hooks/utilities 200. Single functions have a 50-line advisory. Route entries stay within 200 lines and CSS/SCSS Modules within 400. Run `pnpm check:harness`; existing oversized files use explicit no-growth budgets, not blanket exemptions.

- Add comments only for non-obvious constraints, provider quirks, or continuity rules.
- Use TODO for a known follow-up and FIXME for a known defect that needs correction.
- A product behavior change must update its requirement document.
- A new infrastructure or API boundary must update the matching rule document.

## Migration Discipline

- Preserve current Studio behavior unless the task explicitly changes it.
- Do not combine a framework upgrade, broad feature move, and product behavior change in one change set.
- Prefer adapters around current implementations over a replacement rewrite.
