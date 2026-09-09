# Short-Drama Business Rules

Last updated: 2026-09-07

## Scope And Reference Policy

Xct Studio is an integrated short-drama production workstation, not a set of disconnected generation demos. Preserve its existing generation, assets, authorization, community, and export capabilities while introducing durable production records.

The following reference roles are adopted from the user's supplied comparison. They are design directions, not a verified audit of those projects, their feature completeness, or their licenses. Before adopting code or dependencies, record the exact repository URL, revision, license, security implications, and compatibility in an architecture decision. Do not copy the screenshot's ratings as evidence.

| Reference                 | Role for Xct Studio                                                              | Boundary                                                                                               |
| ------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| AIDrama Studio            | Primary product-structure reference: creative input through finished short drama | Adapt domain concepts; do not replace the existing application or assume its stack fits                |
| Storyboard Forge          | Workflow reference: Script -> Character -> Scene -> Director -> Video            | Keep editable intermediate records and provider-independent stages                                     |
| StoryMind                 | Director/agent reference: planning, prompt assembly, review feedback             | Agents propose versioned drafts; they do not silently approve, publish, or spend without authorization |
| Nautilus Studio           | Continuity reference: reusable assets, cross-shot context, provider adapters     | Apply explicit version locks and continuity checks; do not promise perfect character consistency       |
| KupkaProd Cinema Pipeline | Optional reference for script analysis, take selection, and final assembly       | Not the primary application architecture or deployment model                                           |

## Production Model

The required business flow is:

```text
Idea / Novel / Imported Script
  -> IP And Character Assets
  -> Script Version -> Episode -> Scene -> Shot
  -> Storyboard Review -> Generation Job -> Candidate -> Selected Take
  -> Episode Version -> Audio And Captions -> Localized Version -> Export
```

- An IP groups a story world and reusable characters, locations, props, style, and voice assets.
- An Episode is one production unit, not just a script file or a generated clip. It has a source language, target duration, script version, shot plan, and output versions.
- A Scene is a narrative context; a Shot is an independently planned visual unit. Shots are not fixed 30-second blocks. Duration follows narrative intent and the selected model's supported limits.
- A Candidate is one generated result, not automatically the final take. A Selected Take is an explicit editorial choice with a durable candidate reference.
- A generation job is an execution record, separate from the Shot and Candidate. Failures and retries must not corrupt editorial state.
- Episode Versions and Localized Versions retain the exact selected media, audio, captions, and export settings used.

## Integrated Workflow

1. Accept a story idea, novel excerpt, or imported script with source and usage-rights metadata. AI rewriting and breakdown produce editable drafts.
2. Extract and review character/IP assets before production. Unknown or unapproved references must be visible, not silently substituted.
3. Create versioned scripts, Scenes, and Shots. Each Shot records narrative purpose, action, participants, duration, dialogue, visual direction, and continuity dependencies.
4. Present a reviewable storyboard before bulk generation. Basic users can accept or edit automatic plans; lens, framing, and motion controls are optional advanced inputs.
5. Generate image/storyboard, video, and audio candidates through application services. Show progress, estimated cost, failures, cancellation, and retry state where supported.
6. Compare candidates in Shot context, record rejection reasons, and explicitly select or lock takes. Bulk auto-selection is a visible draft suggestion requiring confirmation.
7. Assemble selected takes with trims, transitions, music, voiceover, captions, and aspect-ratio/export presets. Missing or inaccessible required media blocks final export with an actionable reason.
8. Derive multilingual subtitles and dubbing from a declared source version. Export a specific Episode or Localized Version without overwriting its source.

Do not require professional cinematography knowledge for the basic workflow. Do not reduce the workflow to an opaque one-click generation task that loses intermediate edits or recovery points.

## IP And Continuity

- Character identity, wardrobe, reference packs, voice identity, locations, props, and visual style must have explicit reusable records and version references.
- Resolve continuity locks in IP -> Episode -> Scene -> Shot order; surface overrides and conflicts before submission.
- Store the exact approved asset versions, ordered reference ids, prompt snapshot, model parameters, and source Shot version with every generation attempt.
- Carry relevant adjacent-shot context such as pose, screen direction, wardrobe, props, lighting, and approved start/end frames when the provider supports it. Unsupported capabilities must be reported rather than simulated silently.
- Changing an IP asset or script creates a new version. Mark dependent plans or outputs as needing review; never rewrite existing selected takes or historical export snapshots.
- Continuity scores are advisory with inspectable reasons. Human approval, rejection, and override remain possible. A fixed seed or reference image is not a guarantee of identity consistency.
- Private portrait references and voice assets require authorized use and must not leak into public share records.

## Asset Admission And Rights

Reference upload and generation are separate gates. Except for material generated by the Studio through Seedream, a raw URL or uploaded file is not generation-ready until the provider review has produced an Asset ID.

| Material class                             | Required before generation                                                                                      |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| No recognizable person and no protected IP | Material review plus active Asset ID. This avoids false blocking during generation.                             |
| Official ModelArk material                 | Asset ID selected in the ModelArk console or delivered through the approved offline batch process.              |
| Seedream-generated material                | Review-exempt for this product flow; retain generation provenance.                                              |
| External AI material                       | Virtual asset review plus active Asset ID.                                                                      |
| Ordinary real person                       | Explicit consent, face verification, and active Asset ID.                                                       |
| Public figure                              | Complete likeness authorization or provider verification, account allowlisting, then obtain an active Asset ID. |
| Protected or well-known IP                 | Complete the copyright chain and offline authorization, allowlist the account, then obtain an active Asset ID.  |

