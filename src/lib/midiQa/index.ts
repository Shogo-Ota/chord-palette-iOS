export { productionSlots, type ProductionSlot } from './catalog';
export { renderQaCase, caseIdFor, sessionForQa, type QaRender } from './generate';
export { QA_PROGRESSIONS, qaProgressionById, type QaProgression, type QaProgressionId } from './progressions';
export { validateCase } from './validate';
export { compareTranspose } from './transpose';
export { compareGolden, songFromSmfBytes, type GoldenSong } from './golden';
export { buildReport, renderReportMarkdown } from './report';
export type { MidiQaReport, CaseVerdict, FailureCategory } from './types';
