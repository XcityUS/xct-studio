# Business persistence

## Storage boundary

PostgreSQL is authoritative for authenticated Studio business records. R2 continues
to store media bytes. IndexedDB is an account-scoped media cache. Credentials stay
in the existing credential flow and server environment, never business records.

The browser talks to same-origin `/api/business`; only the server reads
`DATABASE_URL`. Identity is verified through TokenHub `/key/info` and requires a
stable user id. Key rotation does not change ownership. Keys without a user id
cannot claim business data. All database reads/writes include the verified owner.

## Current compatibility boundary

Existing synchronous editors consume an in-memory adapter hydrated before the
workspace mounts. The adapter decomposes project state, script drafts, history,
queues, declarations, aliases and preferences into individual domain records.
Core ids, owner, scope, revision and timestamps are relational columns; existing
business payloads remain JSONB to preserve the current UI contracts. This is not
a claim that every future Episode Pipeline screen or typed foreign key is delivered.
Draft references and immutable generation snapshots retain legacy identifiers.
There is no whole-user history JSON write to R2 after this change.

Tables are `studio_users`, the domain tables listed in
`src/shared/contracts/business-data.ts`, and infrastructure tables
`studio_schema_versions`, `business_revisions`, `data_imports`. Future domain tables
are reserved by the schema; the current feature adapters populate only supported
flows. Shared/community/authorization Worker workflows remain a separate endpoint
migration; their existing public URLs and authorization rules must remain valid.

## Startup import

Successful browser migration writes a versioned, owner-scoped local checkpoint
only after cache preparation and pending-write acknowledgement, with no invalid
records. Later visits skip legacy localStorage validation/import for that owner;
they still read PostgreSQL, replay the current pending outbox, and check the Worker
import marker. Invalid or interrupted imports are not marked complete. Original
legacy keys remain recovery copies, not an ongoing source of new business writes.
Before identity resolution, show compact workspace loading. Once authenticated,
reserve a stable full workspace area for the branded startup panel so header content
does not jump as status text changes. Ordinary visits show indeterminate stage
activity; a numeric percentage is reserved for an uncompleted local migration.
This does not provide offline access or skip authentication.
IndexedDB metadata is reconciled in batches; unchanged image metadata is not
rewritten. Legacy media copy only inserts missing records and retains source files.

1. Authenticate and read PostgreSQL records, including deletion tombstones.
2. Claim legacy browser data for this verified account on this browser. Never
   import it again into another account. Do not remove original localStorage data.
3. Validate supported keys and redact credential fields. Malformed documents remain
   local with a visible warning. API keys and arbitrary localStorage keys are excluded.
4. Compare record identities. Import only missing records. Server-side transactions
   use insert-only semantics so an overlapping import cannot overwrite cloud state.
5. Import the owner's previous Worker history once. Keep this retryable if the
   Worker is unavailable; do not mark failed imports complete.
6. Reload the database snapshot only when an import was attempted; otherwise reuse
   the initial snapshot. Prepare the account-specific media cache, replay
   the account-specific pending changes with their original base revisions, and
   mount the workspace. Merely importing a queue never submits generation requests.

## Startup rendering and request cost

Startup displays five stages: database read, local validation, missing-record
import, previous cloud history, and local media cache preparation. Each stage
occupies 20 percent of the displayed progress; successful import batches advance
within their stage by acknowledged record count. This is explicitly stage progress,
not a time estimate. Display elapsed seconds and import counts, without advancing
progress on a timer. Failures retain their last progress and use the existing retry
and local-backup recovery flow. Preparing media cache does not generate videos.

The login link uses the same base URL for SSR and the first hydration render;
the browser return URL is added after hydration. Do not suppress hydration warnings.
Production Studio exposes Xcity sign-in as the only user authentication action. It
must not show a manual API-key input, fallback button, or error copy that asks users
to configure a key; the resolved TokenHub credential remains an internal session
detail. Localhost may retain the manual TokenHub-key dialog as a development fallback.
In development, the locale provider directly consumes the shared JSON dictionaries
so Fast Refresh updates translations even when a retained server layout still has
older message props. Production keeps server-selected messages. The provider retains
the server's current time and time zone; it does not suppress missing-key errors or
substitute untranslated keys for user-facing copy.
Concurrent snapshot reads for the same credential share only their in-flight
request, not a persistent response cache. Completed Worker imports are recognized
from the database marker and are not requested again on every mount.

