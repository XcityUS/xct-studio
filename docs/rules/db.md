# Persistence And Storage Rules

Last updated: 2026-09-14

## Current Persistence Topology

The 2026-09-10 no-database decision has been superseded. PostgreSQL is authoritative for authenticated Studio business records. The browser consumes the same-origin `/api/business` API; only XCT Studio server modules may read `DATABASE_URL`, execute migrations, or access SQL. xcity-litellm remains the AI/provider gateway, not the Studio business-data authority. See [the persistence and execution boundary](../architecture/short-drama-infrastructure.md).

The current Studio has a layered persistence topology. Each store's responsibility must remain clear during migration.

| Store | Current role | Rule |
| --- | --- | --- |
| PostgreSQL | Authenticated Studio business records, revisions, tombstones, and queue claims | Authoritative for supported business flows; server access only. |
| localStorage | Outbox, failure recovery, legacy import, and small compatibility preferences | Not a durable source of truth for authenticated production entities. |
| IndexedDB and Dexie | Browser media cache and local playback support | A cache only; loss of browser data must not destroy selected work. |
| Cloudflare R2 | Archived media and uploaded reference assets | Durable binary object storage, not a relational production database. |
| Worker JSON state | Current cloud-sync compatibility state | Acceptable for legacy history and small state, not for concurrent Episode production data. |

## Current Source Of Truth And Evolution

Build new Studio business persistence on the existing server-only PostgreSQL repository and `/api/business` compatibility contract. Do not introduce database clients or credentials into browser bundles. New typed routes and schemas must migrate existing records rather than establishing a second authority.

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
- Existing compatibility records and revisions must remain readable through an explicit forward migration.
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

The harness must preserve the server-only database boundary and prevent browser code from importing persistence runtime modules. New IP and Episode types should evolve the delivered PostgreSQL record layer toward explicit domain relationships without making browser caches authoritative.
