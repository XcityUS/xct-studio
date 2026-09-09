# Utility And Shared Helper Rules

Last updated: 2026-09-07

## Placement

Use the narrowest appropriate home:

| Kind | Location |
| --- | --- |
| Feature-only helper | src/features/<feature>/lib or src/features/<feature>/utils |
| Stable framework-independent helper | src/shared/utils |
| Static configuration or mapping | src/shared/config |
| Browser integration helper | the owning feature or existing src/lib during migration |
| Server-only helper | src/server |

Do not create a generic utility just to avoid deciding feature ownership.

## Time, Durations, And Units

- Use UTC for durable timestamps and provider audit values.
- Use Intl.DateTimeFormat for user-facing dates and times.
- Persist durations as durationMs; format seconds or minutes at the UI edge.
- Persist file sizes in bytes; format KiB, MiB, or GiB at the UI edge.
- Do not hand-roll locale-sensitive date, number, or byte formatting in components.

## IDs, URLs, And Media

- Generate opaque ids with a collision-resistant platform primitive.
- Treat provider ids, media URLs, and R2 keys as external input until validated.
- Use URL and URLSearchParams instead of string concatenation for query parameters.
- Keep media URL parsing and source-priority logic in one shared helper or feature adapter.
- A helper that decides local blob, R2, and provider CDN priority must not mutate application state.

## Errors And Parsing

- Parse unknown external values at one boundary.
- Map provider errors into stable product errors before rendering them.
- Pure normalization functions should be deterministic and independently testable.
- Do not make a utility call fetch, localStorage, or React hooks unless its name and owner clearly describe that side effect.

## File Validation

- Validate allowed MIME type, byte size, and supported media kind before upload.
- Do not trust a filename extension as the only file-type check.
- Centralize provider-specific media constraints instead of duplicating limits in UI components.
- Keep authorization evidence validation separate from ordinary reference-media validation.

## Dependency Rule

- Prefer platform APIs and existing project helpers for small operations.
- Add a dependency only when it provides a material capability, has a clear owner, and is compatible with the Next 16 target.
- Do not add a global state, validation, date, or utility library solely for one small feature.

