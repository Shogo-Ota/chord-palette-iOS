import { totalBars } from '@/lib/progression';
import type { Project, ProjectSummary } from '@/types';

const ACCENTS = ['#7c4dff', '#3b82f6', '#22c55e', '#f97316', '#d6409f', '#eab308'];

/** Deterministic accent color for a project id (stable across sessions). */
export function accentFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return ACCENTS[hash % ACCENTS.length];
}

/** Japanese relative-time label for the list screen. */
export function formatRelativeTime(timestamp: number, now: number = Date.now()): string {
  const diff = Math.max(0, now - timestamp);
  const MIN = 60_000;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;
  const WEEK = 7 * DAY;
  if (diff < MIN) return 'たった今';
  if (diff < HOUR) return `${Math.floor(diff / MIN)}分前`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}時間前`;
  if (diff < WEEK) return `${Math.floor(diff / DAY)}日前`;
  if (diff < 4 * WEEK) return `${Math.floor(diff / WEEK)}週間前`;
  const d = new Date(timestamp);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

/** Compact chord preview, e.g. "C · G · Am · F" (truncates past `max`). */
export function chordsDisplay(project: Project, max = 4): string {
  const names = project.chordEvents.map((e) => e.displayName);
  if (names.length === 0) return 'コードなし';
  const head = names.slice(0, max).join(' · ');
  return names.length > max ? `${head} …` : head;
}

/** Derive the list-screen summary from a full project. */
export function toSummary(project: Project, now: number = Date.now()): ProjectSummary {
  return {
    id: project.id,
    title: project.title,
    keyLabel: `${project.key} Major`,
    tempoBpm: project.tempoBpm,
    bars: totalBars(project.chordEvents),
    chordsDisplay: chordsDisplay(project),
    updatedLabel: formatRelativeTime(project.updatedAt, now),
    accent: accentFor(project.id),
  };
}
