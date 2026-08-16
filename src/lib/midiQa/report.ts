/**
 * Roll QA case / transpose / golden results into report.json + report.md.
 */

import type {
  CaseVerdict,
  FailureCategory,
  GoldenDiff,
  MidiQaReport,
  PatternRollup,
  TransposePairResult,
} from './types';

const CATEGORIES: FailureCategory[] = [
  'harmony',
  'degree',
  'rhythm',
  'register',
  'transpose',
  'structure',
  'regression',
];

function emptyCounts(): Record<FailureCategory, number> {
  return {
    harmony: 0,
    degree: 0,
    rhythm: 0,
    register: 0,
    transpose: 0,
    structure: 0,
    regression: 0,
  };
}

export function buildReport(
  cases: CaseVerdict[],
  transpose: TransposePairResult[],
  golden: GoldenDiff[],
): MidiQaReport {
  const categoryCounts = emptyCounts();
  const byKey = new Map<string, PatternRollup>();

  for (const c of cases) {
    const key = `${c.analysis.pattern}__${c.analysis.variantId}`;
    const row = byKey.get(key) ?? {
      pattern: c.analysis.pattern,
      variantId: c.analysis.variantId,
      cases: 0,
      pass: 0,
      fail: 0,
      failCategories: {},
      failCodes: [],
    };
    row.cases += 1;
    if (c.pass) row.pass += 1;
    else row.fail += 1;
    for (const f of c.analysis.failures) {
      categoryCounts[f.category] += 1;
      row.failCategories[f.category] = (row.failCategories[f.category] ?? 0) + 1;
      if (!row.failCodes.includes(f.code)) row.failCodes.push(f.code);
    }
    byKey.set(key, row);
  }

  for (const t of transpose) {
    const key = `${t.pattern}__${t.variantId}`;
    const row = byKey.get(key);
    if (!row) continue;
    if (!t.pass) {
      row.fail += 1;
      row.failCategories.transpose = (row.failCategories.transpose ?? 0) + t.failures.length;
      for (const f of t.failures) {
        categoryCounts.transpose += 1;
        if (!row.failCodes.includes(f.code)) row.failCodes.push(f.code);
      }
    }
  }

  let regression = 0;
  for (const g of golden) {
    if (g.present && !g.pass) {
      regression += 1;
      categoryCounts.regression += g.failures.length;
    }
  }

  const pass = cases.filter((c) => c.pass).length;
  const fail = cases.length - pass;

  const topFixes = CATEGORIES
    .map((cat) => ({
      title: cat,
      reason: `${categoryCounts[cat]} finding(s)`,
      count: categoryCounts[cat],
    }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  return {
    generatedAt: new Date().toISOString(),
    corpus: cases.length,
    pass,
    fail,
    regression,
    cases,
    transpose,
    golden,
    byPattern: [...byKey.values()],
    categoryCounts,
    topFixes,
  };
}

export function renderReportMarkdown(report: MidiQaReport): string {
  const lines: string[] = [
    '# MIDI QA Report',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    '## TOTAL',
    '',
    `| | |`,
    `|---|---|`,
    `| Corpus | ${report.corpus} |`,
    `| PASS | ${report.pass} |`,
    `| FAIL | ${report.fail} |`,
    `| REGRESSION | ${report.regression} |`,
    '',
    '## Pattern',
    '',
    '| Pattern | Variant | Cases | PASS | FAIL | Categories | Codes |',
    '|---|---|---:|---:|---:|---|---|',
  ];

  for (const row of report.byPattern) {
    const cats = Object.entries(row.failCategories)
      .filter(([, n]) => n)
      .map(([k, n]) => `${k}:${n}`)
      .join(', ');
    const verdict = row.fail === 0 ? 'PASS' : 'FAIL';
    lines.push(
      `| ${row.pattern} | ${row.variantId} | ${row.cases} | ${row.pass} | ${row.fail} (${verdict}) | ${cats || '—'} | ${row.failCodes.join(', ') || '—'} |`,
    );
  }

  lines.push('', '## Categories', '');
  for (const [cat, n] of Object.entries(report.categoryCounts)) {
    lines.push(`- ${cat}: ${n}`);
  }

  lines.push('', '## Transpose A→B', '');
  for (const t of report.transpose) {
    const head = t.pass ? 'PASS' : 'FAIL';
    lines.push(`- ${t.pattern} ${t.variantId}: ${head} (${t.failures.length} findings)`);
  }

  lines.push('', '## Golden', '');
  const withGolden = report.golden.filter((g) => g.present);
  if (withGolden.length === 0) {
    lines.push('No golden MIDI present. Baseline only.');
  } else {
    for (const g of withGolden) {
      lines.push(
        `- ${g.caseId}: ${g.pass ? 'PASS' : 'FAIL'} pitch=${g.pitchDiff} onset=${g.onsetDiff} dur=${g.durationDiff} vel=${g.velocityDiff} cc=${g.ccDiff} notes=${g.noteCountDiff}`,
      );
    }
  }

  lines.push('', '## Top fixes', '');
  for (const [i, fix] of report.topFixes.entries()) {
    lines.push(`${i + 1}. **${fix.title}** — ${fix.reason}`);
  }
  lines.push('');
  return lines.join('\n');
}
