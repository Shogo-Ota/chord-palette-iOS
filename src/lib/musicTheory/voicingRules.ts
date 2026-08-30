/**
 * The book's voicing principles, from the practical-guitar-voicing chapter.
 *
 * The guitar's six-string limit is in here and is explicitly marked as not global. It is
 * the one rule in this file that must not reach a piano voicing: a keyboard has no reason
 * to inherit a physical constraint of a different instrument, and a five-note piano
 * voicing is not a violation of anything the book says.
 */

import type { BookSourceRef } from './provenance';

const PRACTICAL_VOICING_CORE: BookSourceRef = {
  kind: 'BOOK_EXPLICIT',
  printedPages: [224, 225, 228, 229, 230],
  chapter: 'Part 4 / 実践的ギター・ボイシング',
};

export const VOICING_THEORY = {
  /** For a seventh chord the 3rd and 7th are what identify it. */
  guideTones: {
    seventhChordCharacteristicDegrees: ['3rd', '7th'] as const,
    source: [PRACTICAL_VOICING_CORE] satisfies readonly BookSourceRef[],
  },

  fifthOmission: {
    normallyMayOmitPerfectFifth: true,
    /** A ♭5 or ♯5 is colour, so the permission above does not extend to it. */
    retainIfFifthIsAltered: true,
    source: [
      {
        kind: 'BOOK_EXPLICIT',
        printedPages: [227, 228],
        chapter: 'Part 4 / 実践的ギター・ボイシング',
      },
    ] satisfies readonly BookSourceRef[],
  },

  rootOmission: {
    /**
     * Note the condition: the bass supplying the root is the only requirement the book
     * states. It does not additionally require the chord to be large.
     */
    allowedWhenBassProvidesRoot: true,
    rationale: 'Rootless upper voicing increases voicing freedom; preserve 3rd/7th identity.',
    source: [
      {
        kind: 'BOOK_EXPLICIT',
        printedPages: [226, 227, 228, 229],
        chapter: 'Part 4 / 実践的ギター・ボイシング',
      },
    ] satisfies readonly BookSourceRef[],
  },

  extensionConstruction: {
    preferredBaseForSeventhChords: ['3rd', '7th'] as const,
    thenAddAvailableTensions: true,
    source: [
      {
        kind: 'BOOK_EXPLICIT',
        printedPages: [224, 229, 230],
        chapter: 'Part 4 / 実践的ギター・ボイシング',
      },
    ] satisfies readonly BookSourceRef[],
  },

  guitarPhysicalLimit: {
    maxSimultaneousStrings: 6,
    /** Guitar-specific. Must never become a global polyphony limit. */
    applyGlobally: false,
    source: [
      {
        kind: 'BOOK_EXPLICIT',
        printedPages: [226],
        chapter: 'Part 4 / 実践的ギター・ボイシング',
      },
    ] satisfies readonly BookSourceRef[],
  },
} as const;
