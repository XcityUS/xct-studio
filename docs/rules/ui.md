# UI Rules

Last updated: 2026-09-07

## Product Shape

The product is a creation workstation, not a marketing landing page.

Prioritize:

- dense but readable controls
- stable production state
- clear shot/candidate hierarchy
- fast switching between IP, episode, generation, assets, and export
- visible cost/status feedback

## Short-Drama Platform Navigation

Future primary navigation should support:

- Workspace
- IP
- Episodes
- Script
- Storyboard
- Assets
- Post Production
- Localization
- Community
- Settings

The existing tabs can remain during migration.

## Episode Pipeline UI

The Episode UI should make this hierarchy obvious:

```text
Episode
  Scene
    Shot
      Candidate takes
```

Users should not need professional storyboard terminology to operate it.

Shot editor fields should be practical:

- character
- location
- action
- emotion
- dialogue/voiceover
- camera preset
- duration
- reference assets
- generate count

## Integrated Production Surface

The primary surface should make the production sequence visible without forcing creators to leave the current work context:

```text
IP Assets -> Script -> Storyboard -> Generate -> Select -> Assemble -> Subtitle / Localize -> Export
```

Use focused views or panels for each stage, but keep the current Episode, Scene, Shot, and selected-take context visible while moving between stages.

The default user should be able to accept an automatic breakdown and make small edits. Professional storyboard controls should be progressive disclosure, not a prerequisite for starting a production.

## Script And Storyboard UI

- A script editor should support manual writing, paste/import, AI suggestions, and saved versions.
- A storyboard is a visual production plan derived from the script, not a 30-second video block.
- A Shot is normally a 4 to 12 second independently generated unit.
- Show Scene grouping, Shot order, duration, characters, action, emotion, camera, dialogue, and continuity warnings on storyboard cards.
- Candidate comparison must keep the selected take obvious and prevent an accidental replacement of a locked take.

## Caption And Localization UI

- Keep UI language selection separate from Episode release languages.
- A localized Episode Version should identify its source Episode Version, subtitle language, audio language, and export status.
- Subtitle editing needs readable timing, speaker, text, and preview context.
- Bilingual subtitle display is an export option, not a replacement for two independently editable subtitle tracks.
- Do not make a translation or dubbing result silently replace the source-language script or subtitle track.

## i18n UI Rule

Chinese is the default surface.

English must remain product-quality, not machine-placeholder copy.

## Selection Controls

- The Chinese/English interface-language control is a one-click button that shows the target language. Do not use a native select or open a menu for exactly two interface locales.
- Visible option sets use the shared Radix-based `components/ui/Dropdown`; do not render a browser-native `<select>`.
- Dropdown content renders through a portal, remains within the viewport, supports keyboard navigation, and shows the selected item clearly.
- Keep compact and default trigger sizes stable. Long selected values truncate instead of resizing their toolbar, grid, or panel.
- Native media, file, range, checkbox, and hidden accessibility controls are separate concerns; this rule applies to visible option-selection menus.

## Visual Consistency Rule

When adding IP/episode features, keep the current Xcity Studio visual language unless a broader redesign is explicitly requested.

Implement that visual language using CSS Modules and shared CSS custom properties. Tailwind CSS, utility classes, and Tailwind-dependent templates are prohibited. Reuse Radix interaction primitives and lucide-react icons with compliant styling.

Build UI components in TypeScript. Prefer Server Components for page composition and read-only views; isolate interactive production controls in Client Components. Generation controls submit to application APIs or Server Actions backed by server services, never directly to AI providers.
