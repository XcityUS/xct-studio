# Xct Studio Harness Plan

Last updated: 2026-09-14

## Goal

Maintain a clear platform harness for staged implementation.

The target is to evolve `xct-studio` from a single-page AI video studio into a short-drama AI production platform with:

- Next.js 16 + React 19.2 as the frontend runtime target
- TypeScript throughout application and Worker code
- CSS Modules and CSS custom properties, with no Tailwind CSS
- Server Components by default, with focused client interaction boundaries
- Server-only AI services and provider adapters accessed through application APIs or Server Actions
- `next-intl` locale routing for `/zh` and `/en`
- IP / character / asset continuity as first-class product structure
- Episode / scene / shot production flow as first-class product structure
- A directory layout that can absorb existing generation, archive, community, and editing code without a full rewrite

This document defines target ownership. The runtime/i18n foundation is now implemented; see [runtime upgrade status](runtime-upgrade-status.md) for delivered work and explicitly deferred migrations.

## Current Baseline

Current `xct-studio` is a focused Next application:

```text
xct-studio/
├── src/
│   ├── app/                 # App Router shell and API routes
│   ├── components/          # Studio UI components
│   ├── hooks/               # Browser state, job polling, history sync
│   ├── lib/                 # AI gateway clients, archive client, media utilities
│   └── types/               # Shared frontend types
├── media-worker/            # Cloudflare Worker + R2 storage endpoints
├── bench/                   # Benchmarks
└── docs/                    # Existing roadmap / release notes
```

Current strengths:

- Seedance video generation through TokenHub
- image generation through TokenHub when configured
- prompt optimization and script breakdown
- reference image / video / audio upload
- browser-side FFmpeg assembly
- R2 media archive
- share page, community review, authorization review
- basic cloud state sync via the media worker
- authenticated PostgreSQL business persistence through `/api/business`
- owner isolation, revisions, transactional writes, tombstones, and persisted queue claims

Current platform gaps:

- the cloud business schema remains a compatibility-oriented record layer rather than a fully typed relational Project / IP / Episode model
- provider submission and polling are still browser-driven; persisted queue claims are not yet an independent server-side worker
- complete immutable shot/candidate/selection and Episode Version semantics remain pending
- deep production forms are not fully translated yet
- domain-state and provider-boundary test coverage remains pending beyond the installed foundation tests

Existing Tailwind styles, browser-side AI clients, and `media-worker/index.js` must be migrated to meet [the required engineering baseline](../rules/core-conventions.md). These are current implementation facts, not target conventions.

## Target Harness Layout

The target layout keeps the current app small while giving future platform work stable landing zones.

```text
xct-studio/
├── docs/
│   ├── architecture/
│   ├── harness/
│   ├── requirements/
│   └── rules/
├── src/
│   ├── app/
│   │   ├── [locale]/        # active /zh and /en route segment
│   │   ├── api/             # existing Next route handlers
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── features/
│   │   ├── ip/              # IP, character, continuity, reference packs
│   │   ├── episode/         # episode, scene, shot pipeline
│   │   ├── script/          # script authoring, versions, breakdown input
│   │   ├── generation/      # video/image/audio generation orchestration
│   │   ├── assets/          # media assets, authorization, portrait library
│   │   ├── post-production/ # assembly, captions, BGM, export
│   │   ├── localization/    # subtitle, translation, dubbing versions
│   │   ├── community/       # share, plaza, review flow
│   │   └── settings/        # runtime config, API key, user preferences
│   ├── i18n/
│   │   ├── messages/
│   │   └── routing/
│   ├── server/              # server-only business services and AI provider adapters
│   ├── shared/
│   │   ├── config/
│   │   ├── contracts/
│   │   └── utils/
│   ├── components/          # existing shared UI and legacy studio components
│   ├── hooks/               # existing hooks, gradually migrated by feature
│   ├── lib/                 # existing libs, gradually split by feature/shared/server
│   └── types/
├── tests/
│   ├── features/
│   ├── harness/
│   └── i18n/
└── media-worker/
```

## Migration Principle

Do not rewrite the current Studio in one pass.

Use the harness as a staged migration boundary:

1. Preserve the legacy workflow now held in `src/features/studio/components/StudioWorkspace/index.tsx`; its move from `src/app/page.tsx` is not a completed feature split.
2. Keep the installed Server Component locale shell thin and isolate future browser interactions by feature.
3. Move UI strings behind `next-intl` incrementally.
4. Migrate existing styling to CSS Modules, remaining runtime JavaScript to TypeScript, and AI transport to server-only services in separate reviewable steps.
5. Evolve the delivered compatibility persistence records into typed IP / Episode domain contracts and migrations.
6. Move existing components into `src/features/*` only when their ownership is clear.
7. Move provider submission and polling onto the delivered server persistence/queue foundation after the typed execution contract is stable.

## Next.js 16 Upgrade Intent

Target dependency family:

- `next`: `^16`
- `react`: `19.2.x`
- `react-dom`: `19.2.x`
- `next-intl`: current compatible release at implementation time

Upgrade concerns to validate during the code phase:

- App Router behavior and generated types
- route params/search params async behavior if applicable
- middleware/proxy naming requirements for Next 16
- CSS Module compilation and global CSS loading
- browser FFmpeg asset serving under the new build
- R2 worker config fetch through `/api/config`
- existing API route behavior under Next 16

## Locale Routing Intent

Supported public locales:

- `/zh`
- `/en`

Default locale:

- `zh`

Expected behavior:

- `/` redirects or rewrites to `/zh`
- `/zh` renders the Chinese product surface
- `/en` renders the English product surface
- share/community pages should preserve locale where possible
- generated media URLs remain locale-independent

## Feature Ownership

### IP

Owns:

- IP profile
- character profile
- reference asset pack
- wardrobe / look version
- scene style pack
- continuity rules

Does not own:

- raw R2 upload transport
- model request execution
- final assembly

### Episode

Owns:

- episode metadata
- active script version reference (script authoring belongs to Script)
- scenes
- shots
- shot states
- candidate selection
- final episode version references

Does not own:

- low-level video client
- cloud storage transport
- global community moderation

### Script

Owns:

- script drafts and versions
- character and beat extraction input
- AI co-writing assistance
- script-to-scene and script-to-shot breakdown requests

Does not own:

- final prompt execution
- selected-take assembly

### Localization

Owns:

- subtitle tracks
- script translation drafts
- subtitle translation drafts
- dubbing and voice-language metadata
- localized Episode Version relationships

Does not own:

- UI route locale configuration
- source Episode ownership

### Generation

Owns:

- prompt assembly
- model parameters
- batch generation plan
- job status normalization
- retry and cost metadata

Migrate provider transport from the existing `VideoService` into server-only adapters. `useVideoJobs` and feature UI should submit and poll through the application's API. Provider SDKs must not enter the client bundle or UI component implementations.

### Assets

Owns:

- uploaded reference media
- archived generated media
- portrait / verified-person library
- authorization flow integration

Initially this wraps `media-archive.ts`, `portrait.ts`, and `authorization.ts`.

### Post Production

Owns:

- clip assembly
- trim
- BGM
- captions
- TTS
- watermark
- export presets
- NLE export

Reuse browser assembly and NLE utilities where appropriate. Any provider-backed caption or TTS operation from `captions.ts` or `tts.ts` must execute through server-only AI services.

## Harness Success Criteria

The harness phase is complete when:

- documentation defines the target module boundaries
- future directories exist
- i18n rules are documented
- Next 16 upgrade steps are documented
- no current behavior is changed
- subsequent code tasks can be implemented feature by feature
