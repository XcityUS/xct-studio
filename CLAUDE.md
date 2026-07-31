# Xcity Video Studio — working notes

Next.js 15 App Router studio for Seedance video (and optional Seedream image)
generation through the Xcity TokenHub gateway (LiteLLM, OpenAI-style API).
Deployed on Railway at studio.xcity.ai; media worker on Cloudflare (R2).

## Architecture invariants (learned the hard way — keep them)

- **Keys are resolved at call time, never captured.** SSO keys arrive async
  and rotate. `useXcityKey` owns the key in a ref; `VideoService` takes a
  *getter*, not a key string. Any new code running outside render (polling,
  callbacks, reconciliation) must read via `resolveKey()`/`keyRef`.
- **Runtime config goes through `/api/config`, not `NEXT_PUBLIC_*`.**
  NEXT_PUBLIC values are inlined at build time and silently come out empty when
  the build env lacks them (bit us on Railway). Server-read env (e.g.
  `MEDIA_WORKER_URL`) takes effect on restart. NEXT_PUBLIC_* is acceptable only
  for values that gate UI (SSO flag, image-model list) where a rebuild is fine.
- **Gateway calls are raw JSON via `client.post`/`client.get`,** not the typed
  SDK helpers: the typed `videos.create` switches to multipart when
  `input_reference` is present (gateway wants a URL string), and typed
  `videos.retrieve` drops `output_url` — the provider CDN link we play from.
- **Ark CDN links expire in 24 h** and attach a beat *after* the job first
  reports completed. Playback prefers: local blob → R2 `storedUrl` → freshly
  re-read `output_url`. Archiving is reconciliation from history (any completed
  item without `storedUrl`), with exponential backoff — never a completion
  callback.
- **Object URLs are created only in effects** (`use-video-sources`,
  `useImageObjectUrls`) and revoked on removal/unmount. Never call
  `URL.createObjectURL` during render.
- **Storage names stay legacy** (`SoraVideoDB`, `soraVideoHistory`,
  `openaiApiKey`, `activeVideoJobs`) — renaming orphans existing users' data.

## Gateway params (BytePlus pass-through)

`POST /v1/videos` body: `model, prompt, seconds, ratio, resolution,
generate_audio, camera_fixed, input_reference` (public image URL). The gateway
forwards provider params verbatim; don't convert ratio+resolution into a pixel
`size` (mangles 21:9). Prices in `src/lib/seedance.ts` mirror the gateway cost
map — keep them in sync with xcity-litellm's model_prices json.

**Unverified against the live gateway** (needs a real TokenHub key):
last-frame reference (尾帧) param shape, `seed` pass-through, `/v1/images`
availability + Seedream ids (`NEXT_PUBLIC_IMAGE_MODELS` gate), chat model id
for the prompt optimizer (`NEXT_PUBLIC_PROMPT_OPTIMIZER_MODEL`).

## Commands

```bash
npm run dev          # dev server (turbopack)
npm run build        # prod build — do NOT run while dev server is up (shared .next)
npx tsc --noEmit     # typecheck
npm run lint
cd media-worker && npx wrangler dev --local   # local worker (+ mock /key/info to test happy paths)
```

## Structure

- `src/app/page.tsx` — orchestration only (~600 lines). New stateful logic
  belongs in `src/hooks/`.
- `src/hooks/` — key/SSO, job polling, history persistence, media sources,
  archive reconciliation. Each hook documents its contract.
- `media-worker/` — auth = caller's TokenHub key verified via gateway
  `/key/info`; objects namespaced `u/<user_id>/…`. `/archive` only fetches
  from `*.volces.com` (no open proxy).
- `remix-form.tsx` + `VideoMetadata.mode/remix_of` are currently unwired
  (kept pending a decision on remix support via the gateway).
