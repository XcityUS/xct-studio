# Episode Pipeline Specification

Last updated: 2026-09-07

## Definition

An Episode Pipeline is the end-to-end production flow for one short-drama episode.

It connects creative text, IP context, visual planning, generation, selection, post-production, captions, localization, and export into one traceable production record.

```text
IP
  -> Script Version
  -> Scene And Shot Breakdown
  -> Storyboard Review
  -> Candidate Generation
  -> Selected Takes
  -> Episode Version
  -> Captions And Localization
  -> Export
```

## Episode Structure

| Object | Meaning |
| --- | --- |
| Episode | One numbered or named production unit with target duration and source language. |
| Script Version | A versioned source narrative with scenes, dialogue, and story beats. |
| Scene | A story block sharing location, time, participants, or dramatic context. |
| Shot | One independently generated visual unit, usually 4 to 12 seconds. |
| Candidate | One generated output for a Shot. |
| Selected Take | The Candidate chosen for the Episode timeline. |
| Episode Version | The ordered selected takes plus audio, captions, and export configuration. |
| Localized Episode Version | A child version with explicit subtitle and audio language choices. |

## Stage 1: Script Creation

The creator creates or imports an Episode script.

Required fields:

- title
- episode number or sequence
- source language
- target duration
- script body
- Script Version status

Useful authoring actions:

- AI outline draft
- scene expansion
- dialogue refinement
- character list extraction
- recap or hook generation
- duplicate, compare, restore, and archive a Script Version

Every AI result is an editable draft. The creator chooses when to save it as the active Script Version.

## Stage 2: Automatic Breakdown

The system converts the active Script Version into a draft Scene and Shot plan.

A valid first pass should identify:

- Scenes with location, time, characters, dramatic beat, and mood
- Shots with order, target duration, action, emotion, dialogue or voiceover, camera direction, and references
- possible continuity dependencies between adjacent Shots

Breakdown failures must remain editable. The creator can add, remove, reorder, merge, or split Scenes and Shots manually.

## Stage 3: Storyboard Review

The storyboard is the creator's production checklist before generation.

For each Shot, show:

- scene context
- visual description
- character and asset locks
- action and emotion
- camera direction
- target duration
- dialogue or voiceover
- draft prompt
- candidate count and status

Professional controls such as lens choice, motion path, exact framing, and negative prompts are advanced controls. They should not block the basic automatic workflow.

## Stage 4: Candidate Generation

Generation is submitted from a Shot.

A request records:

- Shot id and attempt id
- prompt snapshot
- IP and Character Version snapshots
- source references
- model and parameter set
- requested candidate count
- status and timestamps
- estimate and actual cost when available

One Shot can have many Candidates. A retry is visible as a new attempt and does not replace the prior Candidate.

## Stage 5: Candidate Selection

The creator reviews Candidates in Shot context and selects one take by default.

Selection rules:

- only one selected take per Shot unless a special multi-take timeline mode is introduced
- a selection may be locked
- changing a locked selection requires an explicit confirmation
- rejected candidates keep their reason and prompt snapshot
- no selected take means the Shot remains incomplete

## Stage 6: Assembly

The system creates an Episode Version from selected takes in Shot order.

The creator can:

- trim clips
- adjust order when permitted
- add transitions
- add BGM and voiceover
- create or edit captions
- set watermark and aspect-ratio presets
- export or hand off to an NLE

An export stores the Episode Version and preset used for that output.

## Stage 7: Captions And Localization

Captions begin with a source-language subtitle track. A creator can then:

- edit timing, speaker, and source text
- create a translated subtitle draft for a target language
- accept or revise the translated track
- select a dubbing or TTS audio track with a declared language
- create a Localized Episode Version
- export single-language or bilingual subtitle variants

UI locale is independent from this stage. A creator may use a Chinese Studio UI while preparing an English release.

## Status Model

Episode status:

- draft
- writing
- breaking_down
- storyboarding
- ready_to_generate
- generating
- selecting
- assembling
- localizing
- exported
- failed

Shot status:

- draft
- ready
- queued
- generating
- needs_selection
- selected
- locked
- needs_regeneration
- failed

## Acceptance Criteria

1. A source script can become editable Scenes and Shots.
2. A Shot can be generated as multiple Candidates.
3. The creator can select and lock one Candidate per Shot.
4. Selected takes form an Episode Version in Shot order.
5. Source captions and at least one target-language subtitle track can be edited independently.
6. An Episode Version can export without overwriting its source script, selected takes, or subtitle tracks.

