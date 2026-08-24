# <img src="./public/logo.png" alt="Xcity" width="40" height="41" style="vertical-align: middle; margin-right: 8px;"> Xcity Video Studio

AI video (and image) generation studio for [xcity.ai](https://xcity.ai) — ByteDance **Seedance** models served through the Xcity **TokenHub** gateway, running live at [studio.xcity.ai](https://studio.xcity.ai).

Forked from [alasano/sora-2-playground](https://github.com/alasano/sora-2-playground) and rebuilt around the Xcity platform: unified SSO keys, direct-to-gateway browser calls, permanent media storage on Cloudflare R2.

## ✨ Features

- **🎬 Text-to-video** — Seedance 1.5 Pro / 2.0 / 2.0 Fast, 4–12 s clips, five aspect ratios (up to 21:9 cinematic), 480p/720p/1080p, synchronized audio, fixed-camera mode.
- **🖼️ Image-to-video** — drop a local image (stored via the media worker) or paste a URL; the clip starts from that frame.
- **🎨 Text-to-image tab** *(optional)* — Seedream models through the same gateway; generated images persist in the browser and can be sent straight back into image-to-video ("Animate").
- **💡 Prompt assistant** — an inspiration library (scene templates, camera moves, style/light phrases) plus one-click AI prompt rewriting via the gateway's chat API, with undo.
- **📜 History & cost tracking** — every job with live progress, per-video cost breakdown mirroring the TokenHub price map, status/model filters, one-click **Reuse** (做同款) and **Regenerate**.
- **☁️ Permanent playback** — Ark's CDN links die after 24 h; finished videos are archived once to R2 and played from there forever.
- **🔑 No server-held keys** — every model call runs in the browser on the signed-in user's own TokenHub key (SSO), or a manually pasted key.

## 🏗️ Architecture

```
Browser (this app)
  │  SSO: GET xcity.ai/api/me/litellm-key  (same-site cookie → per-user key)
  │
  ├──► TokenHub gateway (LiteLLM, tokenhub.xcity.one)
  │      /v1/videos            → BytePlus/Ark Seedance
  │      /v1/images            → Seedream (optional tab)
  │      /v1/chat/completions  → prompt optimizer
  │
  └──► xcity-media worker (Cloudflare Workers + R2, media-worker/)
         POST /archive   copy a finished video into R2 (key-authenticated)
         POST /upload    host a local reference image  (key-authenticated)
         GET  /media/*   serve stored media (public, immutable, CORS, ranges)
```

- Video/image **bytes** live in the browser (IndexedDB) and in R2; **history metadata** lives in localStorage. The Next.js server holds no state and no API keys — its one API route, `/api/config`, exposes runtime config (`MEDIA_WORKER_URL`) so the setting takes effect on restart without a rebuild.
- Keys are resolved **at call time** through a ref (`src/hooks/use-xcity-key.ts`) — SSO keys arrive async and rotate, so no closure ever trusts a key it captured at render time.
- Archiving is **reconciliation-based** (`src/hooks/use-media-archive.ts`): any completed history item without a permanent URL gets one, with exponential backoff — not a completion callback that can race the CDN link appearing.

## 🚀 Local development

```bash
npm install
cp .env.local.example .env.local   # then fill in what you need
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). With no SSO configured you'll be prompted for a TokenHub API key (stored only in the browser).

### Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_OPENAI_API_BASE_URL` | yes | TokenHub gateway base URL, e.g. `https://tokenhub.xcity.one/v1` |
| `NEXT_PUBLIC_XCITY_SSO` | no | `true` → fetch the signed-in user's key from xcity.ai (origin must be on the xcity.ai CORS allowlist) |
| `NEXT_PUBLIC_XCITY_KEY_URL` | no | Override the SSO key endpoint (default `https://xcity.ai/api/me/litellm-key`) |
| `NEXT_PUBLIC_XCITY_LOGIN_URL` | no | Override the login URL (default `https://xcity.ai/login`) |
| `MEDIA_WORKER_URL` | no | Deployed media worker origin. Unset → archiving and local image upload are disabled; playback falls back to 24 h provider links. Read at runtime via `/api/config` — restart, don't rebuild. |
| `IMAGE_MODELS` | no | Comma-separated TokenHub image model ids, e.g. `seedream-5-0-260128`. Unset → the Image tab is hidden. Read at runtime via `/api/config` — restart, don't rebuild. |
| `NEXT_PUBLIC_PROMPT_OPTIMIZER_MODEL` | no | Chat model for AI prompt rewriting (default `gpt-4o-mini`) |

## ☁️ Deployment

### App (Railway)

`railway.json` pins NIXPACKS with `npm run build` / `npm run start`. Set the environment variables above on the service; `MEDIA_WORKER_URL` only needs a restart to take effect.

### Media worker (Cloudflare)

```bash
cd media-worker
npx wrangler r2 bucket create xcity-media   # once
npx wrangler deploy
```

Config lives in [media-worker/wrangler.toml](media-worker/wrangler.toml): the gateway URL used to verify caller keys (`LITELLM_BASE_URL`), the browser origins allowed to call it (`ALLOWED_ORIGINS`), and size caps. Objects are namespaced per user (`u/<user_id>/…`), so one user's key can never overwrite another's media.

To test the worker locally: `npx wrangler dev --local` and point `MEDIA_WORKER_URL` at `http://localhost:8787`.

## 🧭 Repo map

```
src/app/page.tsx            orchestration + layout (tabs, dialogs, wiring)
src/hooks/                  use-xcity-key · use-video-jobs · use-video-history
                            use-video-sources · use-media-archive
src/lib/seedance.ts         model catalog, prices, ratios/resolutions
src/lib/video-service.ts    gateway /v1/videos client (raw JSON, key getter)
src/lib/image-service.ts    gateway /v1/images client (tab gated by env)
src/lib/media-archive.ts    R2 worker client (archive + upload)
src/lib/prompt-*.ts         inspiration templates · AI optimizer
src/components/             form, output player, history panel, image studio…
media-worker/               Cloudflare Worker: /archive /upload /media
```

## License

MIT — see [LICENSE](LICENSE). Based on [sora-2-playground](https://github.com/alasano/sora-2-playground) by Aiden Lasanowski.
