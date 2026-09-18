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

For protected demonstration accounts, asset deletion is forbidden at the media Worker, provider group route, and Studio business-record write boundary. Resolve accounts by the authenticated stable Xcity user ID, not by browser-supplied email or a password. Protection must not block asset reads or new uploads.

When saving an approved verified-person photo to a character group, keep the group picker and save action together in a compact inline form. A new-group name field may use a second row, and the form must remain usable on narrow screens.

For verified-person photo uploads, accept JPEG, PNG, and WebP under the existing upload limits. Images only slightly below the 300 px minimum side (280–299 px) may be enlarged proportionally before submission; keep the original file name and use the original bytes for duplicate detection. Show upload or provider failures next to the upload control instead of relying only on a notice above the card.

Image previews in the global asset library must fit within the preview stage without cropping or stretching, retain the source aspect ratio, and remain horizontally and vertically centered.

For single-image video input, compatible multi-reference models default to a visual-reference role so the selected output ratio (for example 16:9) is sent to the provider even when the portrait asset is vertical. Show the single-image role switch directly below the selected image, not among the aspect-ratio settings. The UI also offers an explicit exact-first-frame role. That role follows the image's own canvas ratio and cannot be overridden by writing “landscape” in the prompt; users who need an exact landscape first frame must supply an already prepared 16:9 image. First-frame-only models show the same constraint below the image instead of implying the disabled ratio selector still applies. Do not silently transform or resubmit approved person Asset IDs to create a new canvas.

For compatible multi-reference models, show and submit optional audio reference input with no image or with a single image in visual-reference mode; do not require reference images for prompt-plus-audio generation. Exact-first-frame mode and first-frame-only models do not offer this reference-audio combination. Selecting an audio reference enables generated audio even when spoken voice is set to Silent; the reference guides generation and is not a guaranteed verbatim BGM mix.
The selected reference audio has a two-handle excerpt control under its player, with start/end times editable in whole seconds. The default excerpt is 0 to the selected video duration (or to the end of a shorter known file); the excerpt must be at least 2 seconds and no longer than the selected video duration. Its timeline ends at the known audio duration, or uses a 0–600 second fallback when metadata is unavailable. Changing the video duration clamps an overlong selection without moving its start. Trim only the submitted browser-side copy to that excerpt; keep the original uploaded asset and preview unchanged. Decode and validate the actual excerpt against the file before paid submission, convert unsupported browser-upload formats to provider-compatible WAV, and show an actionable error if the selected range cannot be read or trimmed. The UI must disclose the selected range and video-duration limit beside the audio.

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

