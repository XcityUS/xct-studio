# Integrated Short-Drama Studio Specification

Last updated: 2026-09-07

## Product Decision

Xct Studio is an integrated AI short-drama production workstation.

It should support the complete creator path in one product, rather than leaving script writing, storyboarding, asset management, localization, and post-production as unrelated tools.

```text
Project
  -> Project Assets
  -> IP Assets
  -> Script Creation
  -> Episode Planning
  -> Scene And Shot Storyboard
  -> Candidate Generation
  -> Take Selection
  -> Assembly
  -> Subtitle, Translation, And Dubbing
  -> Export And Publish
```

## Primary Users

- AI short-drama creators
- small production teams
- content operators producing serialized video
- internal operators validating model, asset, and continuity workflows

The default user may understand storytelling but does not need professional storyboard or NLE expertise.

## Product Modules

| Module | Creator outcome | Core capabilities |
| --- | --- | --- |
| Workspace | Organize a production | projects, IPs, Episodes, status, recent work |
| Project Assets | Prepare the material for one production | uploaded media, generated media, Asset IDs, characters, locations, props, audio, documents, style references |
| IP Assets | Reuse a stable story world | characters, wardrobe, locations, props, visual style, voice, reference packs |
| Script Studio | Turn an idea into a producible episode | write, import, AI co-write, version, characters, beats, dialogue |
| Storyboard | Turn a script into editable production units | scenes, shots, camera, action, emotion, timing, references, prompts |
| Generation | Produce comparable material efficiently | model settings, continuity injection, batch jobs, candidates, retries, cost |
| Selection | Choose final material for every Shot | side-by-side review, rejection reason, selected take, lock state |
| Post Production | Build a watchable episode | timeline, trim, BGM, captions, TTS, watermark, NLE handoff, export |
| Localization | Release in more than one language | script translation, subtitle tracks, translation review, dubbing, localized exports |
| Publishing | Share or distribute approved results | versioned exports, share links, community and authorization flows |

When sharing an archived video, Studio resolves any historical media-domain URL to the current media host and verifies the object exists before sending the share request. The Worker still enforces the signed-in user's media namespace; an object owned by a different account must not be relabelled as shareable and should produce an actionable error.

## One Production Context

Every production view should resolve to the same context:

- current workspace or project
- current Project Asset library
- current IP and locked asset versions
- current Episode
- current Script Version
- current Scene and Shot
- current Episode Version when assembling or localizing

For example, opening a candidate from the asset library should reveal which Shot, Episode, IP character version, generation settings, and selected-take status it belongs to.

## Project Asset Workspace

Short-drama creation starts from a Project, not from an isolated generation form. The Project owns the production asset workspace shown to the creator.

The Project Asset Workspace should include:

- all uploaded and generated media attached to the Project;
- provider Asset IDs and review/admission status;
- verified real-person references;
- virtual character groups and Character Version reference packs;
- reusable locations and backgrounds;
- recurring props;
- audio assets such as BGM, sound effects, voice references, and TTS outputs;
- document assets such as source scripts, novels, style guides, and authorization notes;
- style assets such as color, lighting, tone, and negative constraints.

The current global Assets tab can be reused as a source library and migration surface, but the production workspace should show Project-scoped assets first. Episode, Scene, and Shot generation should bind to Project Assets and snapshot the exact assets used.

## Script Creation

The Script Studio must support:

- a blank script draft
- paste or file import
- title, logline, target duration, genre, and episode number
- named characters and dialogue
- version history and explicit restore or duplicate behavior
- AI assistance for outline, scene expansion, dialogue refinement, and episode recap
- a human-readable source language
- a reviewable handoff to breakdown

AI text assistance must produce editable drafts. It must not silently replace a user-authored script.

## Storyboard And Shot Planning

The system should generate a first storyboard from the active Script Version.

The first pass includes:

- Scene order, location, time, and story beat
- Shot order and target duration
- involved characters
- action, emotion, dialogue or voiceover
- camera direction
- visual reference and continuity requirements
- a draft generation prompt

The creator can edit every field before generation.

A Storyboard is not a fixed 30-second-unit layout. A Shot is normally an independently generated 4 to 12 second unit. A longer dramatic moment should be represented by several Shots.

## IP Assets And Character Stability

An IP owns the reusable creative source of truth:

- story world and tone
- character bibles and visual reference packs
- wardrobe and appearance versions
- recurring locations and props
- visual style rules
- voice and dialogue style
- continuity locks for an Episode or Scene

The platform injects the selected asset and continuity context into Shot generation. The creator must be able to see and override that generated context before submitting an expensive job.

## Generation And Selection

Generation must be Shot-centric:

- one Shot may request several Candidates
- each Candidate retains its model, prompt snapshot, parameters, cost, status, and result media
- a rejected Candidate can carry a structured reason such as character mismatch, wrong action, bad camera, poor timing, or visual defect
- one Candidate is selected per Shot by default
- selected takes can be locked before assembly

## Captions, Translation, And Dubbing

Localization exists at the Episode Version level, not just as a UI-language switch.

The platform must support:

- timed source-language subtitle tracks
- editable subtitle text and speaker assignment
- translated subtitle drafts with explicit target language
- bilingual subtitle exports when requested
- TTS or dubbing tracks with language and voice identity
- source and localized export relationships

The source script, original audio, original subtitles, and selected video takes remain immutable references for a localized version. Localized work is a child version that can be reviewed and exported independently.

## Post Production And Export

Post-production begins from selected takes, not raw generation history.

The assembly workflow must support:

- Shot ordering from the Episode
- timeline trim and transitions
- source and localized audio tracks
- subtitles and caption styling
- BGM, watermark, aspect ratio, and export preset
- final Episode Version and export history

## MVP Boundary

The first integrated MVP should prioritize:

1. IP and character reference packs
2. script draft and automatic breakdown
3. editable Scene and Shot cards
4. candidate generation and per-Shot selection
5. selected-take assembly
6. editable source and translated subtitle tracks
7. Chinese and English UI routing

Later phases may add:

- professional timeline editing
- real-time collaboration
- automated visual similarity scoring
- full dubbing alignment
- project templates and distribution integrations

## Acceptance Criteria

A creator can:

1. Create an IP and add a versioned character reference pack.
2. Create an Episode and author or import a source-language script.
3. Convert the script into editable Scenes and Shots.
4. Generate multiple candidates per Shot using the locked IP context.
5. Select one take per Shot and assemble an Episode Version.
6. Edit source captions, create a translated subtitle track, and export a localized version.
7. Return to the production later without losing its IP, script, Shot, candidate, and version relationships.
