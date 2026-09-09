# Xct Studio Platform Task List

Last updated: 2026-09-07

This is the product-level implementation sequence. The more detailed Next 16 and i18n checklist remains in requirements/next16-i18n-task-list.md.

## Current Progress

The runtime, locale shell, flat-key enforcement, and existing component ownership are delivered. Studio tabs now have durable locale-prefixed paths while sharing one persistent workspace implementation. The current reference flow also models provider Asset ID admission and separate public-figure/IP authorization gates. This is foundation work, not delivery of the full IP/Episode production model.

Next bounded UI task: translate the asset library, assembly editor, and remaining image/remix/finalize generation dialogs. Keep provider/server migration, full styling migration, and new domain/persistence work as explicit separate phases below. Directory presence and documented contracts do not count as working business features.

## Phase 0: Documentation And Harness

- [x] Create architecture, requirements, harness, and rules directories.
- [x] Define target feature folders.
- [x] Define IP, Episode, Scene, Shot, Candidate, and Selected Take terminology.
- [x] Define integrated short-drama production scope.
- [x] Define IP continuity and Episode Pipeline specifications.
- [x] Define reference-project roles and short-drama business constraints in `docs/rules/business.md`.
- [x] Add automated naming and file-length checks with an explicit no-growth legacy baseline and CI gate.
- [x] Pin pnpm and document/install its constraints.
- [x] Define PascalCase component directories with `index.tsx` / `index.module.scss`, short local filenames, and no repeated business prefixes.
- [x] Migrate flat components, colocate supporting modules, update import paths, and assign business UI/hooks/helpers to owning features.
- [x] Install Sass with pnpm and migrate existing CSS Modules to owned SCSS Modules; convert Input/Textarea primitives without changing their public props.
- [x] Enforce component entries, stylesheet ownership, retired directory restrictions, pnpm pins, and literal local client/server import boundaries in Harness tests and CI.

## Phase 1: Runtime Upgrade

- [x] Upgrade Next.js to version 16.
- [x] Upgrade React and React DOM to 19.2.x.
- [x] Add next-intl.
- [x] Refresh the pnpm lockfile.
- [x] Verify build, lint (legacy warnings retained), dev startup, Studio rendering, public config, and FFmpeg asset availability. Authenticated API workflows remain untested.

## Phase 2: Chinese And English UI Shell

- [x] Add zh and en routes with Chinese as the default, using Server Component pages and layouts with focused client interaction boundaries.
- [x] Add centralized message files with matching keys.
- [x] Move navigation and shell copy behind translations.
- [x] Translate VideoOutput lifecycle, recovery, task metadata, and known error copy; centralize full playback on ArtPlayer with built-in English/Simplified Chinese controls while preserving production content and action restrictions.
- [x] Translate creation, prompt inspiration, shot builder, reference input, history, and community UI with flat normalized keys and locale-aware dates.
- [x] Keep /api, media, and share URLs outside locale matching; preserve the legacy Studio implementation.
- [x] Give Video, Image, Assets, and Community durable locale-prefixed paths without duplicating the workspace implementation.
- [ ] Complete translation extraction from deep production forms.

## Phase 2A: Engineering Baseline Migration

- [ ] Migrate legacy Tailwind styling and UI wrappers to CSS Modules with shared CSS custom properties.
- [ ] Remove Tailwind dependencies, directives, utility classes, plugins, and class-merging helpers once replaced.
- [ ] Migrate remaining application and Worker runtime JavaScript to TypeScript with strict checking.
- [ ] Move AI provider transport and SDKs into server-only business services and adapters under `src/server`.
- [ ] Make UI components and browser hooks use typed application APIs or Server Actions for all AI operations.
- [ ] Verify Server Component boundaries, mocked AI requests, and CSS Module layouts in both locales before marking this phase complete.
- [ ] Split the legacy Studio workspace and oversized feature files by responsibility; record compatibility-only moves without marking the split complete.
- [x] Extract independent children/types/helpers from seven legacy components; reduce VideoOutput below 500 lines, remove its baseline entry, and lower the six other component budgets. Nine oversized files remain.
- [ ] Resolve the 35 scoped legacy React warnings and remove their temporary ESLint warning overrides.

