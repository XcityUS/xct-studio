# Runtime Upgrade Status

Last updated: 2026-09-10

## Approved Scope

2026-09-10 short-drama UI follow-up: existing ProjectHeader now uses one project selector and create/rename/delete confirmation dialogs; a remembered Normal/Short Drama switch controls entry. ShotBuilderDialog uses owned SCSS and stable local shot keys, manual/automatic input, draft retention on close, duplicate/reorder controls, replacement confirmation and generation confirmation. Save no longer copies a multi-shot prompt into the normal form. Draft retention is ephemeral in-tab state, not cloud persistence or background execution. ProjectControls isolates hook-to-header mapping and conservatively blocks deletion while known video jobs are active. StudioWorkspace and CreationForm budgets decrease to 3,635 and 1,111 lines; remaining browser queue/provider orchestration is legacy debt.

Current verification: 329 tests, typecheck, lint with zero errors (34 existing warnings), Harness with zero errors, and the Next.js webpack production build passed. Browser checks on `localhost` exercised Short Drama preference recovery, project configuration in dark/light themes, sticky actions, and duplicate-name rejection; no paid generation was submitted. xcity-litellm drama route passed Ruff, BasedPyright and 4 tests. The default Turbopack build cannot run on this Codex host because its CSS worker is denied an internal port (`Operation not permitted`); this is an environment limitation, while the production code path was verified with webpack. Authenticated cloud sync, live AI parsing, paid generation and backend persistence were not verified. No Studio database or deployment was added.

The user chose framework, internationalization, and directory architecture first. Full legacy Tailwind removal, browser AI transport migration, and new short-drama production functionality are separate follow-ups. The business harness defines target behavior, not implemented IP/Episode features.

## Installed Foundation

| Area              | Installed state                                                                                                                                                                                               |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime           | Next.js 16.3.4, React / React DOM 19.2.8, matching Next ESLint config                                                                                                                                         |
| Localization      | next-intl 4.14.2; `/zh` and `/en`, default `/zh`; 130 typed flat English-copy keys with matching Chinese values                                                                                               |
| Toolchain         | pnpm 10.34.5 pinned; Node >=22.18.0, verified on 22.22.1; strict TypeScript                                                                                                                                   |
| Dependencies      | `pnpm-lock.yaml` replaces `package-lock.json`; frozen install, build-script allowlist, install guard                                                                                                          |
| Routes            | Server Component root/locale layouts and page wrappers; explicit locale validation; `src/proxy.ts`                                                                                                            |
| New styles        | Sass 1.104.0; owned SCSS Modules for shell/settings/callback and Input/Textarea; shared tokens                                                                                                                |
| Selection UI      | Radix Select 2.3.7 through the shared `components/ui/Dropdown`; visible native selects prohibited by Harness                                                                                                  |
| Video playback    | ArtPlayer 5.4.0 through the shared `components/ui/VideoPlayer` adapter; built-in English and Simplified Chinese controls                                                                                      |
| Boundaries        | Runtime config, xcity-litellm clients, and portrait guards protected by `server-only`; shared config/contracts                                                                                                |
| Harness           | Directory/style/ownership checks, AST runtime import graph and function advisory, nine legacy size budgets, pnpm metadata gate, blocking flat-key/dictionary/translation-call validation, CI quality workflow |
| Deployment config | Railway/Nixpacks and CodSpeed commands migrated to pnpm; no deployment performed                                                                                                                              |

The existing implementation now uses PascalCase component directories and feature ownership. Business components, hooks, gallery data, media helpers, contracts, and provider guards were migrated with their imports/tests/benchmarks. `components` contains only `ui`, `layout`, and `providers`; `src/hooks`, `src/types`, and `src/data` are retired. `features/studio` owns cross-feature screen composition, not the short-drama domain model. IP, Episode, and content-localization directories remain planned landing zones.

Seven large components now have independent child components or typed helper modules. This preserves existing behavior and does not claim that the remaining oversized orchestrators, legacy Tailwind classes, or browser provider calls are compliant:

