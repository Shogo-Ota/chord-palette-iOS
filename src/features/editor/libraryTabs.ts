import type { SegOption } from '@/components/controls';
import type { KeyMode } from '@/types';

/**
 * Which library tabs the editor offers, and which of them a given mode can honour.
 *
 * Each mode owns its advanced provider. Major exposes secondary dominants and modal
 * interchange; minor exposes its sourced harmonic-minor V7 family.
 */
export type LibraryTab = 'diatonic' | 'advanced' | 'slash';

const TAB_LABELS: Record<LibraryTab, string> = {
  diatonic: 'ダイアトニック',
  advanced: '応用',
  slash: 'オンコード',
};

/** True when the mode has degree tables for the 応用 tab and the variation pills. */
export function supportsAdvancedTiers(mode: KeyMode): boolean {
  return mode === 'major' || mode === 'minor';
}

export function libraryTabsFor(mode: KeyMode): LibraryTab[] {
  const tabs: LibraryTab[] = ['diatonic'];
  if (supportsAdvancedTiers(mode)) tabs.push('advanced');
  tabs.push('slash');
  return tabs;
}

export function libraryTabOptions(mode: KeyMode): SegOption[] {
  return libraryTabsFor(mode).map((key) => ({ key, label: TAB_LABELS[key] }));
}

/**
 * The tab to show, given what the user last chose. Switching to minor while standing on
 * 応用 would otherwise leave an empty panel behind a hidden tab.
 */
export function resolveLibraryTab(tab: LibraryTab, mode: KeyMode): LibraryTab {
  return libraryTabsFor(mode).includes(tab) ? tab : 'diatonic';
}
