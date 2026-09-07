# File Naming And Size Rules

## Naming

Directories express business ownership and component identity; filenames express the responsibility inside that directory. Do not repeat the whole business path in a filename. Use lowercase kebab-case for feature/domain directories and PascalCase for component directories.

Follow [typo and naming correction rules](naming-corrections.md) while editing: fix obvious internal spelling mistakes consistently, preserve possible external contracts, and disclose every automatic correction in the final delivery.

| Kind                          | Filename                                                                     | Export convention                                           |
| ----------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------- |
| React component               | `components/Input/index.tsx`, `features/episode/components/Editor/index.tsx` | `Input`, `Editor`                                           |
| Component style               | `Input/index.module.scss`                                                    | CSS Module classes such as `root`, `toolbar`, and `preview` |
| Component-owned hooks         | `Input/hooks.ts` or `Input/hooks/use-focus.ts`                               | exported functions start with `use`                         |
| Component-owned types/helpers | `Input/types.ts`, `Input/utils.ts`, `Input/constants.ts`                     | PascalCase types and camelCase values                       |
| Domain service or adapter     | `server/generation/service.ts`, `server/providers/tokenhub/client.ts`        | camelCase functions or PascalCase classes                   |
| Feature contracts/validation  | `features/episode/types.ts`, `features/episode/schema.ts`                    | PascalCase types and camelCase schemas                      |
| Unit or integration test      | `Input/index.test.tsx`, `tests/features/episode/selection.test.ts`           | descriptive behavior-based test names                       |
| Browser test, when introduced | `tests/features/episode/export.spec.ts`                                      | descriptive user workflow names                             |
| Documentation                 | `episode-pipeline-spec.md`                                                   | a title describing its subject                              |

Keep framework and ecosystem filenames unchanged: `page.tsx`, `layout.tsx`, `route.ts`, `loading.tsx`, `error.tsx`, `not-found.tsx`, `proxy.ts`, `next.config.ts`, `AGENTS.md`, and `README.md`. App Router segments such as `[locale]` and route groups follow Next.js conventions.

- Application, server, shared, and test implementations must use TypeScript; UI uses `.tsx` and non-JSX code uses `.ts`.
- Component directories use PascalCase and expose their component through `index.tsx`. Import the directory rather than spelling `/index`; keep exports named and consistent with the directory.
- Prefer `index.module.scss` beside `index.tsx`. The suffix is `module`, not `moudle`; do not use unscoped `index.scss` for ordinary component styles.
- Sass is installed with pinned pnpm and recorded in `pnpm-lock.yaml`. All current component CSS Modules have migrated to `index.module.scss`; do not reintroduce `.module.css`, unscoped component styles, or shared component stylesheets. App Router entries may own matching styles such as `app/layout.module.scss`; `app/globals.css` owns global tokens and the explicitly retained legacy Tailwind entry.
- Within a named component/domain directory, prefer short owned files such as `types.ts`, `schema.ts`, `hooks.ts`, `utils.ts`, `service.ts`, and `api.ts`. Create only files with actual responsibilities; this is not a mandatory empty-file template.
- A single named hook uses `use-*.ts`; a component-owned `hooks.ts` groups only closely related hooks. Exported hook identifiers always start with `use`. Split unrelated hooks by responsibility.
- `episode/components/Editor/index.tsx` is preferred to `components/episode-script-storyboard-editor.tsx`. Do not repeat `episode-editor` in every file inside an already named `Editor` directory.
- Avoid names such as `new`, `v2`, `final`, `temp`, `misc`, and generic catch-all `manager` files. Name the actual responsibility.
- A component's `index.tsx` is its implementation/entry, not a requirement to create barrel files throughout the repository. Use `index.ts` barrels only for deliberate public module interfaces; never re-export server-only code through a client-facing barrel.
- Small private child components can stay in `index.tsx` while cohesive and within the limits. When extracted, give a child its own directory such as `Editor/Toolbar/index.tsx`; do not flatten it into a long business-prefixed filename.
- The scoped directory migration has removed flat application components. The checker now rejects non-route production TSX outside `components/<PascalCase>/index.tsx`; there is no flat-filename compatibility exemption. A behavior-preserving move or extraction does not clear that implementation's Tailwind, provider, React, or size debt.
- Style files are required only when the component owns styles. Do not add empty `index.module.scss`, `types.ts`, or `hooks.ts` placeholders. Unstyled composition components may have only `index.tsx`; moved legacy Tailwind components remain explicitly pending a styling migration.

```text
src/features/episode/
  types.ts
  schema.ts
  components/
    Editor/
      index.tsx
      index.module.scss
      types.ts
      hooks.ts
      utils.ts
      index.test.tsx
      Toolbar/
        index.tsx
        index.module.scss
src/components/ui/
  Input/
    index.tsx
    index.module.scss
```

Routing files remain the Next.js exception: keep `[locale]/page.tsx`, `[locale]/layout.tsx`, and `api/**/route.ts`, never `Page/index.tsx` for a route entry. Pure server/shared/domain directories are not PascalCase component folders.

## File Length

Count physical lines, including imports, comments, and blank lines. Formatting must not be compressed to evade a limit.