| Component entry      | Before | Current | Remaining work                                                                                                                            |
| -------------------- | ------ | ------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| StudioWorkspace      | 4,004  | 3,642   | Split independent workflow state/effects and actions                                                                                      |
| AssetsPanel          | 1,578  | 1,224   | Split listing, portrait authorization, and selection state                                                                                |
| CreationForm         | 1,248  | 1,118   | Split model settings, references, and submission state                                                                                    |
| ReferenceImagesInput | 1,007  | 682     | Split uploading, ordering, and selection state                                                                                            |
| VideoHistoryPanel    | 1,331  | 1,157   | Split filters, media actions, and selection                                                                                               |
| AssemblyEditor       | 1,006  | 816     | Split timeline interactions and export orchestration                                                                                      |
| VideoOutput          | 845    | 414     | Hard-size budget removed; status/metadata extracted, copy localized; remaining presentation/style debt and player-state advisory retained |

Six component budgets were lowered to their new exact line counts; VideoOutput's obsolete budget was removed. The history hook, FFmpeg client, and Worker client retain unchanged no-growth budgets. A directory move alone never clears migration debt.

## Locale Compatibility

- `/` redirects to `/zh`, preserving query parameters. Locale switching preserves the current path, query, and hash.
- Explicit `/en` and `/zh` routes do not depend on browser language or a previous locale cookie.
- API routes, FFmpeg/public assets, and media URLs stay outside locale proxy matching.
- There is one callback page: `src/app/[locale]/portrait-callback/page.tsx`. The proxy redirects the original `/portrait-callback` URL to `/zh/portrait-callback`, preserving all callback query parameters. The redundant unprefixed page and root redirect page were removed.
- Unsupported locale routes produce 404. Locale-scoped shell/messages update on client navigation; the shared HTML document language is synchronized with the active locale.
- Initial messages cover metadata, navigation/footer, account gate/dialog, top-level tabs, share dialog, portrait callback, and not-found UI.
- VideoOutput-owned copy now includes empty/initializing/queued/processing/completed/failed/expired/recovery states, task metadata, action labels, the player label, and the copy tooltip. ArtPlayer supplies its built-in English/Simplified Chinese control copy. Known sanitized errors are localized; unknown runtime messages retain the existing fallback until stable server error codes are introduced.
- Creation, prompt inspiration, shot builder, reference inputs, history, and community/gallery presentation now use the flat locale dictionaries. User-authored prompts, model identifiers, and media metadata remain content rather than UI copy.
- Asset-library, assembly, and remaining image/remix/finalize dialog copy remains legacy English. `/zh` is not yet a fully translated production editor.

## Provider Asset Flow

- `xct-studio` never signs or calls BytePlus provider asset APIs directly. Browser requests terminate at localized-independent Next.js API routes, which forward the authenticated request to `xcity-litellm`.
- `xcity-litellm` owns BytePlus credentials, HMAC signing, provider group ownership checks, response normalization, and asset URL allowlisting.
- Before creating an asset, Studio synchronizes and reads the current cloud state. An existing `assetId` is queried and reused; a missing `assetId` starts a new provider submission.
- A successful CreateAsset response is persisted immediately as `Processing`, then reconciled to `Active` or `Failed`. If authentication or provider submission fails before an ID is returned, Studio does not invent or persist an `assetId`.
- Public-figure and protected-IP references use this direct provider flow after the provider's offline rights authorization/OA and account allowlisting. Studio no longer duplicates that process with an internal `/authz` upload or administrator decision.
- Reviewed uploads remain in the main Assets list and are sorted first. Active records reference `asset://<AssetID>`; unreviewed records must enter provider review before reference actions are enabled. Seedream output remains explicitly exempt.
- The Assets view lists BytePlus records only from provider groups owned by the signed-in Xcity user, merges them into the existing cloud grid, and deduplicates matching source URLs and Asset IDs. It never exposes the platform account's unscoped library.
- The Assets view polls persisted `Processing` records and writes terminal status, preview URL, and failure reason back to cloud state. Deploying the media Worker update is required so portrait declarations and status fields survive cloud merges.

## Verification

