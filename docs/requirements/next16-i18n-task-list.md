# Next 16 And i18n Task List

Last updated: 2026-09-07

The framework/i18n foundation is implemented. The user explicitly deferred broad legacy styling/provider migration and new business features. See [verified status and limitations](../architecture/runtime-upgrade-status.md).

## Phase 0: Harness Documentation

- [x] Create target docs directories.
- [x] Create future source/test directories.
- [x] Document target harness layout.
- [x] Document short-drama platform object model.
- [x] Document i18n rules.
- [x] Document Next 16 upgrade checklist.

## Phase 1: Dependency Upgrade

- [x] Upgrade `next` to pinned `16.3.4`.
- [x] Upgrade `react` to `19.2.8`.
- [x] Upgrade `react-dom` to `19.2.8`.
- [x] Add `next-intl` 4.14.2.
- [x] Refresh lockfile.
- [x] Pin pnpm 10.34.5 and migrate to `pnpm-lock.yaml` with Node 22.18+.

Validation:

- [x] `pnpm build`
- [x] `pnpm lint` (35 explicit legacy warnings, no errors)
- [x] `pnpm typecheck`, `pnpm test`, and `pnpm check:harness`
- [x] start local dev server
- [x] smoke test current Studio page
- [x] smoke test `/api/config`
- [x] smoke test video generation form render (no paid submission)
- [x] smoke test FFmpeg core JS/WASM asset paths (HTTP availability, not full export)

## Phase 2: Locale Routing Shell

- [x] Add `src/i18n/routing` config.
- [x] Add `src/i18n/messages/zh.json`.
- [x] Add `src/i18n/messages/en.json`.
- [x] Add locale-aware root route behavior with Server Component pages and layouts and focused client interaction boundaries.
- [x] Add `/zh` route.
- [x] Add `/en` route.
- [x] Preserve current `/api/*` routes.
- [x] Preserve media/share URLs outside locale routing.

Validation:

- [x] `/` reaches the default Chinese surface.
- [x] `/zh` renders the existing Studio.
- [x] `/en` renders the existing Studio.
- [x] unsupported locale returns 404.
- [ ] generation can be initiated from both locale surfaces; validate the server AI boundary during Phase 3A.

## Phase 3: Message Extraction

- [x] Extract shell/navigation strings.
- [x] Extract API key gate/dialog strings.
- [x] Extract top-level tabs, sharing, callback, and not-found strings.
- [x] Extract creation form strings and its owned character/reference controls.
- [x] Extract VideoOutput-owned copy, status badges, metadata, player label, prompt-copy tooltip, and known sanitized error messages using flat English-copy keys; use ArtPlayer's built-in English/Simplified Chinese controls.
- [x] Extract history panel strings, dialogs, title actions, statuses, and locale-aware dates.
- [ ] Extract asset/community strings. Community and gallery presentation are complete; the asset-library panel remains.
- [ ] Extract assembly editor strings.
- [ ] Extract remaining image/remix/finalize and prompt/shot-builder dialog strings. Prompt inspiration and shot builder are complete; image/remix/finalize remain.

Production content such as prompts, model identifiers, dimensions, media references, and action payloads remains unchanged in either UI locale. Unknown runtime errors still follow the existing sanitizer fallback; the stable server error-code protocol remains Phase 3A work. Current localization does not mark the asset library, assembly editor, remaining generation dialogs, or full legacy style migration complete.

Validation:

- [x] `zh.json` and `en.json` have identical key sets and valid ICU messages.
- [x] Replace all 72 legacy message paths with 69 unique normalized English-copy keys; migrate all callers without nested objects or compatibility aliases.
- [x] Enforce flat dictionaries, normalization/collision rules, key parity, root translators, and static keys in `pnpm check:harness` and Quality CI; cover rejection cases in tests.
- [ ] no new user-facing English literals are added to components without translation.
- [ ] dynamic server message keys are mapped through stable frontend mappings.

## Phase 3A: Engineering Baseline Migration

- [ ] Replace legacy Tailwind styles and UI wrappers with CSS Modules and shared CSS custom properties.
- [ ] Remove Tailwind dependencies, directives, utility classes, plugins, and class-merging helpers after their usages are replaced.
- [ ] Migrate remaining application and Worker runtime JavaScript to TypeScript and enable strict type checking for those paths.
- [ ] Move provider SDKs and all AI requests to server-only business services and adapters.
- [ ] Route browser generation submission and polling through typed application APIs or Server Actions.
- [ ] Keep paid AI work out of component rendering, including Server Component rendering.

Validation:

- [ ] UI components and browser hooks have no provider SDK imports or direct provider requests.
- [ ] mocked server API checks cover generation, breakdown, translation, and TTS.
- [ ] CSS Modules preserve theme, dialogs, editors, and media controls on desktop and mobile in both locales.
- [ ] TypeScript checks, lint, and build pass after each migration step.

## Phase 4: Feature Folder Migration

- [x] Move settings gate/dialog and locale switcher into `src/features/settings`.
- [x] Move portrait callback UI into `src/features/assets`; keep one locale page and normalize the legacy path in the proxy, without duplicate wrappers.
- [x] Extract server-only public runtime config and its shared contract.
- [x] Preserve the old page in `src/features/studio/components/StudioWorkspace/index.tsx`; keep locale entries thin. This does not complete its feature split.

- [ ] Move IP/character-related types and helpers into `src/features/ip`.
- [x] Move existing generation UI, job/history hooks, progress, and cost helpers into `src/features/generation`.
- [ ] Replace legacy generation clients with typed application API clients and move provider transport into `src/server`.
- [ ] Move episode/shot draft types into `src/features/episode`.
- [x] Move existing assembly UI, browser FFmpeg assembly client, and NLE export helpers into `src/features/post-production`.
- [x] Move asset UI, storage/source/archive hooks, and authorization/portrait application wrappers into `src/features/assets`.
- [ ] Migrate the remaining legacy media-archive transport in `src/lib/media-archive.ts` with its application/server boundary.
- [x] Move community/gallery UI, data, and helpers into `src/features/community`.
- [ ] Extract remaining share transport/state from the legacy Studio workspace; moving community UI alone does not complete this.

Validation:

- [ ] no behavior change from imports-only moves.
- [x] App Router build stays green after the scoped feature moves and VideoOutput localization.
- [ ] generation initiated from the browser works through the server application API.
- [ ] media archive and asset list still work.

## Phase 5: Episode Pipeline MVP

- [ ] Add IP profile draft model.
- [ ] Add character profile draft model.
- [ ] Add episode draft model.
- [ ] Add scene/shot draft model.
- [ ] Convert script breakdown output into editable shots.
- [ ] Allow each shot to generate multiple candidates.
- [ ] Allow candidate selection per shot.
- [ ] Feed selected takes into assembly.

Validation:

- [ ] one script can become multiple shots.
- [ ] each shot can generate at least one candidate.
- [ ] user can select one take per shot.
- [ ] selected takes can be assembled into an episode export.

## Phase 6: Persistence Upgrade

- [ ] Decide whether R2 JSON state remains enough for MVP or introduce a database.
- [ ] If adding a database, define workspace/project/IP/episode/shot/job tables first.
- [ ] Keep localStorage/IndexedDB as cache, not source of truth.
- [ ] Preserve migration path for existing `soraVideoHistory` users.

Validation:

- [ ] old history still appears.
- [ ] new episode data survives reload.
- [ ] cloud sync conflict behavior is deterministic.
