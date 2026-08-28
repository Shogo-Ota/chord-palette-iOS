/**
 * Where a theory claim comes from, separated at the type level.
 *
 * The whole point of this database is that "the book says so" and "Chord Palette
 * decided so" are different kinds of authority. A book claim can be checked against a
 * printed page; an app policy cannot, and must never be defended by citing the book.
 *
 * So the split is a type, not a convention: a table declared as book-derived accepts
 * only {@link BookSourceRef}, which makes smuggling an app policy into it a compile
 * error rather than a review comment someone has to catch.
 */

/** Claims traceable to a printed page of the source book. */
export type BookProvenanceKind =
  /** Stated directly in the body text or a summary table. */
  | 'BOOK_EXPLICIT'
  /** Derived by us from a diagram, fretboard chart or table. */
  | 'BOOK_DIAGRAM';

/** Chord Palette's own design decisions. The book does not assert these. */
export type AppPolicyProvenanceKind = 'APP_POLICY_PROPOSED';

export type ProvenanceKind = BookProvenanceKind | AppPolicyProvenanceKind;

export type BookSourceRef = {
  kind: BookProvenanceKind;
  /** Printed page numbers, so a reader can verify the claim. Never empty. */
  printedPages: readonly number[];
  chapter: string;
  note?: string;
};

export type AppPolicySourceRef = {
  kind: AppPolicyProvenanceKind;
  chapter: string;
  note?: string;
  /** An app policy has no page to cite, so it may not pretend to have one. */
  printedPages?: never;
};

export type SourceRef = BookSourceRef | AppPolicySourceRef;

export function isBookSourced(ref: SourceRef): ref is BookSourceRef {
  return ref.kind === 'BOOK_EXPLICIT' || ref.kind === 'BOOK_DIAGRAM';
}

export const SOURCE_TITLE = '養父 貴『ギターで覚える音楽理論』';
export const THEORY_DB_VERSION = '0.1.0';