- After dropdown migration: the interface locale is a direct Chinese/English toggle, all eleven remaining visible native selects moved to the shared Radix Dropdown, and the two affected legacy file budgets decreased. Harness blocks future native select regressions. The final run passed 262 tests, typecheck, production build, lint with 0 errors, formatting, and `git diff --check`. Desktop and mobile browser checks verified the Dropdown menu, selected state, stable truncation, and bidirectional locale switching while preserving query and hash. The first browser run exposed a locale-aware router no-op for composed query/hash strings; the switcher now replaces the locale segment explicitly through the Next router. A subsequent React maximum-update-depth report in the Radix Trigger path was resolved by upgrading `@radix-ui/react-select` from 2.2.2 to 2.3.7; model changes, ratio/resolution menus, advanced controls, and keyboard selection were rechecked in a fresh dev process without the loop.
- After the ArtPlayer migration: all four full player surfaces use the shared adapter; 260 tests, typecheck, production build, lint, Harness, formatting, and `git diff --check` passed. An isolated desktop/mobile browser session decoded and played a local fixture in English and Chinese with no console errors. Lightweight hover previews, thumbnails, and frame extraction intentionally remain native media elements.
- After VideoOutput localization: 260 tests across twelve files passed, including 38 new output lifecycle/error cases and two slider-label cases. Production build, typecheck, lint, scoped formatting, and `git diff --check` passed. The isolated browser verified a local generated fixture video's decoding/playback, Chinese completed/failed/expired states, disabled unsupported finalization, and English mobile layout. No paid generation, real SSO, cloud writes, or deployment was performed.
- After flat-key correction: `pnpm check:harness`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (218 tests across ten files), production build, scoped Prettier checks, and `git diff --check` passed. All 144 original language values were compared against the pre-migration snapshot and preserved, including the three pairs of duplicate keys and ICU placeholders.
- After directory/SCSS migration: frozen pnpm install, production build, TypeScript checks, lint (0 errors), 112 tests across seven files, and all five benchmark files passed. `git diff --check` passed. No production deployment or remote data writes were performed.
- Unit tests cover locale matching/redirects, query/hash path construction, dictionary key parity and ICU formatting, public runtime-config filtering/fallbacks, and naming/size/baseline boundary cases.
- `pnpm check:harness` now scans 227 files with 0 errors, 100 advisory warnings, and nine no-growth budgets. File/function advisories remain visible for responsibility review; removing one hard-size exception does not imply that every function is now below its advisory limit.
- Lint reports 34 existing React hook/compiler warnings. Exact warning overrides follow their migrated files, including the extracted history title and display-progress hook; no broad new-file exemption was added. This is not a zero-warning migration.
- Browser smoke checks passed at desktop 1440x1000 and mobile 375x812: Chinese/English shell rendering, bidirectional locale switching, matching document language/title, query/hash retention, loaded brand image, and no horizontal page overflow. Final isolated page reloads had no console errors.
- Input/Textarea preserve caller CSS overrides and native attributes: the existing prompt field remains 224px tall, reference input 36px, with 14px desktop / 16px mobile text. The mobile key dialog opens/closes correctly and rejects whitespace-only input without submitting a key. Dev-only unused CSS preload warnings remain visible.
- Installing Sass changed pnpm's Next peer-dependency path; the dev server was restarted to discard its old module graph. Two stale Next 15 files under `.next-dev/types` referenced the deleted unprefixed pages and were removed as generated cache. Typechecking then passed without disabling validation; a fresh checkout does not contain these ignored caches.
- The old callback URL redirects to the single localized page with parameters intact; its failure state renders once without real verification. `/fr` returns 404; `/api/config`, FFmpeg JS/WASM, and logo resources return 200.
- The configured production Worker rejects the local browser origin with CORS. Layout smoke checks used an isolated browser with a mocked unconfigured public config; production CORS settings were not modified. This is not verification of authenticated Worker behavior.
- Paid provider generation, authenticated Worker writes, real portrait verification, actual media rendering/export, and deployment were not exercised.

## Flat-Key Correction

The initial rule migration incorrectly replaced the reference repository's flat English-copy strategy with semantic namespaces. The dictionaries and call sites then followed that incorrect local rule. The original recursive dictionary test checked only leaf-path parity and ICU formatting, so it accepted nested objects; Harness had no i18n policy gate. This was a rule-migration and verification gap, not a next-intl requirement or a missing user instruction.

The conflicting rule has been replaced in [i18n rules](../rules/i18n.md) and linked from AGENTS/core conventions. All 72 former message paths and 77 call sites now use 69 unique normalized English-copy keys. No nested adapter, namespace alias, or old-key compatibility layer remains. English and Chinese values are unchanged. The account-connection presentation was extracted to `features/settings/components/AccountConnection` with owned SCSS to keep long readable keys from growing the legacy Studio workspace; its budget decreased to 3,642 lines.

`scripts/harness/inspect-i18n.ts` now runs within `pnpm check:harness`, which the existing Quality CI already executes. Dictionary shape, duplicate keys, normalization/collisions, language parity, static literal references, namespaces, and translator escapes are hard errors. Rejection fixtures test that these regressions fail, alongside actual next-intl formatting tests. This does not claim that repository branch-protection settings were configured or that every untranslated legacy string is detectable automatically.

