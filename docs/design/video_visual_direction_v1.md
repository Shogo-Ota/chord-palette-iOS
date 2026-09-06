# Chord Palette Video Visual Direction v1

Status: Approved direction for Phase V4 design. This document does not authorize
production implementation by itself.

## 1. Purpose

Define a durable visual direction for Chord Palette videos while preserving the
accepted Classic and Pulse renderers. The direction is:

> Minimal Luxe × Musical Motion

Minimal Luxe is the brand foundation. Each visual style adds only the musical
motion needed for its own role.

## 2. Reference, specification, and Golden boundaries

The Flow mock supplied on 2026-09-06 is a **Visual Direction Reference**. It
communicates hierarchy, whitespace, thin motion graphics, restrained glow, and
brand polish. It is not a pixel-perfect layout or an implementation contract.

- Mock: desired aesthetic direction
- This document and an approved phase design: implementation specification
- PNG Golden: regression baseline captured only after an implementation passes
  iOS device acceptance

The supplied mock must never be used as a PNG Golden. Mock-only elements,
including its playback controls and tagline, do not become requirements.

## 3. Brand principles

- Music comes before decoration and advertising.
- The current chord is always the primary visual element.
- Motion must explain a musical event or musical continuity.
- Fewer elements, stronger hierarchy, and deeper whitespace are preferred over
  adding visual information.
- Official brand assets must be used without AI-generated substitutions.
- Visual styles remain recognizable members of one Chord Palette family, but
  they must have distinct musical roles.

## 4. Music-first hierarchy

The required visual priority is:

1. Current chord
2. Progress or harmonic motion
3. Chord function and supplemental information
4. Keyboard
5. Title, BPM, and style
6. Branding

No glow, motion line, keyboard highlight, title, or brand element may compete
with the current chord name.

## 5. Minimal Luxe × Musical Motion

Minimal Luxe means:

- deep navy or near-black depth instead of flat black
- generous negative space
- clean, bold typography
- thin and precise line work
- localized soft bloom instead of broad neon effects
- a small, intentional number of elements

Musical Motion means:

- chord onset, duration, transition, and progress are the only animation drivers
- explicit harmonic metadata may be displayed, but must not be invented
- random, decorative, wall-clock, or audio-reactive animation is prohibited
- visual state is deterministic for the same export plan and timestamp

## 6. Adopted elements

The following direction is adopted:

- very subtle deep-navy vertical depth
- a larger current chord with long-name fit protection
- more space between chord, motion graphic, and keyboard
- thin progress or continuity graphics
- a shorter, lower-priority keyboard information strip
- localized soft glow and moving focus
- official app icon; an official wordmark only when a repository-owned asset exists

The keyboard remains functional chord-note visualization. Its note mapping and
music data must not change.

## 7. Rejected elements

The following are explicitly excluded:

- large HUD or radar rings
- multiple decorative circles
- waveforms or pseudo audio spectra
- particles, random stars, and random glow
- planets, large animated background objects, and 3D effects
- decorative English phrases and taglines
- excessive grids, strong lens flares, flashes, strobes, and flashy neon
- random colors and theory-function color mapping
- visual effects that mutate musical data

The mock tagline `PLAY MORE COLORS` is not a product asset and must not appear.

## 8. Classic role

Classic is the accepted production baseline: a tasteful animated chord display.
Its layout, timing, font, colors, animation, keyboard, and branding are frozen.

Phase V4 must not refactor Classic into shared styling code or apply Minimal Luxe
changes to it. A future `Classic v2` requires a separate phase and acceptance
baseline.

## 9. Pulse role

Pulse is the accepted rhythm and progress visualization:

- Active Chord Lift
- Progress Trace
- Chord Onset Focus

Pulse source and PNG Goldens are frozen in Phase V4. Flow must not reuse or
imitate Pulse's straight progress trace, lifted active card, or onset ring.

The current Pulse wordmark remains frozen even where the new Flow branding rules
are stricter. Any Pulse branding revision belongs to a future Pulse-specific
phase.

