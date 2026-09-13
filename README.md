# <img src="./public/logo.png" alt="Xcity" width="40" height="41" style="vertical-align: middle; margin-right: 8px;"> Xcity Video Studio

[![CodSpeed](https://img.shields.io/endpoint?url=https://codspeed.io/badge.json)](https://app.codspeed.io/XcityUS/xct-studio?utm_source=badge)

AI video (and image) generation studio for [xcity.ai](https://xcity.ai) — ByteDance **Seedance** models served through the Xcity **TokenHub** gateway, running live at [studio.xcity.ai](https://studio.xcity.ai).

Forked from [alasano/sora-2-playground](https://github.com/alasano/sora-2-playground) and rebuilt around the Xcity platform: unified SSO keys, direct-to-gateway browser calls, permanent media storage on Cloudflare R2.

## ✨ Features

- **🎬 Text-to-video** — Seedance 1.5 Pro / 2.0 / 2.0 Fast, 4–12 s clips, five aspect ratios (up to 21:9 cinematic), 480p/720p/1080p, synchronized audio, fixed-camera mode.
- **🖼️ Image-to-video** — drop a local image (stored via the media worker) or paste a URL; the clip starts from that frame.
- **🎨 Text-to-image tab** *(optional)* — Seedream models through the same gateway; generated images persist in the browser and can be sent straight back into image-to-video ("Animate").
- **💡 Prompt assistant** — an inspiration library (scene templates, camera moves, style/light phrases) plus one-click AI prompt rewriting via the gateway's chat API, with undo.
- **📝 Script import and shot breakdown** — paste text or import TXT, Markdown, DOC, DOCX, and PDF files up to 20 MB, then create editable shot rows through TokenHub's chat-completions API with a longer browser timeout for multi-model fallback.
- **📜 History & cost tracking** — every job with live progress, per-video cost breakdown mirroring the TokenHub price map, status/model filters, one-click **Reuse** (做同款) and **Regenerate**.
- **☁️ Permanent playback** — Ark's CDN links die after 24 h; finished videos are archived once to R2 and played from there forever.
- **🔑 No server-held keys for browser generation** — model calls use the signed-in user's own TokenHub key (SSO), or a manually pasted key; compatibility routes that accept a bearer key forward it without persisting it.

## 🏗️ Architecture

```
Browser (this app)
  │  SSO: GET xcity.ai/api/me/litellm-key  (same-site cookie → per-user key)
  │
  ├──► TokenHub gateway (LiteLLM, tokenhub.xcity.one)
  │      /v1/videos            → BytePlus/Ark Seedance
  │      /v1/images            → Seedream (optional tab)
  │      /v1/chat/completions  → prompt optimizer + short-drama script breakdown
  │
  ├──► Next /api/script/*
  │      file text extraction + retained server-compatible breakdown route
  │
  └──► xcity-media worker (Cloudflare Workers + R2, media-worker/)
         POST /archive   copy a finished video into R2 (key-authenticated)
         POST /upload    host a local reference image  (key-authenticated)
         GET  /media/*   serve stored media (public, immutable, CORS, ranges)
```

- Video/image **bytes** live in the browser (IndexedDB) and in R2; **history metadata** uses browser state and Worker sync. The Next.js app does not yet own a production database. `/api/config` exposes browser-safe runtime configuration; existing portrait and video-content API routes remain in place. Prompt optimization and short-drama script breakdown currently share the browser-direct TokenHub chat-completions path.
- Keys are resolved **at call time** through a ref (`src/features/settings/hooks/use-xcity-key.ts`) — SSO keys arrive async and rotate, so no closure ever trusts a key it captured at render time. When SSO is enabled, call-time resolution fetches the current SSO key before falling back to a browser-stored manual key.
- Archiving is **reconciliation-based** (`src/features/assets/hooks/use-media-archive.ts`): any completed history item without a permanent URL gets one, with exponential backoff — not a completion callback that can race the CDN link appearing.

## 🚀 Local development

Use Node.js 22.18+ and pnpm 10.34.5, pinned in `package.json`. Corepack runs the project version without changing other repositories. The runtime is Next.js 16.3.4, React 19.2.8, and next-intl 4.14.2.

```bash
corepack pnpm install --frozen-lockfile
cp .env.local.example .env.local   # then fill in what you need
corepack pnpm dev
```

Open [Chinese Studio](http://localhost:3000/zh) or [English Studio](http://localhost:3000/en). `/` redirects to `/zh`. With no SSO configured you'll be prompted for a TokenHub API key (stored only in the browser).

`pnpm-lock.yaml` is the only dependency lockfile. Use `pnpm add` and `pnpm remove` for dependency changes; do not run npm or Yarn installs. The install guard enforces the pinned pnpm version.

```bash
corepack pnpm check:harness
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
```

The upgrade introduces Server Component route shells, CSS Modules for the localized shell and migrated settings, and typed runtime configuration under `src/server` and `src/shared/contracts`. Existing production UI, Tailwind styling, and browser AI adapters are explicitly retained for separate migration. Initial translations cover navigation, the account gate/dialog, sharing, verification callbacks, and error pages; deeper production forms remain a translation follow-up. See [implementation status](docs/architecture/runtime-upgrade-status.md) and [file naming and size rules](docs/rules/files.md).

The [short-drama business rules](docs/rules/business.md) define the reference-project roles, IP continuity, script/storyboard review, candidate selection, director-agent boundaries, captions, multilingual releases, and export traceability. These are target constraints, not completed platform features.

## 📋 Launch planning

- [Studio launch plan](docs/LAUNCH_PLAN.md) — XCT-814 release timeline, feature checklist, cross-project dependencies, and first demo milestone.
- [Roadmap](docs/ROADMAP.md) — strategic product evolution beyond the launch.
- [Release notes](docs/RELEASE_NOTES.md) — user-facing release announcement draft.

### Benchmarks

Pure studio logic (cloud-sync merge, cost math, SRT/FCP7 export, media-state resolution, reference keys) is benchmarked with `vitest bench` and tracked on CodSpeed:

```bash
corepack pnpm bench                              # local run
codspeed run --mode simulation -- corepack pnpm bench   # same run, CodSpeed instrumented
```

Benchmarks live in [bench/](bench/); every pull request gets a performance report from [.github/workflows/codspeed.yml](.github/workflows/codspeed.yml).

### Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_OPENAI_API_BASE_URL` | yes | TokenHub gateway base URL, e.g. `https://tokenhub.xcity.one/v1` |
| `NEXT_PUBLIC_XCITY_SSO` | no | `true` → fetch the signed-in user's key from xcity.ai (origin must be on the xcity.ai CORS allowlist) |
| `NEXT_PUBLIC_XCITY_KEY_URL` | no | Override the SSO key endpoint (default `https://xcity.ai/api/me/litellm-key`) |
| `NEXT_PUBLIC_XCITY_LOGIN_URL` | no | Override the login URL (default `https://xcity.ai/login`) |
| `XCITY_LITELLM_URL` | no | Server-only TokenHub origin used by provider-asset routes. Defaults to `https://tokenhub.xcity.one`; do not include `/v1`. |
| `XCITY_LITELLM_API_KEY` | no | Server-only TokenHub key for server-side compatibility routes. The current Studio UI does not require it for short-drama breakdown. |
| `SCRIPT_BREAKDOWN_MODEL` | no | Server-side compatibility-route script breakdown model (default `deepseek-v4-pro-260425`). |
| `NEXT_PUBLIC_SCRIPT_BREAKDOWN_MODEL` | no | Browser-side TokenHub chat model for short-drama script breakdown. Leave unset to use allowed fallback models starting with `deepseek-v4-pro-260425`; set to `gpt-5-mini` only after the user's TokenHub key is allowed to access it. Each model attempt uses a 300s browser timeout. |
| `PROVIDER_ASSETS_ENABLED` | no | Set to `true` after TokenHub provider-asset routes and BytePlus credentials are deployed. Enables review, Asset ID status, and portrait-library UI. |
| `MEDIA_WORKER_URL` | no | Deployed media worker origin. Unset → archiving and local image upload are disabled; playback falls back to 24 h provider links. Read at runtime via `/api/config` — restart, don't rebuild. |
| `IMAGE_MODELS` | no | Comma-separated TokenHub image model ids, e.g. `seedream-5-0-260128`. Unset → the Image tab is hidden. Read at runtime via `/api/config` — restart, don't rebuild. |
| `NEXT_PUBLIC_PROMPT_OPTIMIZER_MODEL` | no | Legacy browser-side chat model for AI prompt rewriting (default `gpt-4o-mini`) |

## ☁️ Deployment

### App (Railway)

`nixpacks.toml` installs with `corepack pnpm install --frozen-lockfile`; `railway.json` builds and starts with `corepack pnpm build` / `corepack pnpm start`. The health check uses `/api/config` to avoid locale redirects. Set the environment variables above on the service; `MEDIA_WORKER_URL` only needs a restart to take effect.

### Media worker (Cloudflare)

```bash
cd media-worker
corepack pnpm dlx wrangler r2 bucket create xcity-media   # once
corepack pnpm dlx wrangler deploy
```

Config lives in [media-worker/wrangler.toml](media-worker/wrangler.toml): the gateway URL used to verify caller keys (`LITELLM_BASE_URL`), the browser origins allowed to call it (`ALLOWED_ORIGINS`), and size caps. Objects are namespaced per user (`u/<user_id>/…`), so one user's key can never overwrite another's media.

To test the worker locally: `corepack pnpm dlx wrangler dev --local` and point `MEDIA_WORKER_URL` at `http://localhost:8787`.

## 🧭 Repo map

```
src/app/[locale]/           Server Component locale layout and Studio page
src/proxy.ts               default locale and legacy callback redirects; API/media exclusions
src/i18n/                  routing, navigation, request config, typed zh/en messages
src/components/            shared ui, layout, providers; Component/index.tsx
src/features/studio/       legacy cross-feature workspace composition
src/features/settings/     locale/key UI, SSO, key hook, billing
src/features/assets/       references, portrait/authorization, storage, media hooks
src/features/generation/   creation/output/history/image UI, jobs, cost/progress
src/features/script/       inspiration, shot builder, prompt templates/guards
src/features/community/    gallery data, presets, community UI
src/features/post-production/  assembly UI, browser FFmpeg, NLE export
src/features/{ip,episode,localization}/  planned production-domain landing zones
src/server/                server-only config, xcity-litellm clients, portrait guards
src/shared/                video/cost/config contracts, model catalog, utilities
src/lib/                   eight legacy AI/Worker transports awaiting migration
scripts/harness/           directory/style/boundary/size/pnpm checks
media-worker/               Cloudflare Worker: /archive /upload /media
```

Components use `Component/index.tsx` and owned `index.module.scss` (Sass installed). Supporting files use short names such as `types.ts`, `hooks.ts`, and `utils.ts`. Directory migration is complete; nine oversized files and remaining Tailwind/provider migrations are tracked in [runtime status](docs/architecture/runtime-upgrade-status.md). Run `pnpm check:harness` to enforce the [file rules](docs/rules/files.md).

## License

MIT — see [LICENSE](LICENSE). Based on [sora-2-playground](https://github.com/alasano/sora-2-playground) by Aiden Lasanowski.
