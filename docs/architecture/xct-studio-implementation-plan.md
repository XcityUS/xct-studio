# Xct Studio Implementation Plan

Last updated: 2026-09-07

> 2026-09-10 P0 planning update: follow [Short-drama P0 Implementation Plan](short-drama-p0-implementation-plan.md) for the current delivery. Its scope follows the latest P0 requirements: server persistence and durable execution precede the production UI; full selection/assembly/localization follow P0. The stages below remain historical integrated-platform context, not the current P0 execution order.

## Outcome

Evolve the current Studio into an integrated short-drama production workstation without replacing working generation, archive, or assembly behavior in one rewrite.

The target user journey is:

```text
IP Assets -> Script -> Storyboard -> Generate -> Select -> Assemble -> Subtitle / Localize -> Export
```

## Current Code To Target Ownership

| Current code | Target owner | Migration rule |
| --- | --- | --- |
| src/features/studio/components/StudioWorkspace/index.tsx (formerly src/app/page.tsx) | Interactive feature components beneath the installed Server Component locale shell | The compatibility move is complete; extract browser interactions by responsibility next. |
| src/lib/script-breakdown.ts and features/script/components/ShotBuilderDialog | features/script, features/episode, and src/server | Editing UI is feature-owned; move AI breakdown calls to server services. |
| src/lib/video-service.ts and features/generation/hooks/use-video-jobs.ts | features/generation and src/server | Hooks are feature-owned; server job APIs remain a separate migration. |
| src/lib/media-archive.ts and features/assets/{portrait,authorization}/api.ts | features/assets | Application clients have moved; split the remaining Worker client without changing storage semantics. |
| features/post-production/{components/AssemblyEditor,assembly/client.ts,export/nle.ts} and src/lib/{captions,tts}.ts | features/post-production and src/server | Browser assembly/export is feature-owned; execute AI caption and TTS requests on the server in the next migration. |
| video history and local cache hooks | features/episode and features/assets | Preserve legacy history while mapping it to Candidates. |
| community and share components | features/community | Keep publication separate from production ownership. |
| installed messages and locale routing | src/i18n and app/[locale] | Separate UI locale from Episode content locale; translate deep production forms incrementally. |

## Staged Delivery

Stages 1 and 2 now have an implemented foundation; see [runtime upgrade status](runtime-upgrade-status.md). The user explicitly deferred broad legacy styling/AI transport migration and new production functionality. Apply [business rules](../rules/business.md) when those later stages begin.

### Stage 1: Runtime Confidence

Upgrade Next.js, React, React DOM, and add next-intl in an isolated change. Validate the current Studio, Worker configuration, route handlers, and FFmpeg assets before feature work.

### Stage 2: Locale Shell

Add Chinese and English UI routes using Server Component pages and layouts with focused Client Components for browser interactions. Translate shell copy first and keep /api, media, share, and provider URLs locale-independent.

### Stage 2A: Engineering Baseline Migration

Directory entries, feature ownership, SCSS ownership, and Harness enforcement are implemented. Seven large components have initial responsibility-based extractions; nine oversized files and the migrations below remain open. See the exact budgets and current paths in [runtime status](runtime-upgrade-status.md).

Apply the required baseline before reusing legacy implementations in new short-drama features:

1. Replace existing Tailwind styles and component wrappers with CSS Modules and CSS custom properties, then remove Tailwind dependencies and tooling. Verify layout and interaction at desktop and mobile widths in both locales.
2. Migrate remaining application and Worker runtime JavaScript to TypeScript with strict type checking.
3. Move all AI provider transport and SDK usage into server-only services and adapters. UI components and browser hooks use application APIs or Server Actions; Server Components consume application services for reads. Verify generation, breakdown, translation, and TTS using mocked provider responses.

Each migration is a separate reviewable code change. Server AI services can be introduced before a business database or durable queue.

### Stage 3: Product Contracts

Create typed IP, Character Version, Script Version, Episode, Scene, Shot, Candidate, Selected Take, Subtitle Track, Episode Version, and Export contracts. Use adapters and draft persistence before choosing a database.

### Stage 4: IP And Script

Build the IP asset library, character reference packs, script editor, and script versioning. Add the automatic script-to-scene-and-shot breakdown with manual review.

### Stage 5: Shot Production

Make storyboard cards the working unit for generation. Inject locked continuity context, generate multiple Candidates, retain attempt metadata, and select one take per Shot.

### Stage 6: Assembly And Language Releases

Create Episode Versions from selected takes. Move existing caption, TTS, BGM, assembly, and export capabilities behind post-production ownership. Add translated subtitle tracks and localized Episode Versions.

### Stage 7: Durable Platform Data

After the user workflow is stable, introduce a server-side database, multi-device state, job idempotency, and operational metrics. R2 remains binary object storage.

## Non-Negotiable Boundaries

- Use TypeScript for implementation and CSS Modules for component styling; Tailwind CSS is prohibited.
- Prefer Server Components and keep browser interaction boundaries focused.
- Never call AI providers directly from UI components or browser hooks; provider calls belong to server-only services.
- Do not make local browser cache the source of truth for completed productions.
- Do not make one global React store own every production state.
- Do not couple UI routing locale to a script or subtitle language.
- Do not let a Character Version change alter an already selected take.
- Do not expose private references in a public share payload.
- Do not combine framework upgrade, mass file migration, and behavior change in one step.

## Definition Of Done For The Integrated MVP

The MVP is complete when a creator can create an IP, author or import a script, approve an automatic storyboard, generate and choose one take per Shot, assemble a version, create source and translated subtitles, and export the result with all production relationships retained.
