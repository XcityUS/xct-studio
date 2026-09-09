# IP Asset And Continuity Specification

Last updated: 2026-09-07

## Goal

IP assets give creators stable characters, places, props, voice, and visual style across a serialized short drama.

The initial system should use a controllable reference-pack workflow. It does not require custom model training to deliver useful character consistency.

## IP Asset Hierarchy

```text
IP
  Character
    Character Version
      Reference Pack
      Appearance And Wardrobe
      Voice And Dialogue Style
  Location
  Prop
  Visual Style Pack
  Continuity Rules
```

## Core Records

### IP

An IP records title, genre, logline, world setting, tone, visual style, continuity rules, and reusable assets.

### Character

A Character represents a narrative identity. It records name, role, personality, relationships, appearance notes, wardrobe defaults, speech style, and reference assets.

### Character Version

A Character Version is an immutable production snapshot. It records:

- version id and label
- appearance description
- wardrobe and hair or makeup notes
- selected reference assets in ordered priority
- negative constraints
- approved prompt fragments
- voice identity when applicable
- creation and approval metadata

### Reference Pack

A Reference Pack is the model-ready subset of assets used by a generation request. It has an explicit ordered list because the first reference may have a stronger provider effect.

### Admitted Asset

An Admitted Asset records the provider review result independently from the IP or Character that uses it:

- internal asset id and immutable content hash
- provider and provider Asset ID
- source class: official, Studio-generated, external AI, ordinary material, ordinary person, public figure, or protected IP
- review state: uploaded, reviewing, approved, active, rejected, revoked, or exempt
- provider moderation state and failure reason
- provider account/workspace and entitlement used for review
- created, reviewed, activated, expired, and revoked timestamps

Only `active` or explicitly `exempt` assets can enter a generation Reference Pack. Studio/Seedream provenance is the only current automatic exemption. All other source classes require an Asset ID, including material with no recognizable person or protected IP.

The Assets view presents virtual-character groups as a browsable list with a cover and asset count. Opening a group scopes the detail view and editing controls to assets whose provider `groupId` matches that group. Generation forms present one virtual-character choice per provider group; the selected group member remains stable while attached, otherwise the newest active member represents the group.

### Rights Coverage

Public-figure and protected-IP references require completed offline rights authorization/OA and provider account allowlisting before they are submitted to the provider asset library. Studio does not collect a duplicate authorization document or run an internal admin review. An ordinary person needs explicit consent and the provider face-verification flow; every recognizable person in a multi-person asset must be verified.

Authorization, provider review, and generation moderation are different decisions. Store and display them separately; approval at one layer must not be represented as a guarantee at another.

## Continuity Locks

Creators can lock assets at more than one level:

| Level   | Purpose                                                                            |
| ------- | ---------------------------------------------------------------------------------- |
| IP      | Default world, visual style, and recurring-character rules.                        |
| Episode | The approved character and wardrobe versions for this episode.                     |
| Scene   | Location, time, prop, and mood constraints.                                        |
| Shot    | A deliberate override for action, expression, pose, camera, or required reference. |

A more specific lock can refine a broader lock but must display the override clearly. A Shot must not silently use a different Character Version from the Episode lock.

## Prompt Assembly

When a creator generates a Shot, the system produces a traceable prompt package:

1. Shot narrative action and camera intent
2. Scene location, time, and mood
3. Episode continuity locks
4. Character Version appearance and wardrobe notes
5. ordered reference assets
6. IP visual style and negative constraints
7. model-specific parameters

The final submitted prompt snapshot and selected reference asset ids are retained on the Candidate for review and regeneration.

The provider Asset ID is sent as the ordered media input. Creative prompt text refers to `[Image 1]`, `[Image 2]`, and so on; it must not rely on a raw Asset ID embedded in prose.

## Candidate Review

Each Candidate may be marked:

- selected
- rejected: character mismatch
- rejected: wardrobe mismatch
- rejected: location or prop mismatch
- rejected: action or expression mismatch
- rejected: camera mismatch
- rejected: visual quality
- rejected: duration or pacing
- rejected: other

The rejection reason is production feedback. It should be available to the next regeneration prompt but should not mutate the locked Character Version automatically.

## Consistency Scoring

Automated similarity or continuity scoring is a later enhancement.

When introduced, it should:

- be advisory rather than silently rejecting creator work
- distinguish character identity, wardrobe, location, and style signals
- expose score inputs and confidence
- allow human override
- never replace explicit reference packs and locks

## Acceptance Criteria

1. A creator can create an IP and reusable Characters.
2. A Character can have multiple versioned reference packs.
3. An Episode can lock a Character Version and wardrobe.
4. A Shot generation records the exact asset versions and references it used.
5. A creator can reject a candidate for a continuity reason and request another candidate.
6. Existing selected takes retain their original asset snapshot even after a new Character Version is created.
7. Every non-exempt reference has an active provider Asset ID before generation.
8. Public-figure and protected-IP references have completed offline rights authorization/account allowlisting and have an active provider Asset ID before generation.
9. Every recognizable ordinary person completes provider face verification before generation.
10. Revocation blocks new generation without mutating prior Candidate or export snapshots.
