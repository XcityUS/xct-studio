# Persistence And Storage Rules

Last updated: 2026-09-07

## Current Persistence Topology

2026-09-10 ownership decision: XCT Studio MUST NOT connect to a database or run database migrations. Short-drama persistence, transactions, snapshots and durable queues belong to the xcity-litellm backend. Studio consumes authenticated application APIs; its browser stores remain compatibility state/cache only. See [the backend boundary decision](../architecture/short-drama-infrastructure.md).

The current Studio has deliberately lightweight persistence. Its responsibilities must remain clear during migration.

| Store | Current role | Rule |
| --- | --- | --- |
| localStorage | Small history and preference compatibility state | Not a durable source of truth for new production entities. |
| IndexedDB and Dexie | Browser media cache and local playback support | A cache only; loss of browser data must not destroy selected work. |
| Cloudflare R2 | Archived media and uploaded reference assets | Durable binary object storage, not a relational production database. |
| Worker JSON state | Current cloud-sync compatibility state | Acceptable for legacy history and small state, not for concurrent Episode production data. |

## Future Source Of Truth

Before implementing collaborative, multi-device, or durable short-drama production data, provide persistence through the xcity-litellm backend. Do not introduce a database client, database credentials or a migration runner into XCT Studio.

The minimum relational domain should support:

- workspace
- project or production
- ip
- character
- character_version
- reference_asset
- episode
- script_version
- scene
- shot
- generation_job
- candidate
- selected_take
- episode_version
- subtitle_track
- localized_episode_version
- export

R2 should store bytes and object metadata. The database should store ownership, lifecycle, references, versions, and production relationships.

## Ownership And Lifecycle

- Every durable record must have an owner or workspace scope.
- Never infer ownership from a client-provided storage key.
- A Candidate references an immutable generated asset; a Selected Take references a Candidate.
- An Episode Version must preserve the selected-take ordering used for its export.
- Do not mutate a character reference pack in place once an Episode has locked it. Create a new version.
- Use explicit soft-delete or archival semantics for production records; do not make browser deletion the only deletion state.

## Schema Conventions

- Use singular TypeScript entity names and clear database table names.
- Keep creation and update timestamps on durable domain records.
- Use foreign keys or equivalent referential checks for Episode, Scene, Shot, Candidate, and Export relationships.
- Add a version or updated-at concurrency check for editable Episode drafts once multiple-device sync exists.
- Store provider payloads only when needed for debugging or replay, and keep them out of primary domain tables where possible.
- Store money-like cost values in a precision-safe representation; do not accumulate billing values through display-formatted strings.

## Migration Rules

- Schema changes require a committed migration and a rollback or recovery note.
- Backfill existing history only through an explicit mapping:

  history item -> candidate
  selected history item -> selected take
  assembly timeline -> episode version

- Do not delete legacy local history during migration.
- Keep localStorage and IndexedDB compatibility readers until existing users can safely migrate.
- Test a fresh install, an upgraded browser profile, and a partial sync failure before enabling a new durable store.

## Storage Rules

- Store media objects under an owner-scoped, non-guessable or collision-resistant key.
- Do not store API keys, bearer tokens, or raw authorization documents in public R2 objects.
- Record content type, byte size, checksum or provider identity when available, and creation time for durable assets.
- Keep public share payloads as a deliberately filtered projection, never a raw production record.

## Current Harness Constraint

The harness phase does not add a database. It defines the boundary so new IP and Episode types do not become permanent browser-only state by accident.
