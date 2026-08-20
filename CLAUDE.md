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
- **Ark CDN links expire 24 h after COMPLETION and re-reads do NOT re-sign**
  (verified 2026-08-18: retrieve returns the same aging URL; past 24 h the
  bytes are unreachable via API even though the task record lives 7 days).
  The link also attaches minutes *after* long jobs first report completed.
  Playback prefers: local blob → R2 `storedUrl` → re-read `output_url`.
  Archiving is reconciliation from history (any completed item without
  `storedUrl`), with backoff — and it MUST succeed within the 24 h window
  or the video is gone; the studio must be opened at least once in that
  window.
- **Object URLs are created only in effects** (`use-video-sources`,
  `useImageObjectUrls`) and revoked on removal/unmount. Never call
  `URL.createObjectURL` during render.
- **A `<video src>` must never be derived from state that changes during
  playback.** Any change to the attribute reloads the element. The source for
  one clip legitimately changes (provider link → R2 copy → local blob), and a
  poster arrives mid-playback, so the player carries the playhead across a
  swap (`CompletedVideoPlayer`) and paints the first frame by seeking to
  0.001 s, never by appending a `#t=` fragment conditionally.
- **Storage names stay legacy** (`SoraVideoDB`, `soraVideoHistory`,
  `openaiApiKey`, `activeVideoJobs`) — renaming orphans existing users' data.
- **Reference images are inlined as Base64 data URIs at submit** (see
  `imageUrlToDataUri` in `media-archive.ts` + `handleCreateVideo`). Ark's
  server-side fetcher is challenged by Cloudflare's bot mitigation — browsers
  and curl fetch our media URLs fine, Ark gets "resource download failed" —
  on BOTH `*.workers.dev` and the custom domain media.xcity.ai. Any scheme
  that hands Ark a self-hosted URL will fail; Base64 is officially supported
  (ModelArk doc 1520757). History stores URLs only — data URIs would blow the
  localStorage quota.
- **Real-person reference images must be verified assets.** BytePlus rejects
  raw real-person images (`InputImageSensitiveContentDetected`). The fix is the
  private real-human asset library: H5 liveness verification → Asset Group →
  CreateAsset (face-matched) → reference `asset://<id>`. Those calls use
  account AK/SK (BytePlus OpenAPI, `src/lib/server/byteplus-openapi.ts` +
  /api/portrait/* routes — env BYTEPLUS_AK/SK, ARK_PROJECT_NAME must match the
  tokenhub Ark endpoint's project). `asset://` reference entries skip rebase,
  Base64 inlining, and preflight — passed through verbatim.
- **First-frame mode must omit `ratio`** (BytePlus TaskTypeConstraint: the
  output ratio follows the image). Multi-reference mode (2+ images, `role:
  reference_image`, Seedance 2.0/2.5 accept 1–9) keeps `ratio`. Exactly one
  image = first-frame; two or more = reference mode (`buildCreateBody`).
- **Normalize gateway job statuses** (`video-service.ts` STATUS_MAP): the
  in-flight status is `processing` (LiteLLM) / `running` (Ark), NOT OpenAI's
  `in_progress`; `succeeded` → completed. Unknown statuses count as running so
  polling never stalls. `output_url` appears a beat AFTER completion — re-read
  with backoff (~1 min window), never just once.

## Gateway params (BytePlus pass-through)

`POST /v1/videos` body: `model, prompt, seconds, ratio, resolution,
generate_audio, camera_fixed, input_reference`. The gateway forwards provider
params verbatim; don't convert ratio+resolution into a pixel `size` (mangles
21:9). Prices in `src/lib/seedance.ts` mirror the gateway cost map — keep them
in sync with xcity-litellm's model_prices json.

`input_reference` (since xcity-litellm PR #52) accepts: a single string
(first-frame; URL or Base64 data URI), a string array (multi-reference —
gateway adds `role: "reference_image"`, prompts cite [Image 1], [Image 2]…),
or `{url, role}` objects (explicit `first_frame`/`last_frame`).

**Still unverified against the live gateway**: `seed` pass-through,
`/v1/images` availability + Seedream ids (`NEXT_PUBLIC_IMAGE_MODELS` gate),
chat model id for the prompt optimizer (`NEXT_PUBLIC_PROMPT_OPTIMIZER_MODEL`).

## Deployment (every one of these burned us once)

- **Studio**: Railway `xct-studio`, auto-deploys from master.
  `NEXT_PUBLIC_MEDIA_WORKER_URL` / `MEDIA_WORKER_URL` must point at
  `https://media.xcity.ai` (read at runtime via /api/config).
- **Media worker**: deploy with `env -u CLOUDFLARE_API_TOKEN npx wrangler
  deploy` — the profile's CLOUDFLARE_API_TOKEN lacks Workers perms and
  SILENTLY overrides the OAuth login, making deploys fail with auth error
  10000. Custom domain media.xcity.ai is claimed in wrangler.toml.
- **TokenHub gateway**: Railway project `xct-litellm`, service **`xct-litellm`**
  (tokenhub.xcity.one/.ai are bound to it). The sibling service
  `xct-agent-gateway` is NOT tokenhub — a deploy landed there once by mistake.
  Merging xcity-litellm does NOT auto-deploy; trigger it manually
  (dashboard, or `railway up -s xct-litellm` from a clean checkout).
- **User keys snapshot their model allowlist at mint** (xct-home
  `src/lib/billing.ts` BYTEPLUS_MODELS). Adding a model to the gateway isn't
  enough for existing keys — also bump `KEY_MODELS_REV` in xct-home
  `src/lib/user-key.ts` so keys re-mint on next use, or they 401 with
  `key_model_access_denied` forever.

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
