export {
  chordStyleKey,
  distinctChordStyles,
  normalizeChordStyleOverrides,
  normalizeChordStyleOverride,
  resolveEffectiveStyles,
  PUBLIC_CHORD_STYLES,
  type EffectiveChordStyle,
  type InvalidChordStyleOverrideHandler,
} from './effectiveStyle';
export {
  crossesStyleBoundary,
  harmonyOwnerChordIndex,
  renderOwnerChordIndex,
  type OwnedControlChange,
} from './renderOwnership';
export {
  renderMaskedStyles,
  type ChordStyleRenderer,
  type MaskedStyleRenderResult,
  type StyleRenderResult,
} from './renderMaskedStyles';