- The lifecycle is `uploaded -> reviewing -> approved -> active`, with explicit `rejected`, `revoked`, and `exempt` outcomes. Upload success alone never satisfies the gate.
- Ordinary real-person assets require the provider's face-verification flow; every recognizable person must complete it. Public-figure and protected-IP rights are handled through the provider's offline authorization/OA and account-allowlisting process, not a Studio-managed upload or admin review.
- Official assets use Asset IDs obtained from the ModelArk console or an approved offline batch. Seedream-generated assets are exempt in this product flow.
- User-uploaded and provider-reviewed custom assets are presented as **My Xcity assets**. BytePlus reference assets are presented separately as the **Seedance official asset library** and must not be merged into the user's private AIGC groups.
- The product must not mirror, cache, or imply unrestricted reuse of BytePlus reference assets. Until BytePlus provides an approved catalog API and usage permission, the official-library entry links users to ModelArk Playground and accepts the selected Asset ID.
- The Assets view keeps reviewed and unreviewed uploads in one list, sorts usable assets first, and only enables reference actions for active Asset IDs or exempt Seedream assets.
- The **Available assets** filter includes only items with a generation-ready reference: an active provider Asset ID or an exempt Seedream source URL.
- Portrait-group image selectors show thumbnails and omit material that already has an active Asset ID.
- Store provider, account/workspace, Asset ID, material hash, source class, review state, authorization ids, subject coverage, and timestamps. Generation attempts snapshot these values; later revocation must not rewrite history.
- Provider moderation is the review gate. Studio only displays and persists provider state; it does not make an independent approval decision.
- Provider `Processing` means the material is under review. The Assets view must let the user explicitly query the provider and persist the latest returned state without resubmitting the material.
- Asset IDs are provider transport identifiers. Prompt text continues to refer to ordered inputs such as `[Image 1]`; do not interpolate raw Asset IDs into creative prompts.
- Private material-library calls belong behind server provider adapters. UI components may submit typed application commands but must never call the ModelArk API directly.
- ModelArk console is the first path for obtaining individual official Asset IDs. If a batch is needed, use the approved OA/offline delivery process; the current operational contact supplied by the business is Wu Yin, but that contact must not be hard-coded into product logic.

The current KYC High documentation is invitation-gated. Use the following source index when implementing the provider adapter:

- [Seedance 2.X KYC customer guide](https://bytedance.larkoffice.com/wiki/RsPLwwv0oi4Pjfkwx8pcLklDnue)
- [Private virtual avatar asset-library guide](https://docs.byteplus.com/en/docs/ModelArk/2333565)
- [Private virtual avatar API reference, nine interfaces](https://docs.byteplus.com/en/docs/ModelArk/2333601?lang=en)
- [Real-human portrait-library API reference](https://docs.byteplus.com/en/docs/ModelArk/2333602?lang=en)
- [Private real-human asset-library guide](https://docs.byteplus.com/en/docs/ModelArk/2333589?type=preview&lang=en)

Do not invent hidden endpoint paths or request fields from the guide index. Capture the enabled account's exact API schema in the server adapter and fixture tests after KYC High access exposes the reference content.

## Director And Agent Boundaries

- Separate analysis, planning, prompt assembly, execution, and quality review. Preserve each stage's inputs, outputs, status, and editable draft.
- Agents use validated structured contracts and server-owned tools. They must not invoke provider endpoints from UI components or treat imported story text as application instructions.
- Preview the affected Shots, reference versions, model, candidate count, and estimated cost before a batch run. Execute only within a creator-approved run and budget; pausing or exhausting that budget stops new submissions.
- Retries use idempotency and attempt records. Re-running one failed Shot must not regenerate the whole episode or charge for completed work unintentionally.
- Replanning cannot unlock selected takes, replace approved character versions, delete candidates, publish content, or expand a paid run without explicit confirmation.

## Captions, Audio, And Languages

- UI locale (`/zh`, `/en`) is independent from source script language, subtitle language, dubbing language, and distribution locale.
- Caption tracks retain cue ids, speaker, text, and timing in milliseconds. Preserve source captions when producing translated drafts.
- Voice tracks reference the approved voice identity and language; character names and terminology follow an IP-level glossary.
- Translation/dubbing changes create a child localized version with review state. Audio duration changes must trigger timing and caption checks before export.
- Export records identify the exact subtitle/audio tracks and whether captions are embedded, burned in, or delivered as sidecars. Unsupported combinations must be rejected explicitly.

## Ownership And Acceptance

Feature ownership follows the existing directory map: `ip` owns continuity assets, `script` owns writing and breakdown, `episode` owns the shot plan and selection, `generation` owns jobs/candidates, `assets` owns media records, `post-production` owns assembly/audio/captions/export, and `localization` owns translated and dubbed versions. Server services own execution and persistence boundaries.

Every production-feature change must demonstrate, as applicable:

- Traceability from export back to source version, selected candidates, and IP locks.
- Editable drafts and explicit approval gates before destructive or paid operations.
- Recovery after reload or partial failure without losing selected takes or duplicating jobs.
- Continuity override visibility and version invalidation when upstream inputs change.
- Independent source and localized tracks; switching the UI language does not mutate production content.
- No unauthorized exposure of private media, portrait references, credentials, or voice assets.

These are target acceptance constraints, not a claim that the current app already implements the Episode Pipeline. Track delivery in [the platform task list](../requirements/xct-studio-task-list.md), with detailed contracts in [Episode Pipeline](../requirements/episode-pipeline-spec.md) and [IP continuity](../requirements/ip-continuity-spec.md).