## 10. Flow role

Flow is **Continuity / Harmonic Motion Visualization**.

Pulse emphasizes “now.” Flow emphasizes “continuing into the next chord.”

Flow must provide:

- Smooth Focus across previous, current, and next chords
- a thin, gentle Bézier Motion Line
- a localized Moving Glow whose center travels toward the next chord

Flow uses only `ExportPlan.segments` through native `RenderPlan.segments`.
It must not derive chord timing from BPM, frame count, timers, audio analysis,
Energy, or an independent timeline.

## 11. Official branding rules

The official native video icon is:

`modules/chord-video-export/ios/assets/cp-watermark.png`

Its source and intended use are documented in:

`docs/design/app-icons.md`

The repository contains the official palette icon with three black keys and
seven colored dots, but no standalone official wordmark image. Phase V4
therefore uses only `cp-watermark.png`. It must not reconstruct a wordmark from
text or create a substitute asset.

The lockup remains smaller and quieter than the current chord. No tagline,
generated logo, substitute icon, or decorative brand copy may be added.

Because Classic and Pulse are frozen, Flow owns the minimal icon drawing code
rather than extracting code from either renderer during V4.

## 12. Typography direction

- Use the existing Chord Palette font registration when available, with the
  existing heavy system-font fallback.
- Current chord text is bold, clean, large, and the dominant element.
- Degree or key-context text is smaller and neutral.
- Title, BPM, and style metadata are quiet tertiary text.
- Full chord text must remain visible for `C#m7(♭5)`, `G13(♭9)`, `Fmaj9/A`,
  `dim`, `sus`, `add`, `9`, `11`, `13`, `♭`, `♯`, and `ø`.
- Long names use measured font fitting with a defined minimum size; ellipsis is
  not acceptable for the current chord.

## 13. Color direction

Flow's base palette is:

- deep navy / near black
- Chord Palette green
- very subtle cool blue
- white and muted blue-gray typography

Green-to-blue gradients may only support continuity or moving focus. They must
not become a rainbow background.

Flow does not map chord function, Energy, theory level, or harmonic
sophistication to color. The multicolor palette is reserved for the official
icon and wordmark.

## 14. Motion principles

- Every animation is deterministic and segment-derived.
- Smooth Focus interpolates within `segment.startSec ... segment.endSec`.
- Current and adjacent chord states use restrained opacity and scale:
  - current opacity `1.0`, scale target around `1.02`
  - adjacent opacity `0.60 ... 0.75`, scale `0.97 ... 0.99`
- Motion uses smoothstep or cubic ease-in-out without bounce or overshoot.
- The Motion Line is a thin, low-amplitude Bézier curve, not a waveform.
- Moving Glow follows the same eased transition phase as focus.
- Flash, strobe, brightness jumps, bursts, and random motion are prohibited.
- The final chord transitions toward the first chord using the same cyclic
  segment relationship so the final-to-start boundary remains visually natural.

## 15. Performance constraints

- No particle systems, shaders, real-time Gaussian blur stacks, or audio analysis
- No per-frame allocation of large image assets
- Official icon loaded and cached once
- Geometry expressed in normalized coordinates and reused where practical
- At most a small fixed number of gradients and paths per frame
- One localized radial gradient is preferred over blur layers for glow
- Renderer selection occurs once per export
- Flow should remain within the initial target of Classic render cost +20%
- Render failure, memory growth, stutter, and export-duration changes are hard
  failures

## 16. Future Evolution Template boundary

Evolution is not a visual style.

- `VideoVisualStyle`: `classic | pulse | flow`
- Future `VideoTemplateId`: `standard | evolution`
- Future `EvolutionVideoStage`: stage metadata supplied to a template

The future Evolution template owns temporal and content composition such as
stage order, stage labels, chord-set changes, transitions, and final hold. A
visual style owns only rendering behavior.

The video layer must never call the Evolution Engine or mutate domain data.
Phase V4 must not add `VideoTemplateId`, stage contracts, stage generation, or
Evolution rendering.
