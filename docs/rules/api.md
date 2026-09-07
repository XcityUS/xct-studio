# API And Worker Protocol Rules

Last updated: 2026-09-07

## Current Boundaries

Xct Studio currently has three distinct integration layers:

| Layer | Owner | Purpose |
| --- | --- | --- |
| Next route handlers | src/app/api | Server-side configuration, provider proxying, and portrait-related calls. |
| Cloudflare media worker | media-worker | R2 media, assets, shares, community, authorization, and cloud state. |
| Provider adapters | xcity-litellm/gateway/providers; legacy clients in src/lib | BytePlus credentials and signing live in xcity-litellm; remaining browser AI transports are tracked migration debt. |

The table describes current implementation, including legacy browser provider clients. The target AI boundary is:

```text
Client UI / hook -> application API or Server Action -> server business service -> provider adapter -> AI provider
Server Component -> server application service (reads only)
```

Never call AI providers directly from UI components. Keep provider SDKs, transport, request mapping, and credentials in server-only services. Moving a direct browser call into a client hook or helper does not satisfy this rule. Provider asset calls follow `UI -> xct-studio /api/portrait -> xcity-litellm /v1/provider-assets -> BytePlus`; `xct-studio` never stores BytePlus AK/SK credentials.

All new route handlers, business services, adapters, and request/response contracts inside `xct-studio` must use TypeScript. `xcity-litellm` follows its native Python/FastAPI conventions. Feature UI accesses media Worker endpoints through typed asset adapters and must not construct raw Worker or provider URLs inline.

## Route Ownership

- Keep internal Next routes under /api.
- Keep locale prefixes out of /api routes.
- Keep media byte serving and R2 object handling in media-worker.
- Keep Worker endpoint names and storage semantics behind src/lib/media-archive.ts or a future assets feature adapter.
- Keep provider request normalization and polling in server-only adapters. Browser polling targets the application's job API.
- Introduce /api/v1 platform resource routes only when a server-side persistent domain API exists.

## Contract Rules

- Define request and response types at the integration boundary.
- Validate all route input before calling a provider or storage system.
- Return JSON with an explicit content type.
- Use appropriate HTTP status codes. Do not return a successful status for a rejected request.
- Use stable application error codes such as VALIDATION_FAILED, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT, PROVIDER_UNAVAILABLE, and INTERNAL_ERROR.
- A response may use a success envelope when a new platform API is introduced:

  { "success": true, "data": {}, "meta": { "requestId": "..." } }

  { "success": false, "error": { "code": "VALIDATION_FAILED", "message": "..." }, "meta": { "requestId": "..." } }

- Existing public contracts must remain compatible unless a versioned migration is explicitly planned.
- Persist a returned provider asset id immediately with `Processing` status. Reconcile cloud state before creating an asset; when the same reference already has an asset id, query that id instead of creating a duplicate.
- A request that fails before the provider returns an asset id must not create a synthetic id or persisted asset record.

## Generation Protocol

- A generation request belongs to one Shot when it is created from an Episode Pipeline.
- Normalize provider statuses into a product-owned status model before UI consumes them.
- Persist the provider job id, model, submitted parameters, safe prompt snapshot, timestamps, cost metadata, and result references.
- Retry behavior must be explicit. A retry creates a traceable attempt; it must not overwrite the prior failure.
- Write operations that can be retried by browsers or queues need an idempotency key once server-side job creation exists.

## Media Worker Protocol

- The Worker remains the authority for R2 object access, archive copies, assets, shares, community records, authorization records, and current cloud-state compatibility endpoints.
- User-scoped Worker keys must remain owner-namespaced.
- Browser code must not assume provider CDN URLs are permanent or CORS-readable.
- Archive a completed result before treating it as a durable selected take.
- Do not put private reference parameters or authorization documents into a share or community record.

## Authentication And Secrets

- Never expose server-side provider credentials through Next public environment variables.
- Preserve SSO and virtual-key authentication while migrating AI transport behind the application API. The legacy browser TokenHub flow is not an approved pattern for new AI features.
- Route handlers and Workers must verify authorization before writing user-owned media or state.
- Never log Authorization headers, API keys, signed URLs, or raw authorization evidence.
- Use the least privileged integration path available for each external call.

## Observability

- Attach a request id or operation id to future server routes and Worker write flows.
- Log provider status, endpoint class, duration, and safe identifiers.
- Do not log full prompts or reference URLs by default.
