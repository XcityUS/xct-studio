# AGENTS

## Working Rules

- Read the repository implementation before changing its architecture.
- Keep changes within the current task; preserve unrelated working-tree changes.
- Explain the edit boundary before modifying files and report verification honestly.
- Keep this file focused on global behavior. Detailed rules belong in `docs/rules`.

## Required Baseline

- MUST use TypeScript for new implementation code.
- MUST NOT introduce Tailwind CSS in new or rewritten code.
- Prefer Server Components; isolate browser interactions in focused Client Components.
- Never call AI providers directly from UI components or browser hooks.
- Use the pnpm version pinned in `package.json`; keep only `pnpm-lock.yaml`.
- Existing implementation exceptions are migration debt, not patterns to extend.
- Follow `Component/index.tsx` plus colocated `index.module.scss`; let directories carry business context rather than repeating it in filenames. Do not recreate flat component files or catch-all directories. See file rules for exact legacy exceptions.
- Correct obvious internal spelling mistakes while editing, but preserve possible external contracts. Report every automatic naming correction to the user; never make one silently.

## Read Before Editing

- `docs/rules/core-conventions.md`: shared engineering constraints.
- `docs/rules/files.md`: naming, size limits, split criteria, and legacy baseline.
- `docs/rules/naming-corrections.md`: internal typo correction, protected contracts, disclosure, and verification.
- `docs/rules/business.md`: short-drama workflow and reference-project boundaries.
- `docs/rules/i18n.md`: flat normalized English-copy keys and root-only translation calls; verify with the Harness gate.
- `docs/harness/directory-map.md`: ownership and migration destinations.
- `docs/architecture/runtime-upgrade-status.md`: delivered foundation and deferred work.
- The matching domain rule and requirement before changing product behavior.

## Validation

- Run `pnpm check:harness`, `pnpm lint`, `pnpm typecheck`, and `pnpm test` for code changes.
- Run `pnpm build` and relevant browser checks for framework or route changes.
- Do not increase legacy size budgets or regenerate baselines to hide new violations.
- Do not make paid AI requests, publish, or deploy as part of a local verification run.
- Before credential-dependent local tests, read `memories/testing.md` for the user-approved credential location; never put secret values in project memory or rules.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
