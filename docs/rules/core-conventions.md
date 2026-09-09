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