Fresh isolated browser checks after migration passed for Chinese desktop (1440x1000), English mobile (375x812), key-dialog copy, copyright interpolation, language switching with query/hash retention, and the legacy callback redirect's Chinese failure mapping. No visible key tokens or horizontal page overflow were found; the fresh test session logged no console errors. Existing development CSS-preload warnings remain. HTTP checks returned 200 for `/zh`, `/en`, `/api/config`, 307 for default/legacy redirects with query preservation, and 404 for `/fr`. The browser used a mocked unconfigured Worker config and no credentials. Account-connection loading/sign-in/error presentation is covered by render tests; real SSO/provider flows remain untested here.

## Component Directory Convention

The VideoOutput follow-up extracted `StatusBadge/index.tsx` and `Metadata/index.tsx` with their own `index.module.scss`; existing output/prompt styles remain explicit legacy debt. The output entry shrank from 480 to 414 lines without adding or increasing a size budget. Full video playback is centralized in `components/ui/VideoPlayer/index.tsx`, with ArtPlayer lifecycle, source switching, poster updates, and callbacks isolated in local support files. Mobile screenshots caught and resolved a split-word status badge. Slider accessibility compatibility remains covered for non-player slider consumers. The legacy sanitizer's amount regex no longer consumes sentence-ending punctuation; a regression test covers repeated sanitization. Billing eligibility is determined before localization.

Output error localization is an explicit compatibility adapter for strings already produced by the sanitizer, not a new provider protocol. Unknown strings are not used as translation keys. A future typed server error contract must replace that string matching; existing unknown-message sanitation/security behavior has not been broadened here. Finalize/extend/share generation, export, and provider recovery transports remain unchanged and were not executed by browser checks.

The rule is now implemented and checked: `components/ui/Input/index.tsx` with `index.module.scss`, plus short owned files such as `types.ts`, `hooks.ts`, and `utils.ts`. Flat application components are gone. All previous CSS Modules were converted to SCSS and shell styles split by owner. Input/Textarea no longer use Tailwind internally; their component CSS layer still permits existing caller utility overrides during migration. Other moved legacy components retain their existing styling, without empty placeholder stylesheets.

Harness rejects wrong component entries, wrong/orphan/shared component stylesheets, duplicate nonlocalized page trees, localized APIs, a second middleware entry, retired directory additions, known provider SDK imports outside adapters/legacy exceptions, missing server-only markers, and client-to-server paths through local runtime imports/re-exports. It checks pnpm pins and root lockfile exclusivity. Raw HTTP provider detection, semantic domain boundaries, and full legacy Tailwind migration still require review and behavior tests.

## Deferred Migration

The script-file import follow-up touched two legacy components without broadening their ownership. `StudioWorkspace` only rewires its breakdown callback to the server API and rejected-key recovery; `ShotBuilderDialog` delegates new upload interaction and styling to its owned `ScriptImportField` CSS Module. Their broader orchestration and Tailwind migrations remain deferred.

1. Remove legacy Tailwind classes/wrappers/dependencies and migrate remaining runtime JavaScript, including the Worker.
2. Move all provider SDK calls, submission, and polling from browser adapters into authenticated server application services.
3. Translate deep production forms and stabilize remaining React warnings with focused behavior tests.
4. Finish the nine oversized files in `docs/harness/file-size-baseline.json`; do not increase their budgets to fit new features.
5. Implement versioned IP/character assets, scripts, Scenes/Shots, durable jobs, selection, Episode Versions, subtitle/dubbing localization, and traceable exports.
6. Design durable persistence, authorization, idempotency, and multi-device conflict handling before treating drafts as production records.

Detailed tasks: [runtime/i18n checklist](../requirements/next16-i18n-task-list.md), [platform task list](../requirements/xct-studio-task-list.md). Product constraints: [business rules](../rules/business.md). Engineering gates: [file rules](../rules/files.md).

## Primary Upgrade References

- [Next.js 16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16): runtime/API migration and ESLint CLI changes.
- [next-intl routing setup](https://next-intl.dev/docs/routing/setup): locale routing, request config, and proxy setup.
- [pnpm installation](https://pnpm.io/installation) and [settings](https://pnpm.io/settings): pinned package manager and install/build-script policy.
- [Next.js Sass support](https://nextjs.org/docs/app/guides/sass): Sass dependency and colocated SCSS Modules.
