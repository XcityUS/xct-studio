# Project Asset Workspace Specification

Last updated: 2026-09-16

## Decision

Short-drama asset management belongs inside a production Project. The global Assets tab can remain as a library and compatibility view, but the production workflow should resolve assets through the current Project before they are used by an Episode, Scene, or Shot.

The target user flow is:

```text
Create / Open Short-drama Project
  -> Project Asset Workspace
      -> Upload / Import / Register Asset ID
      -> Classify asset as Character, Location, Prop, Audio, Video, Document, or Style
      -> Review / Admit provider Asset ID where required
      -> Group character references into reusable Character Versions
  -> Episode
      -> Script Version
      -> Entity Mapping
      -> Scene / Shot Asset Binding
      -> Generation Candidate
      -> Selected Take
```

## Why Project-scoped Assets

Global assets are useful for storage and reuse, but they are not enough for short-drama production.

A Project-scoped asset workspace gives the product:

- a clear place to keep all material for one short-drama IP or series;
- stable Character, Location, Prop, Audio, Document, and Style records;
- explicit asset usage inside Episode, Scene, and Shot planning;
- continuity rules that survive page reloads and generation retries;
- safe separation between reusable library media and production-approved references;
- a path to later team review, export provenance, and localization.

## Required Asset Areas

### All Assets

The Project should show all assets attached to the current Project.

Required filters:

- all
- image
- video
- audio
- document
- provider-ready / Asset ID
- needs review
- failed / revoked

Useful fields:

- projectAssetId
- global media asset id, when reused from the global library
- provider Asset ID, when available
- source type: upload, generated media, official Asset ID, external AI, real person, protected IP
- kind: character, location, prop, audio, video, document, style, other
- status: uploaded, reviewing, active, failed, revoked, archived
- display name, tags, notes
- preview URL or document text summary
- owner, createdAt, updatedAt

### Character Assets

Character assets are not just images. They represent a production identity.

Required structure:

```text
Project
  -> Character
      -> Character Version
          -> Reference Pack
              -> ordered Project Assets / provider Asset IDs
```

A Character Version should store:

- role name, such as female lead or antagonist;
- appearance notes;
- wardrobe/look notes;
- approved reference pack;
- provider group id when backed by Xcity / BytePlus virtual character groups;
- optional voice identity and dialogue style;
- approval and stale state.

The UI should show one card per character group, with cover image, asset count, status, and actions to add/remove references. This matches the desired screenshot direction while preserving provider Asset ID gates.

### Location And Background Assets

Locations should be separate from narrative Scenes.

Examples:

- office
- apartment
- hospital hallway
- street at night
- city skyline

Location assets may include images, videos, mood boards, and prompt notes. A Scene can bind one or more Location assets, but changing a narrative Scene must not rewrite the reusable Location asset.

### Prop Assets

Props are recurring objects that affect continuity, for example:

- phone
- USB drive
- necklace
- contract
- car

Props can be optional for basic generation, but if a Shot requires a prop and a reference exists, the binding should be explicit and snapshotted into the generation attempt.

### Audio Assets

Audio assets should be Project-scoped so the same BGM, voice reference, sound effect, or narration can be reused during assembly.

Initial kinds:

- BGM
- sound effect
- voice reference
- generated TTS
- source dialogue / narration

Audio language must be explicit. It must not inherit the UI locale.

### Document Assets

Documents belong in the Project because they become source material for script and continuity.

Examples:

- source script file
- novel excerpt
- character bible
- style guide
- rights / authorization note

Document assets can feed Script Versions or asset notes, but imported text is still saved as a versioned ScriptVersion before production.

### Style Assets

Style assets describe the visual rules for the Project.

Examples:

- cinematic tone
- color palette
- lighting rule
- camera style
- negative constraints

Style assets can be inherited by Episodes, Scenes, and Shots through continuity locks.

## Project Asset Binding Rules

- Assets are first attached to a Project, then bound to Characters, Locations, Props, Episodes, Scenes, or Shots.
- A Shot generation request must snapshot the exact bound asset ids, provider Asset IDs, ordering, prompt fragments, and model settings.
- Asset bindings can be inherited in this order:

```text
Project / IP default
  -> Episode lock
  -> Scene lock
  -> Shot override
```

- A more specific override must be visible to the user.
- An asset with status `uploaded`, `reviewing`, `failed`, or `revoked` must not be submitted as a provider reference unless it is explicitly exempt, such as Studio-generated Seedream output under the current business rule.
- Raw Asset IDs are transport identifiers. Prompts should refer to ordered inputs such as `[Image 1]`, not rely on prose containing an Asset ID.

## User-facing Review Flow

- Real-person authorization starts from Studio and opens its verification page directly from the user's click so Chrome and Safari follow the same flow.
- When the verification callback succeeds, Studio must detect it automatically, refresh the verified-person group, and allow the user to upload that person's photo without a manual page refresh.
- Uploading a photo from a verified-person group stores the image and submits it for review as one UI action. The user must not have to copy a URL or Asset ID between screens.
- Manual Asset ID entry is an advanced import path for an already-approved asset. It must not be the default workflow and must not be offered as a way to bypass real-person verification.
- Provider product names, provider consoles, KYC tiers, and provider catalog instructions are implementation details and are not exposed in the standard asset workflow.
- General review guidance stays behind contextual help. The default asset view prioritizes upload, selection, review status, and use in the current Project.

## Recommended Workspace Information Architecture

Inside a short-drama Project:

```text
Project Header
  - title, IP/series, source language, target aspect ratio, style, status

Project Navigation
  - Overview
  - Assets
  - Script
  - Episodes
  - Storyboard
  - Generation
  - Assembly
  - Localization

Assets Workspace
  - Library: uploaded/generated/registered media
  - Characters: verified people and virtual character groups
  - Locations
  - Props
  - Audio
  - Documents
  - Style
```

The current global Assets tab can be reused as the first implementation surface, but the labels and data model should migrate toward Project Assets.

## Phase 1 MVP

The first useful project-asset slice should deliver:

1. Create/open a short-drama Project.
2. Attach existing global assets to that Project.
3. Register provider Asset IDs as Project Assets.
4. Create virtual Character groups inside the Project.
5. Add reviewed images to a Character Version reference pack.
6. Bind Project Assets to draft Shots during storyboard review.
7. Snapshot bound assets when generating each Shot.
8. Reopen the Project and continue without losing asset bindings or generation queue state.

## Phase 2

- Location and Prop libraries.
- Document assets connected to ScriptVersion import history.
- Audio asset library for BGM, sound effects, TTS, and voice references.
- Episode-level and Scene-level continuity locks.
- Asset usage graph: show where each asset is used across Episodes, Scenes, Shots, Candidates, and Exports.
- Stale indicators when a Character Version or provider Asset ID changes.

## Phase 3

- Bulk import and AI classification of project assets.
- AI-assisted character bible generation from scripts and references.
- Similarity / continuity scoring as advisory review.
- Team approval and role-based asset permissions.
- Cross-project asset templates and reusable IP packages.

## Explicit Non-goals For The First Project Asset Slice

- Do not replace the existing global asset storage in one rewrite.
- Do not make global localStorage / IndexedDB the production source of truth.
- Do not require every background or prop to have a provider Asset ID in Phase 1.
- Do not auto-authorize real people, public figures, or protected IP.
- Do not mix UI locale with asset, script, voice, or subtitle language.
- Do not create a separate Agent Mode asset schema.