- Real-person authorization starts from Studio and opens the provider H5 flow in a separate browser window directly from the user's click. Request a wider desktop window (up to 960 × 900 CSS pixels), capped by available screen dimensions; the browser may override the requested size. Studio shows a compact waiting dialog without embedding the provider page or displaying its raw verification URL; the provider H5 layout and camera access were unreliable inside an iframe. Retrying starts a fresh verification session rather than reusing a previously opened H5 URL. Browser-controlled address bars cannot be hidden. Closing Studio's waiting dialog must not discard an already completed callback.
- When the verification callback succeeds, Studio must detect it automatically, refresh the verified-person group, and allow the user to upload that person's photo without a manual page refresh.
- Callback notification uses same-origin storage and a same-origin browser channel, so restricting storage writes does not by itself leave an open Studio tab waiting for a manual refresh.
- Uploading a photo from a verified-person group stores the image and submits it for review as one UI action. The user must not have to copy a URL or Asset ID between screens.
- Verified people are displayed once per provider group ID, with a user-editable person name and optional cover image. Approved photos remain children of that person; repeat submission of the same source or the same uploaded file is reused instead of creating another provider photo. A matching owner tag or matching name alone is not proof of the same person and must not merge distinct group IDs automatically.
- Each active verified photo can copy its `asset://` reference or be placed into an existing Xcity character group or a newly named one. Saving records the photo's group membership in Studio and shows its actual thumbnail, count, and reviewed-person label in that group's browser; it must not resubmit the real-person photo as an AIGC provider asset or change its verified identity. The same active Asset ID is also attached to the current Project for Video → Character binding, without silently binding any storyboard character. The person's identity name remains independent of the character group name.
- Deleting a verified person requires an explicit confirmation showing the affected photo count. Studio only clears its group, profile and photo records after the owned provider group deletion succeeds; affected Project bindings are archived. A provider refusal leaves the person visible and retryable.
- In the video reference picker, uploading an image keeps its preview visible and submits an unreviewed image to the provider automatically. Existing reviewed records are reused by source URL; Studio updates the same image from reviewing to active or failed without asking the user to choose its source. A provider rejection remains blocked and offers retry; a known real-person photo that requires liveness verification must use its verified-person group rather than being treated as approved by a generic review.
- Removing a local library card does not revoke an existing provider Asset ID. An explicit `asset://` video reference without local review metadata remains selectable and is validated by the provider at generation; it must not be auto-submitted as a fresh image for review or labelled locally as approved. A locally known Processing or Failed Asset ID stays blocked.
- Selecting an unreviewed item from Assets submits it through the same review path without a source-selection dialog. The asset card keeps its thumbnail and reflects the persisted provider status; it becomes usable only when the returned Asset ID is active. Seedream-generated output retains its documented exemption.
- Manual Asset ID entry is an advanced import path for an already-approved asset. It must not be the default workflow and must not be offered as a way to bypass real-person verification.
- Normal asset review derives its review name from the uploaded file and does not ask for a source type, provider-facing ID, or another name field. Advanced ID import remains a separate path for an already-approved asset.
- Storyboard character and scene bindings always show the same compact editable Asset ID field and fixed-width Confirm action, whether unbound, active, or unavailable. A known unavailable ID remains visible in the field with an inline error so it can be replaced directly; the Confirm action stays disabled until the user enters a different usable ID. Pasted `asset://` references are normalized to their ID. Known reviewing, failed, revoked, or archived Project Asset IDs remain blocked from the generation queue. Unknown historical IDs remain visible until the provider validates them at submission; manual entry is intended only for already-approved assets. A separate, explicitly labelled image-generation action uses the row's description to generate a new character or scene image, submits it for review, and binds the returned Asset ID. Clicking one character must not silently do nothing because that character is absent from the current shot list; generation failures appear beside that row.
- Each storyboard binding card keeps the character or scene name and description on the first line and its controls on the next line at every panel width. A per-row regeneration shows loading only on that row; batch progress and its spinner are reserved for batch actions. Completed progress must not remain over the asset list.
- After confirming a usable Asset ID, the storyboard character or scene name shows a compact Bound tag. A known reviewing, uploaded, failed, revoked, or archived ID must not show that tag; the field explains its actual recorded status rather than calling all non-active states "unavailable". An ID absent from the current project inventory remains a legacy/manual binding, not a provider-approved status claim; its provider validity is checked again when submitted.
- A reviewing bound storyboard asset automatically polls its existing provider Asset ID without creating another asset. One panel deduplicates IDs across character and scene bindings, checks at most three IDs concurrently about every five seconds, stops at Active or Failed, and pauses after 20 inconclusive or failed reads per ID. While pending, the card shows automatic progress; after the cap it exposes the in-place manual Refresh status action. The status query persists the returned project/portrait status and updates the Bound tag or review guidance. A failed bound asset may also be checked manually; query failures leave its previous status intact.
- A known revoked, failed, archived, or still-reviewing bound asset cannot enter the storyboard generation queue; older bindings absent from the Project inventory are preserved rather than silently discarded. Ordinary asset cards do not expose provider IDs; an active verified photo offers an explicit Copy Asset ID action for advanced reuse. Each active asset in a character-group detail, including a verified-person photo, also offers a copy icon for its `asset://` reference; reviewing or failed assets cannot be copied as usable references.
- Provider product names, provider consoles, KYC tiers, and provider catalog instructions are implementation details and are not exposed in the standard asset workflow.
- The unused official-provider catalog and source-switcher presentation is removed rather than kept as a dormant path back to a provider console. Existing approved references remain usable through the ordinary asset list or the collapsed advanced import.
- Asset inventory and review-submission errors show product-level retry guidance rather than passing through raw provider error text. Rate limits and local image-format validation retain their specific safe messages.
- User-facing model labels and compatibility messages use Xcity product names or capability-based wording; upstream model-family and provider names remain internal implementation details.
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
