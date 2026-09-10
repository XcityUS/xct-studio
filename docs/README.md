# Xct Studio Documentation

This directory defines the product and engineering harness for Xct Studio.

Xct Studio is evolving from an AI video generator into a short-drama production workstation. The target workflow is:

Project -> Project Assets -> IP -> Episode -> Scene -> Shot -> Candidate -> Selected Take -> Assemble -> Export

## Reading Order

Current delivery tracking: [Short Drama P0 task breakdown and backend ownership](requirements/short-drama-p0-task-breakdown.md). XCT Studio does not connect to a database; business persistence and execution belong to xcity-litellm. The checklist maps all 18 P0 acceptance items to tasks.

For the current short-drama P0 work, start with [P0 requirements](requirements/short-drama-p0-requirements.md), then [P0 Implementation Plan](architecture/short-drama-p0-implementation-plan.md). The plan records current `/video` evidence, data models, state machines, APIs, module boundaries, migration, and task dependencies. It is proposed, not an implementation-completion claim. P0 requirements take precedence over conflicting older product scopes and sequencing.

Start with [the required engineering baseline](rules/core-conventions.md): TypeScript, no Tailwind CSS, Server Components preferred, and AI provider calls behind server application services.

Follow [file naming and size rules](rules/files.md): PascalCase component folders with `index.tsx` / `index.module.scss`, short owned filenames without repeated business prefixes, classified line limits, and explicit legacy handling.

Follow [typo and naming correction rules](rules/naming-corrections.md): correct obvious internal mistakes, preserve external contracts, and report every automatic correction to the user.

Follow [short-drama business rules](rules/business.md) for reference-project roles, the integrated production workflow, director/agent boundaries, IP continuity, and multilingual delivery.

1. Read architecture/xct-studio-harness-plan.md for the target repository layout and migration boundaries.
2. Read architecture/xct-studio-implementation-plan.md for the staged implementation sequence.
3. Read requirements/short-drama-platform-prd.md for the product baseline.
4. Read requirements/project-asset-workspace-spec.md, requirements/ip-continuity-spec.md, and requirements/episode-pipeline-spec.md before implementing production features.
5. Read rules/ before changing code in the corresponding area.

The current research-backed proposal for the next production chain is
[Episode Production Pipeline Architecture Proposal](architecture/episode-production-pipeline-proposal.md).
It is a proposed design awaiting human approval; it does not override the accepted business rules or authorize implementation.

## Directory Ownership

Current boundary decision: [Short-drama backend ownership](architecture/short-drama-infrastructure.md). The experimental Studio database/API/worker implementation was withdrawn; it has not been migrated or deployed to LiteLLM.

| Directory     | Purpose                                                             |
| ------------- | ------------------------------------------------------------------- |
| architecture/ | System boundaries, target layout, and implementation sequencing.    |
| harness/      | Directory maps and migration landing zones.                         |
| requirements/ | Product behavior, acceptance criteria, and task lists.              |
| rules/        | Engineering constraints that apply while implementing the platform. |

## Source Of Truth

Current shipped behavior is defined by the repository code.

These documents define the intended target architecture and product model. When an implementation changes either current behavior or the target model, update the relevant requirement and rule in the same change.