An authentication rejection triggers at most one credential refresh for that
startup. A rejected unchanged key is invalidated, rather than retried indefinitely.
Verified identity and owner resolution share a 30-second server cache; concurrent
requests share resolution, and existing users are read instead of updated each time.
Snapshot responses expose auth/read durations through Server-Timing; slow-request
logs contain durations and record counts only. This does not establish the cause
of an earlier slow request without fresh measurements.

## Writes and recovery

Provider library reads share in-flight work per credential and path across route
handlers. HTTP 429 starts a credential-scoped cooldown honoring Retry-After, not
immediate retry bursts. Only reads retry; mutations are never automatically repeated.
Successful mutations invalidate cached reads. Cold-cache rate limits stay visible;
they are never represented as an empty successful asset inventory.

Media reconciliation isolates failed files, retries them no sooner than one minute,
and times out source downloads and uploads. URL-only images attempt to recover
their source bytes. Missing or expired bytes remain pending with the original URL;
absence from a device cache never creates a cloud tombstone. Business acknowledgements
must include every submitted identity before the outbox can advance.

Ordinary writes, not just migration imports, batch by table. They lock/read current
rows, validate all expected revisions, and archive/update changed rows in the same
transaction. A conflict rolls back the entire request. Identical data is acknowledged
without incrementing revisions; each write request requires unique record identities.
The provider/library and R2 inventory scopes are derived caches: a stale revision
adopts the existing database row, including tombstones, rather than overwriting it.
This exception never applies to projects, scripts, image/video records or user settings.
For image/video records, archive-only differences can reconcile only when all
non-archive fields match: a completed R2 archive wins over a pending/expired source.
User-authored metadata differences still conflict. Explicit deletion tombstones win
over stale media cache writes. Conflict diagnostics log field names, never values.
Unchanged browser records do not publish sync events, rewrite the outbox, or restart
the save timer. This prevents media inventory polling from retriggering idle saves.

The sync notice uses a compact, centered theme-aware layout, with reduced-motion
support. It shows pending record count. For an initialized workspace with pending
writes, transient database busy/timeout/unavailable states indicate automatic retry
through the existing 15-second flush loop; they do not also demand a manual retry.
Authentication, revision conflicts, and startup failures retain actionable controls.

The workspace status banner disappears when loading is complete, the business
outbox is empty, no errors or invalid records remain, and no media needs archiving.
Do not dismiss actual errors merely to hide the banner. For an already hydrated
workspace, retry flushes the existing outbox without restarting migration or
remounting editors; startup failures still retry initialization.

Missing-only imports are grouped by table and inserted in batches with
ON CONFLICT DO NOTHING. Existing rows and deletion tombstones are returned
unchanged, and duplicate input ids retain first-record-wins semantics. Import
audit records remain in the same transaction. Owner lock contention returns
DATABASE_BUSY rather than waiting behind a long import; query timeouts return
DATABASE_TIMEOUT. Neither response clears pending local data. Database logs record
safe error codes and successful request timings, never raw SQL errors or payloads.
The browser retries DATABASE_BUSY at most four times with 1/2/4/8-second delays,
retaining the exact original payload and revisions. Authentication, conflicts and
ambiguous network errors are not automatically retried by this request adapter.
New database connections terminate transactions idle for 15 seconds, rolling back
uncommitted work and releasing locks. This timeout is not a total migration deadline;
changing it requires restarting an existing development connection pool.

User edits enter a credential-free, account-scoped local outbox immediately and
are sent to PostgreSQL. An edit is shown as saved only after acknowledgement.
Requests are serialized per browser, and database writes lock the verified owner.
Revision mismatches reject the entire request. Conflicting edits can be retained
as a local recovery copy while explicitly reloading the database version.
Deletes are persistent tombstones. Prior values are retained in `business_revisions`.
Network failures retain pending changes and retry on reconnect or periodically.
An unload warning protects writes that are not yet acknowledged.

Queue submission claims the persisted queue record transactionally before calling
the provider. An ambiguous submit cannot be automatically repeated. Removing a
consumed queue item is persisted before progressing to another item.

Media reconciliation copies legacy IndexedDB records into the first owning
account's cache, archives missing bytes to R2, and persists metadata. Original
files are retained on failed upload. R2 availability is independent of PostgreSQL.

## Deployment

Install with the pinned pnpm version. Set server-only `DATABASE_URL` in Railway
to `${{Postgres.DATABASE_URL}}`. Local development needs a public connection URL.
Run `pnpm db:migrate` to apply additive schema migrations; application requests
also initialize the schema once per server process under a database advisory lock.
Never use `NEXT_PUBLIC_DATABASE_URL`. No deployment, paid generation or production
data deletion is part of local verification.
