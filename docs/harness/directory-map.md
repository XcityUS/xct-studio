# Directory Map

Last updated: 2026-09-07

This file defines current directory ownership and identifies future short-drama landing zones. Folder presence does not imply a delivered production feature.

New application and Worker implementation must use TypeScript. New component styles live in colocated CSS Modules with shared CSS custom properties; Tailwind CSS is prohibited. Existing JavaScript Worker and Tailwind UI are explicit migration debt, not compliant examples. See [core conventions](../rules/core-conventions.md).

## Existing Directories

```text
src/app
```

Next App Router. `/zh` and `/en` compose the existing Studio through thin Server Components under `src/app/[locale]`; APIs stay under `src/app/api`. There is only one portrait callback page, under `[locale]`. `src/proxy.ts` redirects `/` and the legacy `/portrait-callback` to default-locale routes without losing query parameters or intercepting media/API paths.

```text
src/components
```

Shared UI only: `ui` for primitives, `layout` for the application shell, and `providers` for cross-application UI context. Generation, assets, script, community, post-production, settings, and the Studio composition now live in their owning features.

Use `components/ui/Input/index.tsx` plus `index.module.scss`, or `features/<domain>/components/Editor/index.tsx` plus its colocated style. PascalCase component folders hold short local `types.ts`, `hooks.ts`, and `utils.ts` files as needed. Sass is installed. All previous CSS Modules now use SCSS; legacy Tailwind components are still pending style migration, not supplied with empty stylesheet placeholders.

```text
src/features/<feature>/hooks
```

Browser hooks now live under `assets`, `generation`, and `settings`. The top-level `src/hooks`, `src/types`, and `src/data` catch-alls have been retired. Shared video/cost contracts are in `shared/contracts`; community gallery data belongs to `features/community/gallery`.

```text
src/lib
```

Closed legacy-client allowlist: `openai-client.ts`, `video-service.ts`, `image-service.ts`, `prompt-optimizer.ts`, `script-breakdown.ts`, `tts.ts`, `captions.ts`, and `media-archive.ts`. Their existing transport behavior remains compatible until the server migration. New files are blocked here; helpers/storage now belong to `src/features/*`, `src/shared/*`, or `src/server/*`.

```text
media-worker
```

Cloudflare Worker that owns R2 media, shares, community review, authorization review, and cloud state endpoints.

## Application And Domain Directories

```text
src/app/[locale]
```

Active locale route segment for `/zh` and `/en`. Pages/layouts are Server Components. `src/features/studio/components/StudioWorkspace/index.tsx` retains legacy browser orchestration with extracted share, finalize, reference, type, and helper modules. This is not a completed workflow decomposition.

```text
src/features/studio/components/StudioWorkspace
```

Cross-feature workstation composition, not a new business domain. Compose the existing feature views here; put new production logic in the appropriate domain below. Do not grow the oversized legacy entry.

```text
src/i18n/messages
```

Active flat `zh.json` and `en.json` dictionaries for shell/settings/callback, creation, prompt/shot controls, references, VideoOutput, history, and community copy. Keys are normalized English copy without nested objects or semantic namespaces; see [i18n rules](../rules/i18n.md). Asset-library, assembly, and remaining image/remix/finalize dialog extraction remains pending.

```text
src/i18n/routing
```

Active routing config. Adjacent `navigation.ts`, `request.ts`, and `global.d.ts` own localized navigation, message loading, and TypeScript augmentation.

```text
src/features/ip
```

Planned IP continuity domain (landing zone, not implemented):

- IP profile
- character profile
- visual reference pack
- wardrobe/look versions
- scene style memory
- continuity scoring hooks

```text
src/features/episode
```

Planned Episode production domain (landing zone, not implemented):

- episode
- active script version reference (authoring belongs to `script`)
- scene
- shot
- candidate references and selection (execution belongs to `generation`)
- selected take
- final version

```text
src/features/script
```

Script development domain. Prompt templates/guards and existing inspiration/shot-builder UI are here; durable versioned authoring remains planned:

- script editor
- script import
- script versions
- character and story beat extraction
- breakdown input and review

```text
src/features/generation
```

Existing creation, image, remix, output, history, and finalize UI plus job/history hooks are here. Cost/progress calculations are owned by this feature; the model catalog is shared config. Provider transport remains a separate migration into `src/server`; do not extend existing browser AI calls.

Responsibilities:

- typed application requests for video and image generation
- prompt injection
- batch queue plan
- normalized application job status display
- cost estimate integration

```text
src/features/assets
```

Existing assets panel, reference inputs, callback, authorization/portrait application clients, IndexedDB storage, media helpers, and archive/source hooks. Asset domain:

- uploaded references
- archived generated media
- audio references
- portrait assets
- authorization evidence

```text
src/features/post-production
```

Existing assembly editor, browser FFmpeg assembly client, and NLE export helpers are here. Captions/TTS transports remain legacy `src/lib` migration work. Post-production domain:

- clip assembly
- captions
- TTS
- BGM
- watermark
- export presets
- NLE handoff

```text
src/features/localization
```

Planned language-release domain (landing zone, distinct from installed UI localization):

- subtitle tracks
- translation drafts
- dubbing and TTS language variants
- localized episode versions
- localization review state

```text
src/features/community
```

Community and growth loops:

- share links
- plaza publish flow
- review queue
- recreate/remix links

```text
src/features/settings
```

Settings and runtime configuration:

- API key gate
- SSO state
- runtime `/api/config`
- user preferences
- locale switcher

```text
src/server
```

Runtime config, the xcity-litellm provider-asset proxy, and portrait route guards currently live here with `server-only`. BytePlus signing and AK/SK credentials belong to xcity-litellm, not this frontend repository. Future prompt optimization, script breakdown, generation, translation, transcription, TTS, and dubbing services belong behind application APIs/Server Actions. Do not infer those future services already exist.

```text
src/shared/contracts
```

Shared stable video, cost, and public runtime-config contracts used across features. Keep runtime business-feature imports out.

```text
src/shared/config
```

Shared constants and configuration maps, including the existing Seedance catalog consumed by contracts, pricing, and generation.

```text
src/shared/utils
```

Shared framework-independent utilities.

```text
tests/harness
tests/i18n
tests/features
```

Active policy/config/routing tests plus extracted Studio transformations, Input/Textarea/Slider component contracts, settings presentation, and VideoOutput lifecycle/error localization. New domain behavior tests go under the owning `tests/features/<domain>`.

```text
scripts/harness
scripts/check-harness.ts
docs/harness/file-size-baseline.json
```

Executable directory/naming/SCSS ownership and source-size policy, AST import-graph/function inspection, pnpm metadata checks, and nine explicit no-growth legacy budgets. `scripts/harness/i18n` owns English-key normalization, flat dictionary validation, and AST translation-call checks; `inspect-i18n.ts` connects them to the same blocking gate. Run `pnpm check:harness`; business acceptance remains governed by `docs/rules/business.md`. See [migration status](../architecture/runtime-upgrade-status.md) for remaining styling, provider, and oversized-file debt.
