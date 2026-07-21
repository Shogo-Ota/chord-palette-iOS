import type { SQLiteDatabase } from 'expo-sqlite';

import { STARTER_PRESET } from '@/data/presets';
import { DEFAULT_ACCOMPANIMENT, normalizeAccompaniment } from '@/lib/accompaniment';
import { getDb } from '@/lib/db';
import { normalizeGroove } from '@/lib/groove';
import { buildPresetProgression } from '@/lib/presets';
import type { NewProjectInput, Project } from '@/types';

/** Raw DB row shape (snake_case columns). */
type ProjectRow = {
  id: string;
  title: string;
  key: string;
  tempo_bpm: number;
  time_signature: string;
  instrument_id: string;
  groove_id: string;
  accompaniment_pattern: string;
  chord_events: string;
  created_at: number;
  updated_at: number;
};

const DEFAULTS: Omit<Project, 'id' | 'createdAt' | 'updatedAt'> = {
  title: '新しい進行',
  key: 'C',
  tempoBpm: 100,
  timeSignature: '4/4',
  instrumentId: 'piano',
  grooveId: 'pop8',
  accompanimentPattern: DEFAULT_ACCOMPANIMENT,
  chordEvents: [],
};

function genId(): string {
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function rowToProject(row: ProjectRow): Project {
  return {
    id: row.id,
    title: row.title,
    key: row.key as Project['key'],
    tempoBpm: row.tempo_bpm,
    timeSignature: row.time_signature as Project['timeSignature'],
    instrumentId: row.instrument_id as Project['instrumentId'],
    // Migrate any legacy persisted groove (e.g. retired jazzSwing) on read.
    grooveId: normalizeGroove(row.groove_id),
    // Migrate any legacy persisted id (eightBeat/sixteenthBeat) on read.
    accompanimentPattern: normalizeAccompaniment(row.accompaniment_pattern),
    chordEvents: JSON.parse(row.chord_events) as Project['chordEvents'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function upsert(db: SQLiteDatabase, p: Project): Promise<void> {
  await db.runAsync(
    `INSERT INTO projects
       (id, title, key, tempo_bpm, time_signature, instrument_id, groove_id,
        accompaniment_pattern, chord_events, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title,
       key = excluded.key,
       tempo_bpm = excluded.tempo_bpm,
       time_signature = excluded.time_signature,
       instrument_id = excluded.instrument_id,
       groove_id = excluded.groove_id,
       accompaniment_pattern = excluded.accompaniment_pattern,
       chord_events = excluded.chord_events,
       updated_at = excluded.updated_at;`,
    [
      p.id,
      p.title,
      p.key,
      p.tempoBpm,
      p.timeSignature,
      p.instrumentId,
      p.grooveId,
      p.accompanimentPattern,
      JSON.stringify(p.chordEvents),
      p.createdAt,
      p.updatedAt,
    ],
  );
}

/** Seed a single demo project on first launch only (requirements: J-POP王道進行). */
async function ensureSeeded(db: SQLiteDatabase): Promise<void> {
  const seeded = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM app_meta WHERE key = 'seeded';`,
  );
  if (seeded) return;

  const now = Date.now();
  const chordEvents = buildPresetProgression(STARTER_PRESET, 'C').map((e, i) => ({
    ...e,
    id: `seed-${i}`,
  }));
  await upsert(db, {
    ...DEFAULTS,
    id: genId(),
    title: STARTER_PRESET.name,
    key: 'C',
    chordEvents,
    createdAt: now,
    updatedAt: now,
  });
  await db.runAsync(`INSERT OR REPLACE INTO app_meta (key, value) VALUES ('seeded', '1');`);
}

/** All projects, newest first. Seeds the demo project on first ever call. */
export async function listProjects(): Promise<Project[]> {
  const db = await getDb();
  await ensureSeeded(db);
  const rows = await db.getAllAsync<ProjectRow>(
    `SELECT * FROM projects ORDER BY updated_at DESC;`,
  );
  return rows.map(rowToProject);
}

export async function getProject(id: string): Promise<Project | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<ProjectRow>(`SELECT * FROM projects WHERE id = ?;`, [id]);
  return row ? rowToProject(row) : null;
}

/** Create a new project with defaults overridden by `input`. */
export async function createProject(input: NewProjectInput = {}): Promise<Project> {
  const db = await getDb();
  const now = Date.now();
  const project: Project = {
    ...DEFAULTS,
    ...input,
    id: genId(),
    createdAt: now,
    updatedAt: now,
  };
  await upsert(db, project);
  return project;
}

/** Persist changes to an existing project (bumps updatedAt). Returns the saved project. */
export async function saveProject(project: Project): Promise<Project> {
  const db = await getDb();
  const saved: Project = { ...project, updatedAt: Date.now() };
  await upsert(db, saved);
  return saved;
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM projects WHERE id = ?;`, [id]);
}

/** Duplicate a project into an independent copy (requirements §11 "この進行を使う"). */
export async function duplicateProject(id: string): Promise<Project | null> {
  const source = await getProject(id);
  if (!source) return null;
  const now = Date.now();
  const copy: Project = {
    ...source,
    id: genId(),
    title: `${source.title} のコピー`,
    createdAt: now,
    updatedAt: now,
  };
  const db = await getDb();
  await upsert(db, copy);
  return copy;
}
