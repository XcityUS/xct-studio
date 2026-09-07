# Git And Collaboration Rules

Last updated: 2026-09-07

## Commit Format

Use Conventional Commits:

type(scope): imperative description

Common types:

- feat
- fix
- refactor
- docs
- test
- perf
- chore
- build

Recommended Xct Studio scopes:

- studio
- worker
- ip
- episode
- generation
- assets
- post-production
- community
- i18n
- api
- deps
- tests
- docs

Examples:

- feat(episode): add editable shot draft contract
- fix(worker): preserve owner namespace during asset delete
- refactor(generation): isolate provider status normalization
- docs(rules): add short-drama persistence rules
- chore(deps): upgrade Next and React runtime

## Change Boundaries

- Keep a commit focused on one behavior or one migration step.
- Isolate framework upgrades from feature migrations.
- Do not combine generated lockfile churn with unrelated product work.
- Do not include media binaries, local database files, browser caches, or secret files in commits.
- Do not rewrite or revert another contributor's uncommitted work.
- Record a concise migration note when changing a public Worker, API, or persistence contract.

## Documentation Changes

- Update requirements when product behavior changes.
- Update rules when a new constraint is discovered.
- Mark implementation task-list items only when the verified implementation is complete.
- Keep product terminology consistent with rules/glossary.md.

## Review Expectations

Changes that affect generation, media storage, authorization, or episode persistence should state:

- user-visible behavior changed
- compatibility impact
- failure handling
- tests or smoke checks run

