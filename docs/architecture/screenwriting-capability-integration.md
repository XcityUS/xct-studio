# Screenwriting capability integration

Last updated: 2026-09-14

## Boundary

XCT Studio integrates the capability taxonomy of
[`screenwriting-skills`](https://github.com/jtydhr88/screenwriting-skills) and
[`InkOS`](https://github.com/Narcooo/inkos), not their runtime source code or
reference corpus. Runtime rules, contracts and UI are implemented within XCT
Studio. Third-party scripts and long reference texts are not bundled.

The catalog contains all 25 screenwriting-skills entries and all 15 InkOS skill
entries. Seven overlapping InkOS writing skills remain discoverable as source
aliases but do not execute beside the canonical screenwriting capability. The
remaining InkOS entries are opt-in supplements. This produces one routing graph,
not two competing writing systems.

## Routing

Capabilities declare one or more stages:

```text
brief -> story -> character -> series -> scene -> dialogue
      -> storyboard -> review -> delivery
```

Core craft capabilities can be enabled by default. Regional methods, named
styles, opera methods, case studies, translation, market research, cover and
interactive formats require explicit project selection. A stage receives only
the relevant selected rules; a request never injects the entire catalog.

## Delivered first slice

- Typed 40-entry capability catalog with overlap metadata and deterministic
  stage routing.
- Storyboard findings with capability attribution, severity and Shot identity.
- Deterministic checks for description, model duration, dialogue timing,
  dialogue speakers, character/scene references, backward continuity, visual
  abstraction and high cast complexity.
- Review findings in both the Shot Builder and current short-drama workspace.
- Blocking findings prevent the affected storyboard from entering the
  generation queue; warnings stay visible but do not block.

These checks are deterministic production gates. They do not claim that story
structure, premise, character motivation or dialogue quality has already been
semantically judged by a model.

## Next slices

1. Add a persisted `analysis_runs` contract and server-only semantic review
   service through xcity-litellm.
2. Add accept, ignore, manual edit and re-review decisions backed by
   `review_events` and script revisions.
3. Add Creative Brief, Story Bible, episode outline and beat-sheet surfaces.
4. Add project capability presets and explicit conditional-method selection.

AI output remains a draft or finding until the user accepts it. Formal
Character, Scene and Shot records must never be overwritten merely because a
capability ran.