## Phase 3: Domain Contracts And Draft State

- [ ] Add product contracts for IP, Character Version, Script Version, Episode, Scene, Shot, Candidate, Episode Version, Subtitle Track, and Export.
- [ ] Add mock or browser-draft adapters before adding durable persistence.
- [ ] Map existing history items to Candidate-compatible contracts without breaking history.
- [ ] Keep current creation and assembly flows working through adapters.

## Phase 4: IP Asset Library

- [x] Require active Asset IDs for non-exempt references and retain the Studio/Seedream provenance exemption.
- [x] Add a typed Asset ID intake path for reviewed, official, virtual, real-person, public-figure, and protected-IP material.
- [x] Require approved authorization in addition to Asset ID for public figures and protected IP.
- [x] Connect the KYC High private virtual and real-human list/upload/review APIs through server-only provider adapters.
- [x] Let no-person and external-AI references submit provider review inline, retain Processing/Failed state, and admit only Active Asset IDs.
- [x] List the signed-in user's BytePlus assets from owned provider groups and merge them into the main Assets grid with review state and Asset ID references.
- [x] Reuse the existing Xcity cloud URL when a `/video` reference is submitted for review; replace it with `asset://<assetId>` only after the provider reports `Active`.
- [ ] Persist admitted-asset review state, subject coverage, revocation, and authorization records outside browser history.
- [ ] Add IP list and IP profile.
- [ ] Add Character profiles and Character Versions.
- [ ] Add ordered reference packs, wardrobe, location, prop, and style assets.
- [ ] Add Episode-level and Scene-level continuity locks.
- [ ] Record reference snapshots on every candidate generation.

## Phase 5: Script And Storyboard

- [ ] Add script editor, import, and versions.
- [ ] Add AI-assisted outline, scene, and dialogue drafts.
- [ ] Convert a Script Version into editable Scenes and Shots.
- [ ] Add storyboard cards and reorder, split, merge, and manual edit actions.
- [ ] Add practical Shot fields and advanced prompt controls.

## Phase 6: Generation And Selection

- [ ] Add director-agent planning, editable draft review, approved batch budgets, and stage-level recovery per `docs/rules/business.md`.

- [ ] Connect the generation feature to server video and image services through typed application APIs; keep provider SDKs out of UI components and browser hooks.
- [ ] Submit generation from a Shot and retain an attempt record.
- [ ] Support multiple Candidates per Shot.
- [ ] Add candidate comparison, rejection reasons, selected take, and lock state.
- [ ] Show model status, cost, and failure recovery in Shot context.

## Phase 7: Assembly And Captioning

- [ ] Create Episode Versions from selected takes.
- [x] Move existing assembly UI, browser FFmpeg assembly client, and NLE export helpers into post-production ownership.
- [ ] Migrate remaining captions/TTS/BGM orchestration and legacy transports with the application/server boundary.
- [ ] Add editable source subtitle tracks.
- [ ] Preserve current browser-side FFmpeg behavior during the migration.

## Phase 8: Localization

- [ ] Add source and target content locales to scripts, subtitles, audio tracks, and exports.
- [ ] Add translated subtitle draft and review workflow.
- [ ] Add target-language TTS or dubbing metadata.
- [ ] Add localized Episode Versions and bilingual export options.
- [ ] Keep UI locale independent from content locale.

## Phase 9: Durable Persistence And Operations

- [ ] Choose and design a server-side production database.
- [ ] Introduce workspace ownership, migrations, concurrency behavior, and backups.
- [ ] Move local browser storage to cache and migration compatibility roles.
- [ ] Add job idempotency and durable retry behavior.
- [ ] Add telemetry, failure dashboards, and operational release checks.
