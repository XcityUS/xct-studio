# React And Next Rules

Last updated: 2026-09-07

## Runtime Target

The installed runtime foundation is:

- Next.js 16.3.4
- React 19.2.8
- React DOM 19.2.8
- TypeScript strict mode
- SCSS Modules and CSS custom properties; Sass is installed and component styles use colocated `index.module.scss`; Tailwind CSS is prohibited for new/rewritten code

Read [runtime upgrade status](../architecture/runtime-upgrade-status.md) for delivered scope and remaining legacy migration. CSS Modules apply to new code; existing Tailwind UI remains explicitly deferred. Use pinned pnpm for dependency changes.

## State Ownership

Choose the narrowest owner for each piece of state:

| State | Preferred owner |
| --- | --- |
| Static product configuration | src/shared/config |
| Component-only interaction state | Component state |
| Feature workflow state | Feature hook or feature-local state |
| Browser cache and playback blobs | IndexedDB or Dexie through an owning adapter |
| Legacy browser history compatibility | Existing history hook until migration |
| Durable production data | Future server-side API and database |
| Provider job state | Server generation service; UI observes normalized status through the application API |

Do not add a global store or large Context without a demonstrated cross-feature need. Do not put durable server data permanently in Context, localStorage, or a browser store.

## Client And Server Components

Prefer Server Components. Pages, layouts, and read-only views should stay server-rendered by default. Use TypeScript (`.tsx` for components and `.ts` for supporting logic), and keep strict checking enabled.

Add `"use client"` only at the smallest boundary that needs browser capabilities such as:

- API key access
- localStorage or IndexedDB
- browser FFmpeg
- File and media element APIs
- drag-and-drop or file input
- polling application job endpoints and displaying interactive progress

Prefer server components or route handlers for:

- future database reads
- server-only provider credentials
- runtime configuration
- authenticated server actions
- static or metadata-only locale content

Keep secrets and provider SDKs in server-only services. Pass only browser-safe data to Client Components. A client-side editor or player does not require its entire parent page or layout to be a Client Component.

Never import browser-only modules into server-only code.

## AI Invocation Boundary

- Never call AI providers directly from UI components, whether Client Components or Server Components.
- Client Components and hooks invoke typed application APIs or Server Actions. These delegate to server-only business services and provider adapters.
- Server Components read application data through server services. They must not submit paid generation work during render.
- Keep provider SDKs, credentials, request mapping, and provider polling in server-only modules under `src/server`, protected from client imports.
- This applies to script writing, breakdown, prompt optimization, image/video generation, transcription, translation, TTS, and dubbing.

## Component Structure

Follow [file naming and size rules](files.md): `components/Input/index.tsx` exports `Input` and owns `index.module.scss`; `features/episode/components/Editor/index.tsx` should not repeat its full business hierarchy in its filename. Use `types.ts`, `hooks.ts`, and `utils.ts` locally when needed; extracted child components get their own directories. Components have a 250-line advisory, hooks 200, and both a 500-line hard ceiling. Functions have a 50-line advisory, including JSX. Route pages/layouts retain Next filenames and stay within 200 lines. Run `pnpm check:harness` and review responsibility even below the advisory limits.

- Keep page routes focused on composition, locale boundaries, and page-level data wiring.
- Put domain UI in src/features/<feature>.
- Keep reusable visual primitives in src/components/ui.
- Keep existing components in place until a feature owner is clear; migrate imports without behavior changes first.
- Name components with PascalCase, hooks with useXxx, and utilities with camelCase.
- Split a component when it owns more than one domain workflow or cannot be read as a single user interaction.

## Effects And Async Work

- Do not perform side effects during render.
- Keep effect dependencies complete and clean up timers, subscriptions, object URLs, and in-flight work where applicable.
- Make generation, archive, and export transitions explicit state changes.
- Keep application job polling in one owning feature hook; provider polling runs behind the server boundary.
- Handle cancellation and late completion safely; a stale request must not overwrite the current Shot or Candidate state.

## Forms And Media Interaction

- Keep form validation close to the owned feature contract.
- Prevent accidental duplicate submission for expensive generation and export actions.
- Maintain stable list keys for Scenes, Shots, Candidates, and timeline clips.
- Avoid recreating large Blob URLs or FFmpeg instances during ordinary renders.
- Keep expensive media processing behind an explicit user action and visible progress state.

## Styling And Accessibility

- MUST NOT use Tailwind CSS, utility classes, `@apply`, or Tailwind-dependent component templates.
- Use CSS Modules for component styles and shared CSS custom properties for colors, spacing, typography, and themes.
- Keep reset, base styles, and shared tokens in `src/app/globals.css`.
- Use Radix primitives and lucide-react icons where appropriate. Existing shadcn-style wrappers need their Tailwind styling replaced before reuse in new surfaces.
- Track removal of existing Tailwind dependencies, directives, tooling, and class-merging helpers as a dedicated migration with visual verification.
- Avoid large inline style objects for reusable UI.
- Provide accessible labels and keyboard behavior for dialogs, tabs, sliders, file inputs, and selection controls.
- Test dense production surfaces at desktop and narrow mobile widths.

## Next 16 Watchpoints

Validate these during the code upgrade:

- App Router generated types
- async route params and search params where used
- proxy or middleware migration requirements
- route handler behavior for /api/config and portrait routes
- CSS Module compilation and global CSS loading
- static asset paths for browser FFmpeg core assets
- hydration and Radix interaction behavior under React 19.2
