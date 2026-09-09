# XCT Studio Episode Production Pipeline Architecture Proposal

Status: Proposed, awaiting product and architecture approval

Research date: 2026-09-09

Repository baseline: `e87712a22e94469044966a7d770fb7160f771891`

## 1. Executive Decision

XCT Studio should build one shared, durable Episode Production Pipeline and expose two operating policies on top of it:

- **Agent Mode** automatically advances safe draft-producing steps and pauses at explicit review, cost, selection, and publication gates.
- **Manual Mode** exposes the same records and commands step by step.

They must not become two pipelines. Separate pipelines would create incompatible project state, duplicated retry logic, and a migration problem whenever a user switches modes.

The first main flow should be:

```text
Import Script
  -> Normalize And Save Script Version
  -> AI Analysis Draft
  -> Entity Mapping And Asset Binding
  -> Scene / Shot Breakdown Draft
  -> Human Review And Publish
  -> Shot Readiness Check
  -> Generate Multiple Candidates
  -> Select And Lock One Take
  -> Assemble Episode Version With Existing Post-production Capability
```

The highest-priority product feature is therefore **script-to-selected-takes**, with a thin assembly adapter at the end. Subtitles, multilingual delivery, and advanced timeline work should follow only after this traceable spine exists.

## 2. Scope And Research Method

This proposal is based on:

