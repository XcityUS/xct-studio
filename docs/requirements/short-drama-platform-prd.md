# Xct Studio Short-Drama Platform PRD

Last updated: 2026-09-07

## Product Position

`xct-studio` should become an AI short-drama production platform.

The core product flow is:

```text
IP -> Script -> Episode -> Scene -> Shot -> Generate Candidates -> Select Take -> Assemble -> Subtitle / Localize -> Export
```

The platform should not only generate isolated videos. It should help creators repeatedly produce episodes with stable characters, reusable settings, consistent visual style, localized releases, and clear production state.

## Integrated Product Scope

The Studio should provide one connected production path:

- IP and character asset management
- script creation, import, AI assistance, and versioning
- automatic script breakdown into editable scenes and shots
- storyboard review and shot-level prompt control
- reference-anchored candidate generation and selection
- assembly, captions, TTS, BGM, watermark, and export
- UI internationalization and episode-level multilingual subtitle, translation, and dubbing versions

Detailed specifications:

- requirements/integrated-short-drama-studio-spec.md
- requirements/ip-continuity-spec.md
- requirements/episode-pipeline-spec.md

## MVP User

Primary MVP user:

- short-drama creator
- AI video operator
- small production team
- internal Xcity operator validating Seedance workflows

The MVP user should not need professional storyboard knowledge.

## Core Objects

### IP

An IP is the creative container.

It includes:

- title
- genre
- logline
- world setting
- tone
- visual style
- continuity rules
- characters
- recurring locations
- recurring props

### Script Version

A Script Version is the editable source narrative for an Episode.

It includes:

- source language
- premise and story beats
- scene text
- character dialogue
- version history
- AI-assisted draft provenance when applicable
- breakdown status

### Character

A character is a reusable identity inside an IP.

It includes:

- name
- role
- appearance
- wardrobe
- personality
- speech style
- relationship notes
- reference assets
- version

### Episode

An episode is one short-drama production unit.

It includes:

- title
- episode number
- script
- target duration
- locale
- scenes
- shots
- selected takes
- final exports
- script versions
- subtitle tracks
- localized episode versions

### Scene

A scene is a story block in one location/time/context.

It includes:

- order
- location
- time of day
- involved characters
- story beat
- mood
- shots

### Shot

A shot is one independently generated video unit.

It includes:

- order
- duration target
- characters
- location
- action
- emotion
- dialogue or voiceover
- camera instruction
- reference assets
- generation parameters
- candidate takes
- selected take
- status

Recommended AI shot duration:

- 4 to 12 seconds

Do not model shots as 30-second blocks by default. Longer scenes should be split into multiple shots.

## Main Workflow

1. User creates or selects an IP.
2. User creates or imports a versioned script for an episode.
3. AI extracts characters, scenes, and shots.
4. User reviews and edits the generated storyboard and shot list.
5. System injects IP, character, scene, and continuity locks into each shot prompt.
6. User batch-generates candidates for each shot.
7. User selects the best take per shot.
8. System assembles selected takes into an episode version.
9. User adds subtitles, voiceover, BGM, watermark, and export format.
10. User creates translated subtitle or dubbed-language versions when needed.
11. User exports or publishes the final episode.

## Character Consistency Requirements

The platform must support:

- fixed character reference packs
- automatic character prompt injection
- per-episode wardrobe lock
- per-scene continuity notes
- selected reference image ordering
- candidate rejection reason tracking
- future visual similarity scoring

Initial MVP can be manual-first:

- user marks a candidate as good/bad
- user records why a candidate failed
- system uses that metadata in regeneration prompts

## Candidate Selection Requirements

Each shot should support multiple candidates.

Candidate fields:

- id
- source job id
- video url
- thumbnail url
- model
- prompt
- parameters
- cost estimate
- status
- rejection reason
- selected flag

Only one candidate should be selected for the final timeline by default.

## Status Model

Episode status:

- draft
- breaking_down
- ready_to_generate
- generating
- selecting
- assembling
- exported
- failed

Shot status:

- draft
- ready
- queued
- generating
- needs_selection
- selected
- needs_regeneration
- locked
- failed

## Non-Goals For MVP

- full professional NLE replacement
- multi-user real-time collaboration
- comments and social feed mechanics
- custom model training
- complex rights management beyond the existing authorization flow

## Fit With Current xct-studio

Current code already covers:

- one-off video generation
- reference media
- prompt helper
- script breakdown
- local/cloud history
- basic assembly
- captions/TTS/BGM/export
- share/community/authorization flows

The harness should add the missing organizing layer:

```text
History item -> Shot candidate
Selected history item -> Selected take
Assembly editor input -> Episode timeline
Character/portrait -> IP character reference pack
Prompt builder -> Shot prompt generator
```
