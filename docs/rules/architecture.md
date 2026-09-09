# Xct Studio Architecture Rules

Last updated: 2026-09-07

## Engineering Baseline

Follow [core conventions](core-conventions.md): TypeScript is mandatory, Tailwind CSS is prohibited for new/reworked code, Server Components are preferred, UI components must never call AI providers directly, and the pinned pnpm version is required.

Use CSS Modules and CSS custom properties. Client UI reaches AI capabilities through application APIs or Server Actions backed by server-only services and provider adapters. Server Components consume application services and do not execute generation during render.

## Current Rule

Do not turn the harness into a rewrite.

The current Studio is production-shaped enough to preserve:

- TokenHub model capabilities and user-visible generation behavior, with AI transport migrated to the server
- SSO/API key behavior
- media worker integration
- history sync
- reference upload
- video generation
- assembly/export
- share/community/authorization flows

## Module Boundaries

New platform code should land in `src/features/*` first.

Let directories carry domain context: `features/episode/components/Editor/index.tsx` with `index.module.scss`, not a flat `episode-script-storyboard-editor.tsx`. Component folders use PascalCase; domain folders stay kebab-case. Local supporting files use short responsibility names. Flat component migration is complete; follow [file rules](files.md) to prevent regression.

`src/lib` is closed to new files and retains only eight named legacy transport clients. Stable utilities, contracts, browser storage, and feature helpers have moved to their owning directories. Do not create new catch-all directories to bypass this boundary.

Use `src/shared/*` for stable contracts and framework-independent helpers.

Use `src/server/*` for server-only business services and provider adapters. Client-facing feature code must not import provider SDKs or server-only implementations.

Do not import browser-only modules into `src/server`.

## App Router

- Keep API routes under `src/app/api`.
- Put locale pages under `src/app/[locale]`.
- Do not duplicate pages outside `[locale]`. Normalize legacy page paths through `src/proxy.ts`, preserving their query parameters and excluding API/media/static paths.
- Prefer Server Components for pages and layouts; keep interactive editors, players, and upload controls within focused Client Components.
- Keep global CSS in `src/app/globals.css`.
- Use colocated CSS Modules for component styles, without Tailwind CSS.
- The locale shell is installed. Keep `src/features/studio/components/StudioWorkspace/index.tsx` as a compatibility boundary until its feature-by-feature split; do not add new orchestration there.
- `features/studio` composes existing feature screens. It must not become a new owner of IP, script, generation, assets, or export domain logic; extracted pure share/finalize/reference helpers are local compatibility modules until the corresponding workflow migration.

## Worker Boundary

`media-worker` owns:

- R2 media access
- asset listing/deletion
- share records
- community records
- authorization records
- cloud state JSON

The Next app should not duplicate worker storage rules.

## Short-Drama Domain Boundary

Apply [short-drama business rules](business.md). Use AIDrama Studio as the product-structure reference, Storyboard Forge for workflow, StoryMind for director/agent design, and Nautilus Studio for continuity. These user-selected reference roles do not authorize copying an unverified implementation or replacing the current architecture; KupkaProd is not the primary architecture reference.

The domain flow is:

```text
IP -> Script Version -> Episode -> Scene -> Shot -> Candidate -> Selected Take -> Episode Version -> Localized Version -> Export
```

Do not model production only as a flat history list.

Existing history records can be reused as candidate records during migration.

## Upgrade Rule

Next 16 / React 19.2 upgrade must be isolated from feature work.

Order:

1. dependency upgrade
2. build/lint fix
3. i18n shell
4. translation extraction
5. engineering baseline migration: CSS Modules, remaining runtime TypeScript, and server AI boundary
6. feature migration
7. Episode Pipeline