| File type                                      | Soft limit   | Hard limit               | Action above soft limit                                               |
| ---------------------------------------------- | ------------ | ------------------------ | --------------------------------------------------------------------- |
| Ordinary TS/TSX                                | 300 lines    | 500 lines                | Review cohesion and split independent responsibilities                |
| React component (`.tsx`)                       | 250 lines    | 500 lines                | Extract cohesive child components or interaction hooks                |
| Hook (`hooks.ts`, `use-*`, or `hooks/`)        | 200 lines    | 500 lines                | Separate state, effects, services, and pure transformations           |
| Service / business logic                       | 300 lines    | 500 lines                | Split by business responsibility                                      |
| Utilities (`utils/`, `utils.ts`, `*-utils.ts`) | 200 lines    | 500 lines                | Split by domain, not numbered helper files                            |
| Single function, including JSX                 | 50 lines     | No mechanical hard limit | Inspect responsibility and nesting; avoid fragmented trivial wrappers |
| Route page, layout, or API handler             | 100 lines    | 200 lines                | Keep composition/validation at the entry; delegate implementation     |
| CSS / SCSS Module                              | 200 lines    | 400 lines                | Split with its component's ownership                                  |
| Test / spec / benchmark                        | 500 lines    | No mechanical hard limit | Group by behavior; keep related setup together                        |
| JSON / configuration / generated output        | Not enforced | Not enforced             | Review structure and ownership instead                                |

The general source rule is **300 lines soft, 500 lines hard**, with the category-specific limits above. Exactly 500 source lines is permitted; 501 is blocked unless an explicit existing-file budget applies. Soft limits produce review warnings, not mandatory splits at the next line. Routes and CSS Modules retain their stricter existing ceilings. Tests have a relaxed advisory limit rather than the production hard ceiling.

These are ceilings, not desired sizes. Small cohesive files are preferred. A file under the limit still needs splitting if it mixes unrelated responsibilities.

JSON data, lockfiles, translation dictionaries, `*.config.ts` / `*.config.mts` configuration, and prose documentation are not subject to source-file line limits. Executable TypeScript fixtures still use the source limit. Generated build output lives outside the scanned source roots; any future generated source inside them needs an exact reviewed exemption with a reproducible generator. A `generated` comment or filename does not bypass checks. Never classify handwritten business logic as configuration or generated output to evade a limit.

## Split By Responsibility

- Pages compose feature views; route handlers validate requests and delegate to server services.
- Separate a complex editor's presentation, interaction state, pure transformations, and network integration when they have independent responsibilities.
- Keep IP assets, script writing, generation jobs, candidate selection, and post-production under their owning features.
- Put feature-only helpers next to their feature. Move code to `src/shared` only when multiple domains need the same stable behavior.
- Extract reusable visual controls at a real interaction boundary. Do not create many tiny files solely to satisfy a line count.
- File splitting must not move provider SDKs into UI components, client hooks, or shared client barrels.
- Split even below the soft limit when one module owns unrelated business stages, several independent effects/state machines, UI plus transport/persistence, or code with different reasons to change.
- Do not evade limits by compressing formatting, deleting useful comments, adding numbered partial files, or shifting all logic into a generic utility.

## Existing Oversized Files

Legacy files such as the current Studio workspace and large media panels already exceed these limits. Framework compatibility fixes, message extraction, and behavior-preserving moves may touch them without forcing an unrelated rewrite.

- Moving or renaming a legacy file preserves its legacy status; it does not count as completion of its split.
- New orchestration and unrelated feature logic must go into appropriately sized owned modules.
- Record the affected legacy path, the scoped reason for touching it, and the remaining split work in the implementation status document or task list.
- When a file is fully rewritten or new feature logic is extracted, apply the limits above to the resulting files.
- The exact historical limits and split reasons live in [`file-size-baseline.json`](../harness/file-size-baseline.json). Each budget is the existing physical line count, not permission to grow up to a rounded number.
- Existing oversized files may shrink, but must not grow above their recorded budget. Lower the budget when reducing debt. Remove an entry when its file is deleted or reaches the normal hard limit; the check rejects stale entries.
- Adding or increasing an exception requires explicit review and an updated migration task. Routine install, build, test, and CI commands must never regenerate the baseline.

## Review And Enforcement

Run `pnpm check:harness` locally and in the Quality workflow. `pnpm check:harness --verbose` lists all advisory warnings. Hard violations return a nonzero exit code; soft warnings remain visible and require a review decision, not an automatic baseline increase.

The TypeScript checker scans `src`, `scripts`, `tests`, `bench`, and `docs` for supported text files, plus root package-manager metadata. It accepts PascalCase component directories (including nested children), kebab-case ordinary names, and explicit framework/document exceptions. It enforces `index.tsx`, style naming/colocation, component-directory imports without `/index`, classified file limits, and a TypeScript AST function-size advisory. Test classification takes precedence over component/hook classification.

The repository pass rejects duplicate page trees outside `app/[locale]`, localized API directories, a second `middleware.ts` entry, new catch-all `src/hooks`, `src/data`, and `src/types` files, additions outside the exact eight-file `src/lib` compatibility allowlist, business imports from reusable UI/providers/shared helpers, unguarded server implementations, and known provider SDK imports outside server adapters or existing legacy clients. It follows literal local runtime imports/re-exports, including dynamic imports, to detect client-to-server dependency chains; type-only imports are excluded. It also requires one root pnpm lockfile and matching exact `packageManager` / `engines.pnpm` pins.

These static checks do not prove the absence of raw provider HTTP calls, dynamically constructed imports, transitive external-package behavior, or new Tailwind class strings. Review and behavior tests still enforce those boundaries, short local names, exported identifiers, semantic ownership, no repeated domain prefixes, and generated-file provenance. Existing Worker/runtime JavaScript and generated build/public assets remain separately owned migration work outside this checker. This command does not replace lint, typecheck, tests, or business acceptance. Baseline changes require review.
