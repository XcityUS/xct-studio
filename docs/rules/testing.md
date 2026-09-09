# Testing Rules

Last updated: 2026-09-07

## Required Test Harness Areas

Implemented foundation coverage lives in `tests/i18n` (locale routing, flat dictionaries, and actual ICU formatting) and `tests/harness` (public runtime configuration, naming/size rules, and the blocking i18n policy). i18n regressions must test rejected nested/duplicate keys, English normalization collisions, missing language entries, namespaced factories, dynamic keys, and import aliases/scope shadowing. Run `pnpm test` plus `pnpm check:harness`; the Quality workflow also runs lint, typecheck, and build. Domain coverage below remains staged work.

The platform harness should eventually cover:

- i18n routing
- message key parity
- script draft and version transitions
- script-to-scene-and-shot breakdown normalization
- IP reference-pack and Character Version locks
- history merge behavior
- worker namespace authorization
- media archive URL handling
- generation job status normalization
- episode/shot state transitions
- candidate selection rules
- source subtitle and translated subtitle track isolation
- localized Episode Version relationships

## Engineering Baseline Verification

During the implementation migration, verify:

- TypeScript checking covers application, server, Worker, and test code.
- Pages and layouts remain Server Components unless they require browser behavior.
- UI components and browser hooks do not import provider SDKs or call provider endpoints; browser requests target application APIs.
- Mocked server service tests cover validation, authorization, provider failures, and job status mapping without paid model calls.
- After the style migration, no Tailwind dependencies, directives, utility classes, or Tailwind-specific helpers remain; CSS Modules preserve layout and interaction in both locales.

## Initial Smoke Coverage

After Next 16 and i18n are implemented, smoke tests should confirm:

- `/zh` loads
- `/en` loads
- `/api/config` returns JSON
- current Studio form renders
- video output empty state renders
- assets/community tabs do not crash without configured worker
- script, storyboard, and localization empty states render when those surfaces are introduced

## Existing High-Risk Code

Prioritize tests around:

- `src/features/generation/history/merge.ts`
- `src/features/generation/hooks/use-video-history.ts`
- `src/lib/video-service.ts`
- `src/lib/media-archive.ts`
- `media-worker/index.js`
- `src/features/post-production/assembly/client.ts`
- future Script Version and Subtitle Track adapters

## Non-Goals

Do not attempt full AI generation integration tests by default. Model calls are expensive and key-dependent.

Use contract tests, mocks, and smoke tests for most CI coverage.

## Local Test Credentials

For explicitly authorized credential-dependent tests, follow the local preference in [project testing memory](../../memories/testing.md). Keep the credential in the OS credential store and inject it only into the test process. Do not hard-code keys in tests or fixtures, expose them through public runtime configuration, or capture them in screenshots and logs. Missing local credentials must not trigger an automatic switch to a production account or turn mocked CI tests into live provider calls.