- the current XCT Studio source, requirements, storage rules, APIs, Asset ID flow, generation history, and assembly/caption utilities;
- Jellyfish at commit [`a967819`](https://github.com/Forget-C/Jellyfish/tree/a9678194ddf2d9be3ccbe78d4287d87d5089e123);
- Storyboard Forge at commit [`371ee3a`](https://github.com/lioneltchami/storyboard-forge/tree/371ee3af83b4bb4d85b61ff1738f281c562a4acf);
- AIDrama Studio at commit [`3991bbb`](https://github.com/EvoLinkAI/ai-short-drama/tree/3991bbb170fe15ee4f8ea403807f7da1c877a3da);
- the supplied screenshot as UX inspiration only, not as evidence of implementation or architecture.

The research separates repository claims from recommendations. It does not assume that README claims are fully implemented, and it does not recommend copying source code. License compatibility must be reviewed before any code reuse.

## 3. Open-source Architecture Comparison

### 3.1 Summary

| Dimension | Jellyfish | Storyboard Forge | AIDrama Studio | XCT implication |
| --- | --- | --- | --- | --- |
| Primary shape | Server-backed production workspace | Local-first Electron creator tool | Server-backed end-to-end studio | Use server-backed production records while keeping XCT's existing browser media UX |
| Top hierarchy | Project -> Chapter -> Shot | Project -> Episode -> Shot | Project -> StudioProject -> Episode -> Clip -> Storyboard -> Panel | Project -> Episode -> Scene -> Shot is the clearest model for XCT |
| Script versioning | Chapter stores current raw/condensed text | Project store holds current raw/parsed data | Episode stores current novel/script-like fields | Add an explicit immutable ScriptVersion |
| Narrative Scene | No clear narrative Scene; Scene is mostly a reusable location asset | ScriptScene combines narrative/location concerns | Clip is the closest narrative block | Keep narrative Scene separate from LocationAsset |
| Operational shot | Shot + ShotDetail | Shot | Panel, while StudioShot is a separate analysis object | Keep one Shot concept; avoid Shot/Panel duplication |
| Asset consistency | Explicit characters, actors, costumes, scenes, props and link tables | Rich character bible and scene viewpoints | Global/project assets, appearances, panel references | Reuse XCT Asset IDs through versioned bindings and immutable snapshots |
| AI parsing | Async division/extraction, candidate confirmation, readiness | AI structure detection plus deterministic fallback and staged calibration | Multi-step story-to-script and script-to-storyboard orchestration | Use staged structured drafts, deterministic normalization, and human mapping gates |
| Human review | Extracted entity/dialogue candidates and shot preparation | Calibration, asset setup, prompt and shot editing | Import wizard, stage editing, candidate selection | Review mapping, publish storyboard, approve paid run, select take |
| Candidate/Take | Extracted candidates are mostly entity candidates; generated video appears shot-centric | Single image/video fields per Shot | Panel candidate image JSON plus current image/history | Normalize generated Candidate and SelectedTake as separate records |
| Async tasks | Durable GenerationTask + links, Celery dispatch/cancel | In-memory task queue and polling | Durable Task plus graph run/step/attempt/checkpoint infrastructure | Start with durable jobs/attempts/events; defer a generalized workflow graph |
| Failure/retry | Task status, cancellation, executor id, service-level recovery | Limited local retries | Idempotency, attempts, heartbeat, events, graph invalidation | Persist idempotency, attempts, error class, retry policy and provider task id |
| Final organization | Shot video plus export workspace | Local timeline/editor data | Episode media, panel videos and editor project | Create immutable EpisodeVersion snapshots from selected takes |

### 3.2 Jellyfish

Jellyfish models `Project -> Chapter -> Shot`. A Chapter owns script text and Shots, while ShotDetail carries camera, action, dialogue, location and prompt preparation fields. Reusable characters, actors, costumes, location-like scenes and props are linked at project and shot scope. Its public workflow is `script breakdown -> shot preparation -> candidate confirmation -> shot ready -> generation workspace`.

Its most valuable idea is not a particular table; it is the **preparation gate**. Extracted character/location/prop/dialogue candidates remain pending until accepted, linked or ignored, and a unified readiness service decides whether a Shot may generate. Generation work is represented separately by a durable task with task kind, progress, payload/result/error, executor identity and cancellation state; task links attach execution back to domain records.

What XCT should borrow:

- an explicit Shot readiness projection;
- extracted-entity mapping as a human-reviewable draft;
- task records separate from Shots and generated media;
- context links from tasks back to Project/Episode/Scene/Shot;
- cancellation, retry and recovery as production behavior.

What XCT should not copy:

- Chapter as the core production unit; XCT needs Episode, and Chapter can remain an import/source concept if long-form novels later require it;
- in-place chapter script text without ScriptVersion;
- using one location asset concept as both narrative Scene and reusable environment;
- a single generated video pointer on Shot instead of normalized Candidates and SelectedTake.

Evidence: [Jellyfish overview and workflow](https://github.com/Forget-C/Jellyfish/blob/a9678194ddf2d9be3ccbe78d4287d87d5089e123/README.md), [project/chapter models](https://github.com/Forget-C/Jellyfish/blob/a9678194ddf2d9be3ccbe78d4287d87d5089e123/backend/app/models/studio_projects.py), [shot models](https://github.com/Forget-C/Jellyfish/blob/a9678194ddf2d9be3ccbe78d4287d87d5089e123/backend/app/models/studio_shots.py), [task model](https://github.com/Forget-C/Jellyfish/blob/a9678194ddf2d9be3ccbe78d4287d87d5089e123/backend/app/models/task.py), and [shot preparation state](https://github.com/Forget-C/Jellyfish/blob/a9678194ddf2d9be3ccbe78d4287d87d5089e123/backend/app/services/studio/shot_preparation_state.py).

### 3.3 Storyboard Forge

Storyboard Forge is a local-first Electron application. Its per-project script store combines raw text, parsed script, Episodes, characters, scenes, Shots, background context and generation statuses. It has a comparatively rich Shot structure and a strong authoring vocabulary: narrative purpose, visual direction, camera fields, dialogue/audio, character variants, continuity reference, bilingual prompts and keyframes.

Its parser is useful as a workflow reference. It normalizes the source, detects structure with AI, falls back to deterministic parsing, then calibrates characters, scenes, viewpoints and shots in stages. Its character consistency system uses a detailed character bible and reference anchors. The UX lets users progressively refine the result rather than requiring film terminology up front.

What XCT should borrow:

- deterministic import normalization and fallback parsing before/around AI;
- series/episode context supplied to episode-level analysis;
- staged calibration rather than one giant prompt;
- scene viewpoints and progressive disclosure of advanced Shot fields;
- separate UI locale and prompt/content language.

What XCT should not copy:

- browser/local project JSON as the durable source of truth;
- a monolithic store containing all script, entity, shot and generation state;
- direct provider calls or browser-held provider keys;
- one image/video status and URL on Shot;
- the full professional field set as mandatory input for ordinary users.

Storyboard Forge is AGPL-3.0 with a separate commercial-license path. Architectural study is safe, but copying implementation into XCT requires explicit legal review.

Evidence: [Storyboard Forge overview and architecture](https://github.com/lioneltchami/storyboard-forge/blob/371ee3af83b4bb4d85b61ff1738f281c562a4acf/README_EN.md), [workflow guide](https://github.com/lioneltchami/storyboard-forge/blob/371ee3af83b4bb4d85b61ff1738f281c562a4acf/docs/WORKFLOW_GUIDE.md), [script types](https://github.com/lioneltchami/storyboard-forge/blob/371ee3af83b4bb4d85b61ff1738f281c562a4acf/src/types/script.ts), [project script store](https://github.com/lioneltchami/storyboard-forge/blob/371ee3af83b4bb4d85b61ff1738f281c562a4acf/src/stores/script-store.ts), [task queue](https://github.com/lioneltchami/storyboard-forge/blob/371ee3af83b4bb4d85b61ff1738f281c562a4acf/src/packages/ai-core/api/task-queue.ts), and [license](https://github.com/lioneltchami/storyboard-forge/blob/371ee3af83b4bb4d85b61ff1738f281c562a4acf/LICENSE).

### 3.4 AIDrama Studio

AIDrama Studio is the broadest product reference. It persists Project, StudioProject, Episode, Clip, Storyboard, Panel, assets, media and tasks. Its story-to-script orchestration performs character, location and prop analysis, clip splitting and clip screenplay generation. Its script-to-storyboard orchestration divides work into planning, cinematography/acting and detail steps, with explicit dependencies and retry handling.

The strongest technical reference is its asynchronous execution model: durable Task/TaskEvent records plus more advanced GraphRun, GraphStep, GraphStepAttempt, GraphCheckpoint and GraphArtifact records. It supports deduplication, attempts, provider task identity, progress, heartbeat and recovery. Candidate selection validates that the chosen media belongs to the panel's candidate list before promoting it.

What XCT should borrow:

- a guided import/mapping/confirm experience;
- durable task idempotency, attempts, events, heartbeats and recovery;
- multi-step AI orchestration with inspectable artifacts;
- separate media metadata from business entities;
- candidate membership validation at selection time.

What XCT should not copy:

- overlapping Clip, StudioShot, Storyboard and Panel concepts;
- relationship-heavy data stored as JSON/text lists;
- candidate lists embedded in a panel field;
- current script/SRT/audio fields overwritten on Episode;
- a generalized graph runtime in the first MVP;
- its framework/styling choices as an XCT migration direction.

Evidence: [AIDrama Studio overview](https://github.com/EvoLinkAI/ai-short-drama/blob/3991bbb170fe15ee4f8ea403807f7da1c877a3da/README.md), [Prisma domain and task schema](https://github.com/EvoLinkAI/ai-short-drama/blob/3991bbb170fe15ee4f8ea403807f7da1c877a3da/prisma/schema.prisma), [story-to-script orchestrator](https://github.com/EvoLinkAI/ai-short-drama/blob/3991bbb170fe15ee4f8ea403807f7da1c877a3da/src/lib/studio/story-to-script/orchestrator.ts), [script-to-storyboard orchestrator](https://github.com/EvoLinkAI/ai-short-drama/blob/3991bbb170fe15ee4f8ea403807f7da1c877a3da/src/lib/studio/script-to-storyboard/orchestrator.ts), [candidate selection route](https://github.com/EvoLinkAI/ai-short-drama/blob/3991bbb170fe15ee4f8ea403807f7da1c877a3da/src/app/api/studio/%5BprojectId%5D/panel/select-candidate/route.ts), and [MIT license](https://github.com/EvoLinkAI/ai-short-drama/blob/3991bbb170fe15ee4f8ea403807f7da1c877a3da/LICENSE).

## 4. XCT Studio Current Capability And Gap Analysis

### 4.1 Capabilities that exist and should be reused

| Current capability | Evidence in XCT | Reuse in the pipeline |
| --- | --- | --- |
| Video/image generation and provider abstraction | `src/lib/video-service.ts`, `src/lib/image-service.ts`, generation feature | Wrap behind server application APIs; invoke from GenerationJob |
| Reference media and Asset ID admission | `src/features/assets`, portrait/provider API routes | Become the admission gate for asset bindings and continuity packs |
| Provider asset groups and review state | assets hooks/components and server provider adapters | Seed Character/Location/Prop binding UI; persist accepted refs server-side |
| Video job progress, rate-limit handling and resume hints | `use-video-jobs.ts`, generation history | Preserve UX behavior while replacing browser polling ownership with durable job projections |
| R2 media archive and owner-scoped media routes | `media-worker/index.js`, `media-archive.ts` | Continue as binary storage; attach database MediaAsset records to archived objects |
| Browser media cache | Dexie `src/features/assets/storage/db.ts` | Keep for playback/offline cache, never as production source of truth |
| Simple script-to-shot helper | `src/lib/script-breakdown.ts`, ShotBuilderDialog | Reuse only as a migration reference/temporary fallback, not as the new domain service |
| Prompt templates and optimizer | `src/features/script/prompt`, `src/lib/prompt-optimizer.ts` | Feed Shot prompt drafts and snapshots through server-owned services |
| Assembly, trimming and NLE handoff | `src/features/post-production` | Build EpisodeVersion adapter from SelectedTake order |
| Transcription and SRT conversion | `src/lib/captions.ts` | Later create source SubtitleTrack/Cues; first move provider call server-side |
| TTS/BGM/finalization helpers | `src/lib/tts.ts`, FinalizeDialog, AssemblyEditor | Phase 2 post-production adapters |
| Locale-aware shell | `src/i18n` and locale routes | Keep UI locale independent from script/subtitle/audio locale |

At the research baseline, the existing script breakdown defaulted to `gpt-4o-mini`, requested 2–8 JSON shots with description/camera/audio, and ran through a browser-enabled OpenAI client. The 2026-09-09 follow-up added TXT/Markdown/DOC/DOCX/PDF extraction, moved breakdown behind a same-origin server API, and changed its default candidate to `gpt-5-mini`. It still has no Episode, ScriptVersion, narrative Scene, asset mapping, durable draft, provenance or retry record. It remains an interim prompt workflow, not the production pipeline.

### 4.2 Current LLM answer and recommended model policy

Yes, XCT Studio currently calls an LLM for script breakdown. `ShotBuilderDialog` invokes the client application API and lets the user edit the returned shot list; the provider SDK now runs in `src/server/providers/xcity`, behind `/api/script/breakdown`. This is a prompt helper, not the Episode breakdown pipeline described in this proposal.

The server-side default is now `gpt-5-mini`, overridable with `SCRIPT_BREAKDOWN_MODEL`. The inspected gateway configuration declares aliases including `gpt-4.1-mini`, `gpt-5-mini`, `gpt-5`, `gpt-5.5`, `claude-sonnet-4-6`, `gemini-2.5-flash/pro`, `deepseek-v3.2`, `glm-5` and `kimi-k2.6`; configuration does not prove that every production credential, entitlement or route is active.

Recommended policy:

- use deterministic parsing for file normalization and obvious headings/dialogue boundaries;
- make **`gpt-5-mini` the first evaluation candidate** for Chinese entity extraction and structured Scene/Shot drafts because an XCT gateway alias already exists;
- evaluate `deepseek-v3.2`, `glm-5` and `kimi-k2.6` on the same Chinese short-drama fixture set as cost/latency candidates;
- reserve a higher-quality configured model such as `gpt-5`/`gpt-5.5` or `claude-sonnet-4-6` for ambiguous replanning or an optional quality tier, not every parse;
- select by a versioned task policy (`script_analysis`, `entity_mapping`, `shot_planning`, `repair`) instead of a global UI environment variable;
- require schema-valid output, semantic validation and repair/fallback; model JSON alone is never a successful publish;
- record model alias, resolved provider/model where permitted, prompt/schema version, input hash, latency, usage and validation result on every run.

Before committing to a default, run an offline evaluation set containing at least: modern Chinese dialogue, period drama, narration-heavy prose, multi-episode text, aliases, flashbacks, crowd scenes and deliberately malformed scripts. Measure entity recall, speaker attribution, scene-boundary accuracy, duration error, valid-schema rate, edit distance after human review, latency and cost. No paid model calls were made for this research, so this proposal recommends an evaluation order rather than claiming a quality winner.

### 4.3 Missing or insufficient capabilities

| Gap | Why it matters | Decision |
| --- | --- | --- |
| Server relational production database | Current localStorage, IndexedDB and Worker JSON cannot safely own concurrent Episode relationships | Must precede production MVP |
| Durable Project/Episode source of truth in this repository | UI/project context alone is not enough for versioned production data | Reuse platform Project identity if authoritative; do not create a competing Project model |
| ScriptVersion and import artifact | AI reruns and edits otherwise overwrite source and lose traceability | Required |
| Draft analysis/breakdown model | AI should not silently create approved production records | Required |
| Narrative Scene and formal Shot | Current generated-history items are not a storyboard | Required |
| Asset binding, CharacterVersion and immutable reference snapshot | Asset ID alone proves provider identity/admission, not role, continuity version or shot usage | Required |
| Durable job/attempt/event records | Browser polling cannot guarantee idempotent retry or recovery | Required |
| Candidate and SelectedTake | Current history is output-centric and cannot express multiple candidates or editorial locking | Required |
| EpisodeVersion | Assembly must preserve the exact selected order and settings | Required, thin in MVP |
| Source subtitle/localized versions | Existing SRT utility has no durable language/version ownership | Phase 2 |

### 4.4 Can the current Asset system support consistency?

**Partially.** It already supplies important transport and compliance primitives: Asset ID, review/admission state, authorization gating, provider grouping, media URLs and provenance. It does not yet supply the production semantics required for consistency:

- Character versus Location versus Prop role;
- CharacterVersion, wardrobe/look and ordered reference pack;
- Episode/Scene/Shot inheritance and overrides;
- immutable generation-time asset snapshots;
- dependency invalidation when a version changes;
- continuity notes such as screen direction, carried props or previous-frame reference.

The correct extension is to reference existing admitted assets; do not duplicate their bytes or replace the current Asset module.

### 4.5 Key refactor risks

- Building Scene/Shot as new browser-only state before choosing the production database.
- Treating generation history as Candidate without adding Shot ownership, attempt identity and immutable snapshots.
- Keeping new AI parsing in browser components, which would expand the existing credential and recovery debt.
- Letting `Scene` mean both a narrative block and a location asset.
- Storing entity references, candidates or selected takes as JSON arrays on Episode/Shot.
- Using a single Episode status as the source of truth for every parallel child operation.
- Adding Agent Mode as a separate schema or separate page implementation.
- Moving captions/multilingual work ahead of the core selection/version chain.

## 5. Recommended Domain Model

### 5.1 Aggregate ownership

```text
Workspace
  -> Project (existing authoritative identity)
      -> ProjectAsset library
      -> IP / reusable asset context
      -> Episode
          -> ScriptVersion
              -> ScriptAnalysisRun -> AnalysisArtifact
              -> BreakdownRun -> BreakdownDraft
          -> Scene -> Shot
              -> ShotAssetBinding / ContinuityOverride
              -> GenerationJob -> GenerationAttempt -> Candidate
              -> SelectedTake
          -> EpisodeVersion -> EpisodeVersionClip
              -> SubtitleTrack -> SubtitleCue
              -> AudioTrack
              -> LocalizedEpisodeVersion
              -> Export
```

### 5.2 Core entities

| Entity | Responsibility | Important fields/constraints |
| --- | --- | --- |
| Project | Production workspace | authoritative project id, owner/workspace, title, linked IP/series, default content policy, status |
| ProjectAsset | Project-scoped material reference | projectId, mediaAssetId/providerAssetId, kind, sourceType, status, tags, notes, usage summary |
| Episode | One numbered/named production unit | projectId, sequence, title, sourceLocale, targetDurationMs, workflowPolicy, planning status |
| ScriptVersion | Immutable source/editorial version | episodeId, version, sourceType, sourceLocale, rawText/objectKey, contentHash, parentId, status, createdBy |
| ScriptAnalysisRun | One AI/deterministic analysis execution | scriptVersionId, model/prompt versions, status, input/output artifacts, error, confidence/warnings |
| BreakdownDraft | Editable temporary proposal | analysisRunId, revision, draft scenes/shots/entities, review state; never generation-ready |
| Scene | Formal narrative context | episodeId, order, slugline/location/time, summary, dramaticBeat, mood, planRevision |
| Shot | Formal independently generated unit | sceneId, order, purpose, action, emotion, camera, dialogue, durationMs, promptDraft, planRevision |
| AssetBinding | A typed use of an existing asset | scopeType/id, role, assetId, characterVersionId if relevant, priority, source, active interval |
| ContinuityLock | Resolved Episode/Scene/Shot decision | entity/asset version, inheritedFrom, override reason, lockedAt/by |
| GenerationJob | User intent to generate one/many Shots | episodeId, type, status, idempotencyKey, approved budget, requested count, createdBy |
| GenerationAttempt | One provider submission | jobId, shotId, attemptNo, provider/model, parameter/prompt/reference snapshots, providerTaskId, status, cost, error |
| Candidate | Immutable generated output | shotId, attemptId, mediaAssetId, ordinal, metadata, moderation/continuity review state |
| SelectedTake | Editorial pointer, separate from Candidate | shotId unique, candidateId, status selected/locked, selectedAt/by; lock changes are audited |
| EpisodeVersion | Immutable assembly snapshot | episodeId, version, source plan revision, status, duration, settings, parentId |
| EpisodeVersionClip | Ordered selection snapshot | episodeVersionId, order, shotId, candidateId, in/out/duration, transition |
| WorkflowRun/Step/Attempt | Orchestration audit | workflow kind/version, target, status, dependencies, idempotency, artifact refs, retry/error |
| MediaAsset | Metadata for R2/provider/local media | owner, object key/provider URL, media type, checksum, bytes, provenance, availability |

### 5.3 Draft versus formal data

AI output must be a **Draft first**.

- Parsing and analysis write run artifacts and a BreakdownDraft.
- Users may edit, regenerate, compare or discard the draft.
- `Publish Breakdown` is a command that validates and transactionally creates or revises formal Scene/Shot records.
- A later AI rerun never overwrites published Scene/Shot data. It creates another run/draft and offers a diff/replace/merge operation.
- Paid generation reads only a published Shot revision and snapshots it into GenerationAttempt.

This boundary gives rollback, provenance, safe regeneration and a comprehensible review point without versioning every keystroke as a full ScriptVersion.

### 5.4 Database relationships and invariants

```text
Project 1---N Episode
Project 1---N ProjectAsset
Project 1---N Character
Character 1---N CharacterVersion
CharacterVersion 1---N ReferencePack 1---N ProjectAsset
Episode 1---N ScriptVersion
ScriptVersion 1---N ScriptAnalysisRun
ScriptAnalysisRun 1---N BreakdownDraft
Episode 1---N Scene 1---N Shot
Shot 1---N GenerationAttempt 1---N Candidate
Shot 1---0..1 SelectedTake N---1 Candidate
Episode 1---N EpisodeVersion 1---N EpisodeVersionClip
EpisodeVersionClip N---1 Shot
EpisodeVersionClip N---1 Candidate
EpisodeVersion 1---N SubtitleTrack 1---N SubtitleCue
EpisodeVersion 1---N LocalizedEpisodeVersion
```

Required invariants:

- `ScriptVersion` content is immutable after activation; edits create a child version.
- `Scene.order` is unique within Episode; `Shot.order` is unique within Scene or use stable rank keys.
- a SelectedTake candidate must belong to the same Shot;
- only one active SelectedTake exists per Shot by default;
- a locked SelectedTake changes only through an explicit unlock/replace command and audit event;
- Candidate and GenerationAttempt snapshots are immutable;
- EpisodeVersionClip references exact Candidates, never merely the current SelectedTake;
- provider retries create GenerationAttempts; they do not overwrite prior attempts or Candidates;
- object storage holds bytes; relational rows hold ownership and lifecycle;
- global/media-library assets can be attached to multiple Projects, but ProjectAsset owns production classification, tags, and usage;
- editable commands use optimistic concurrency (`revision`/`If-Match`).

## 6. Recommended Episode Pipeline

### Stage 0: Create project production context

Create or open a short-drama Project first. Reuse the existing authoritative Project identity if it exists; otherwise introduce one server-side source of truth rather than a browser-only project placeholder.

The Project owns:

- Project Assets;
- linked IP/story world;
- Episodes;
- default source language, output policy, aspect ratio, visual style and workflow policy;
- unresolved blockers across assets, scripts, generation and export.

### Stage 0A: Prepare Project Assets

Attach existing global assets, upload new media, register official/provider Asset IDs, and create character groups inside the Project. Classify material as character, location, prop, audio, document, style, video, image or other.

Project Assets are the production-facing layer. They point to existing media/provider records but add Project-specific meaning, review state, tags, notes and usage. Do not duplicate bytes from the existing Asset module.

Create Episode with source language, target duration, aspect ratio, visual style and operating policy. These settings are defaults, not hidden prompt text.

### Stage 1: Import and normalize script

Accept paste/upload; record source type, original file/object, encoding, language and content hash. Deterministically normalize headings, dialogue and line breaks. Create ScriptVersion `draft`; do not lose original input.

### Stage 2: Analyze into an editable understanding draft

Run structured AI tasks for:

- episode summary, hook, beats and duration warning;
- characters, aliases and appearances;
- locations, time-of-day and reusable props;
- scene boundaries and dialogue/speaker mapping;
- ambiguity and missing-context warnings.

Use schema validation and deterministic fallback where possible. Persist model, prompt/template version, input hash and artifacts. For early implementation, use a high-quality structured-output model behind the existing LiteLLM/OpenAI-compatible server boundary. Keep model choice configurable by task; do not hard-code a product-wide LLM in UI code.

### Stage 3: Map entities to Project Assets

Match extracted characters/locations/props against Project Assets first, then optionally search reusable/global assets for attachable matches. Auto-link only high-confidence exact/approved matches. Present ambiguous, missing or unauthorized items for review. Users can bind existing Project Assets, attach an existing library asset to the Project, create placeholders, ignore non-visual entities or request asset creation/review.

This gate should not require every prop to have an image. It must require admitted references only when the chosen model/prompt will actually submit them.

### Stage 4: Produce Scene/Shot breakdown draft

Use the active ScriptVersion, approved entity map, target duration, aspect ratio and style to create an editable BreakdownDraft. Basic fields are mandatory; advanced cinematography is optional.

Each draft Scene contains narrative context. Each draft Shot contains purpose, action, participants, emotion, dialogue/voiceover, target duration, camera suggestion, draft prompt and continuity dependencies.

### Stage 5: Review and publish storyboard

The user may reorder, split, merge, add, delete and edit. The system validates total duration, missing actors/locations, unsupported model duration and unresolved references. `Publish` creates formal Scenes/Shots and a plan revision.

### Stage 6: Resolve continuity and readiness

Resolve defaults in order:

```text
IP -> Episode -> Scene -> Shot override
```

Create an inspectable readiness projection per Shot:

- planning fields valid;
- required asset bindings admitted and available;
- prompt/reference count/model constraints valid;
- cost estimate available or explicitly unknown;
- upstream plan revision current;
- no blocking rights/moderation state.

### Stage 7: Approve and execute generation

Before paid batch generation, show affected Shots, model, reference versions, candidate count and estimated maximum cost. User approval creates a GenerationJob with an idempotency key and budget. The server creates per-Shot attempts, dispatches provider tasks, reconciles status and persists events.

Failure handling:

- retry only retryable failures and create a new attempt;
- preserve completed Candidates when one Shot fails;
- allow cancel/pause to stop new submissions where providers permit it;
- distinguish provider rejection, invalid input, quota/rate limit, transient transport and internal errors;
- resume after reload from durable state;
- never silently expand the approved budget.

### Stage 8: Review Candidates and select takes

Show candidates under their Shot with prompt/reference/model snapshots, cost, failures and continuity notes. Selection creates or updates SelectedTake; locking is explicit. Rejecting a Candidate may capture a structured reason for later regeneration.

### Stage 9: Create EpisodeVersion

Once required Shots have selected takes, snapshot their Candidate order into EpisodeVersionClip. Adapt the existing assembly editor for trim/transition/BGM/voiceover/export. Later take changes do not mutate an existing EpisodeVersion.

### Stage 10: Captions and localization

After the core chain is stable, create source SubtitleTrack/Cues from script dialogue or transcription, then translated subtitle/audio drafts and LocalizedEpisodeVersion children. UI locale remains independent.

## 7. Agent Mode And Manual Mode

### 7.1 Shared pipeline decision

Choose **B: one underlying pipeline with different automation policies**.

The records, validation, commands, costs, tasks, retries and approvals remain identical. `workflowPolicy` controls whether the orchestrator automatically starts the next eligible draft step. A user can switch modes at any time without migration.

### 7.2 Agent Mode

```text
Upload/Paste Script + Choose Ratio/Style/Target Duration
  -> Auto Normalize
  -> Auto Analyze
  -> Pause if Entity Mapping is ambiguous or blocked
  -> Auto Build Breakdown Draft
  -> Review / Edit / Confirm Storyboard
  -> Review Batch Scope / Cost / Confirm
  -> Auto Dispatch and Recover Allowed Retries
  -> Review Candidates / Confirm Selected Takes
  -> Auto Create Draft EpisodeVersion
  -> Review Export
```

Agent Mode may auto-save drafts, propose mappings, fill optional camera/prompt fields, recommend candidates and retry within an approved run policy. It may not silently authorize assets, publish a materially changed storyboard, spend beyond approval, replace a locked take, or publish/export externally.

### 7.3 Manual Mode

```text
Script Version
  -> Run/Skip Individual Analysis Steps
  -> Review Entity Map
  -> Create/Edit Scene
  -> Create/Edit Shot
  -> Bind Assets And Overrides
  -> Edit Prompt And Model Parameters
  -> Generate One/Many Shots
  -> Compare/Reject/Select/Lock
  -> Build EpisodeVersion
```

Manual Mode exposes advanced controls progressively. It does not bypass rights, readiness, concurrency, provenance or paid-operation gates.

## 8. AI And Human Confirmation Boundary

| Operation | AI may do automatically | Human confirmation required |
| --- | --- | --- |
| Normalize/import | Parse and warn | Replace source or choose between conflicting episode splits |
| Analyze | Extract entities/scenes/dialogue and confidence | Resolve ambiguous identity, rights or asset mapping |
| Storyboard | Draft/revise Scenes, Shots, prompts and camera suggestions | Publish/replace formal plan after material changes |
| Asset binding | Suggest admitted matches | Authorize, accept risky match, override/revoke lock |
| Generation | Estimate, prepare, schedule approved scope, retry allowed failures | Approve paid scope/budget and any expansion |
| Selection | Rank and explain | Select/lock take; replace locked take |
| Assembly | Build a draft from selected order | Approve final cut/export/publish |
| Localization | Draft subtitles/TTS mapping | Approve terminology, voice, timing and localized release |

## 9. State Machines

Do not use one giant state enum for all concerns. Store operational status on each entity and compute the Episode stage/readiness projection.

### 9.1 ScriptVersion

```text
draft -> active -> superseded -> archived
   \-------> invalid
```

### 9.2 Analysis/Breakdown run

```text
queued -> running -> needs_review -> accepted
   |         |             |          |
   |         +-> failed ---+-> retry --+
   +-> cancelled
needs_review -> rejected
```

### 9.3 Shot planning/readiness

```text
draft -> published -> blocked | ready
published/ready -> stale          (upstream version changed)
stale -> reviewed -> ready
```

Generation progress is not a Shot planning status. It is derived from jobs/attempts/candidates/selection.

### 9.4 GenerationJob and Attempt

```text
created -> approved -> queued -> running -> succeeded | partially_succeeded | failed
                      |         |          |
                      +-> paused/cancelled +-> retry (new attempt)
```

Attempt:

```text
queued -> submitted -> processing -> succeeded | failed | cancelled | expired
```

### 9.5 Candidate and SelectedTake

```text
Candidate: available -> accepted | rejected | unavailable
SelectedTake: selected -> locked -> unlocked/replaced (audited)
```

### 9.6 EpisodeVersion

```text
draft -> assembling -> review_ready -> approved -> exported
             |              |
             +-> failed ----+-> revise as child version
```

## 10. API Design

Use typed application commands and read models. Provider payloads remain behind server adapters. Long tasks return `202 Accepted` with a workflow/job id; status can use SSE plus durable polling fallback.

### 10.1 Episode and scripts

```text
POST   /api/projects
GET    /api/projects
GET    /api/projects/{projectId}
PATCH  /api/projects/{projectId}                  If-Match: revision
POST   /api/projects/{projectId}/episodes
GET    /api/episodes/{episodeId}
PATCH  /api/episodes/{episodeId}                  If-Match: revision
POST   /api/episodes/{episodeId}/scripts/import
GET    /api/episodes/{episodeId}/script-versions
POST   /api/script-versions/{versionId}/activate
POST   /api/script-versions/{versionId}/analysis-runs
```

### 10.2 Project assets

```text
GET    /api/projects/{projectId}/assets
POST   /api/projects/{projectId}/assets/attach
POST   /api/projects/{projectId}/assets/register-asset-id
PATCH  /api/project-assets/{projectAssetId}        If-Match: revision
DELETE /api/project-assets/{projectAssetId}
GET    /api/project-assets/{projectAssetId}/usage
POST   /api/projects/{projectId}/characters
POST   /api/characters/{characterId}/versions
POST   /api/character-versions/{versionId}/reference-pack
POST   /api/scenes/{sceneId}/asset-bindings
POST   /api/shots/{shotId}/asset-bindings
```

Project asset APIs should reuse existing media, provider Asset ID, portrait, and official asset adapters. They must not upload duplicate bytes only to attach an asset to a Project.

### 10.3 Draft and storyboard

```text
GET    /api/analysis-runs/{runId}
POST   /api/script-versions/{versionId}/breakdown-runs
GET    /api/breakdown-runs/{runId}/draft
PATCH  /api/breakdown-drafts/{draftId}             If-Match: revision
POST   /api/breakdown-drafts/{draftId}/publish
GET    /api/episodes/{episodeId}/storyboard
PATCH  /api/scenes/{sceneId}
PATCH  /api/shots/{shotId}
POST   /api/shots/{shotId}/split
POST   /api/shots/{shotId}/asset-bindings
GET    /api/shots/{shotId}/readiness
```

### 10.4 Generation and selection

```text
POST   /api/episodes/{episodeId}/generation-preview
POST   /api/episodes/{episodeId}/generation-jobs   Idempotency-Key: ...
GET    /api/generation-jobs/{jobId}
POST   /api/generation-jobs/{jobId}/pause
POST   /api/generation-jobs/{jobId}/cancel
POST   /api/generation-attempts/{attemptId}/retry   Idempotency-Key: ...
GET    /api/shots/{shotId}/candidates
POST   /api/shots/{shotId}/selected-take
POST   /api/shots/{shotId}/selected-take/lock
POST   /api/candidates/{candidateId}/reject
```

### 10.5 Assembly and versions

```text
POST   /api/episodes/{episodeId}/versions
GET    /api/episode-versions/{versionId}
PATCH  /api/episode-versions/{versionId}/draft
POST   /api/episode-versions/{versionId}/render-jobs
POST   /api/episode-versions/{versionId}/subtitle-tracks
POST   /api/episode-versions/{versionId}/localized-versions
POST   /api/episode-versions/{versionId}/exports
```

### 10.6 Task events and error contract

```text
GET    /api/workflow-runs/{runId}
GET    /api/workflow-runs/{runId}/events
GET    /api/tasks?episodeId=...&status=...
```

Errors should include stable `code`, `message`, `retryable`, `fieldErrors`, `providerReference` when safe, and `requestId`. The client must not infer retryability from translated text.

## 11. Frontend Episode Workspace Information Architecture

The supplied screenshot's Agent/Manual toggle and simple script upload entry are useful, but they should open one shared Episode Workspace rather than separate products.

```text
Project / Episode header
  - project selector, episode selector, source language, target duration, ratio/style
  - Agent/Manual policy, progress, blockers, task center

Left stage rail
  1. Project
  2. Assets
  3. Script
  4. Cast & Mapping
  5. Storyboard
  6. Generate
  7. Select
  8. Assemble
  9. Captions
 10. Localize
 11. Export

Center workspace
  - current stage list/canvas/editor

Right inspector
  - selected Scene/Shot/entity
  - Project Asset bindings and continuity inheritance
  - AI rationale/warnings, version/activity and task details
```

For ordinary users, show a next-action card such as “3 characters need matching” or “Review 12 shots before generating.” Advanced prompt/camera/provider controls stay collapsed. The task center is global, but every task links back to its Episode/Shot.

## 12. Delivery Plan And Task Breakdown

All tasks below are proposed and start only after this architecture is approved.

### Architecture Gate A0

| ID | Task | Depends on | Done when |
| --- | --- | --- | --- |
| A0.1 | Approve names and boundaries: Episode, ScriptVersion, narrative Scene, Shot, Candidate, SelectedTake | — | ADR records accepted terminology and rejected alternatives |
| A0.2 | Confirm authoritative Project/workspace identity and ownership API | A0.1 | No duplicate Project source of truth is introduced |
| A0.3 | Choose relational database, migration and job infrastructure | A0.2 | ADR covers local/dev/prod, backup, idempotency and recovery |
| A0.4 | Approve Agent/Manual confirmation and budget policy | A0.1 | Product gate matrix is signed off |

### Phase 1: One production vertical slice

| ID | Task | Depends on | Done when |
| --- | --- | --- | --- |
| F1 | Add server-side production persistence foundation, ownership, migrations and MediaAsset metadata | A0.3 | fresh migration, ownership checks and recovery note pass |
| F2 | Add durable workflow/job/attempt/event contracts and executor adapter | F1 | job survives reload; duplicate submission is idempotent |
| E1 | Add Episode shell using the existing Project identity | F1 | create/open/list Episode with locale/duration/ratio/style |
| P1 | Add Project Asset contracts and attach/detach commands | F1, E1 | existing uploaded/generated/official assets can be attached to a Project |
| P2 | Add Project Assets workspace view using existing asset providers | P1 | Project shows all/image/video/audio/document/Asset ID filters without duplicating global storage |
| P3 | Add Project character groups and Character Version reference packs | P1 | virtual groups and admitted images become reusable Project character references |
| S1 | Import text/MD first and create immutable ScriptVersion | E1 | original and normalized content are recoverable; hash/version stored |
| S2 | Add server-side structured analysis run and validated artifacts | S1, F2 | entities/scenes/dialogue/warnings persist; failure is retryable |
| S3 | Add entity-mapping review against Project Assets | S2, P2 | ambiguous/missing/blocked matches are explicit |
| B1 | Generate editable BreakdownDraft | S2, S3 | draft Scenes/Shots can be regenerated without overwriting formal data |
| B2 | Add storyboard review, edit, reorder/split/merge and publish transaction | B1 | formal Scene/Shot plan is versioned and passes validation |
| C1 | Add typed AssetBinding, CharacterVersion reference, ContinuityLock and Shot readiness | B2 | each Shot explains ready/blocked/stale state |
| G1 | Route Shot generation through server application service and snapshot plan/prompt/assets | C1, F2 | no new provider call is made from UI/browser hooks |
| G2 | Normalize output as Candidate and adapt legacy history/archive | G1 | multiple candidates persist without breaking old history |
| T1 | Add compare/reject/select/lock SelectedTake workflow | G2 | only a same-Shot candidate can be selected; lock is audited |
| V1 | Create EpisodeVersion from selected takes and open existing assembly UI | T1 | exact Candidate order is immutable and reloadable |
| Q1 | Add contract, integration, recovery and two-locale browser checks | all Phase 1 | acceptance path passes with mocked AI/provider calls |

Phase 1 acceptance path:

```text
existing Project -> Episode -> imported script -> AI draft -> reviewed Scenes/Shots
-> existing Assets bound -> one or more Shots generated -> multiple Candidates
-> SelectedTake locked -> draft EpisodeVersion opened in assembly
```

### Phase 2: Production completeness

- PDF/DOCX import and robust multi-episode import mapping.
- Character profile/CharacterVersion management, ordered reference packs, wardrobe/location/prop libraries.
- Batch generation preview, budget approval, pause/cancel, partial recovery and task center.
- Source SubtitleTrack/Cues, speaker mapping and editable transcription.
- Server-owned caption/TTS/BGM orchestration while preserving existing browser FFmpeg assembly.
- Source-language Episode export and NLE handoff with durable Export records.
- Legacy history migration helpers and browser cache compatibility.

### Phase 3: Localization and advanced automation

- Translated subtitle drafts, terminology glossary and review.
- Target-language TTS/dubbing and LocalizedEpisodeVersion.
- Adjacent-shot continuity assistance and explainable quality ranking.
- Agent policy presets, resumable multi-step orchestration and selective replanning.
- Team review, comments and approval roles if product demand is proven.
- Advanced timeline capabilities only where the existing assembly editor is insufficient.

## 13. Explicitly Out Of Scope For Now

- a professional multi-track NLE replacement;
- two separate Agent and Manual schemas/pipelines;
- a generalized drag-and-drop workflow/agent graph engine;
- custom model training or fine-tuning platform;
- automatic final publishing to distribution platforms;
- full multilingual dubbing, lip-sync and voice cloning in Phase 1;
- automatic continuity scores presented as truth;
- real-time multi-user editing;
- a top-level Chapter entity unless validated import requirements need it;
- copying Storyboard Forge implementation before AGPL/commercial-license review;
- rewriting the existing Asset, generation, archive or assembly modules wholesale;
- a mandatory professional camera/lens form for basic users.

## 14. Open Decisions Requiring Human Approval

1. Is the authoritative Project/workspace identity owned by this application, another XCT service, or a shared platform service?
2. Which server database and job runtime fit current deployment constraints?
3. Does Phase 1 import support text/MD only, or must DOCX/PDF be included immediately?
4. Is generation approval required per Episode batch, per Shot, or both depending on budget?
5. Is CharacterVersion part of Phase 1 persistence or can Phase 1 bind an admitted asset plus immutable snapshot while the full character UI follows in Phase 2?
6. Which structured-output LLMs are available through XCT's current LiteLLM gateway, with acceptable Chinese script quality, context length, latency and cost?

## 15. Final Recommendation

If XCT Studio can build only one main chain now, build:

> **Import Script -> editable AI Analysis/Breakdown Draft -> publish Scene/Shot -> bind existing Assets -> generate multiple Candidates -> select/lock take -> create draft EpisodeVersion.**

This chain turns the current collection of strong generation/asset/post-production capabilities into a production system. It also creates the stable data spine required by later captions, multilingual releases, TTS and timeline work.
