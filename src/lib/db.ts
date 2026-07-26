import * as SQLite from 'expo-sqlite';

const DB_NAME = 'chord-palette.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * Columns added after a table first shipped. `CREATE TABLE IF NOT EXISTS` does
 * nothing for an install that already has the table, so a new field needs its own
 * `ADD COLUMN` — guarded, because SQLite has no `IF NOT EXISTS` for columns and
 * would fail on every launch after the first.
 *
 * Each entry must give a DEFAULT so existing rows get a value; the read path is
 * still responsible for turning that value into something the domain accepts.
 */
const ADDED_COLUMNS: readonly { table: string; column: string; definition: string }[] = [
  {
    table: 'projects',
    column: 'accompaniment_variant',
    definition: "TEXT NOT NULL DEFAULT ''",
  },
];

async function addColumns(db: SQLite.SQLiteDatabase): Promise<void> {
  for (const { table, column, definition } of ADDED_COLUMNS) {
    const existing = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table});`);
    if (existing.some((c) => c.name === column)) continue;
    await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
  }
}

/**
 * Open (once) the local SQLite database and ensure the schema exists.
 * All repositories go through this so migrations live in one place.
 */
export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY NOT NULL,
          title TEXT NOT NULL,
          key TEXT NOT NULL,
          tempo_bpm INTEGER NOT NULL,
          time_signature TEXT NOT NULL,
          instrument_id TEXT NOT NULL,
          groove_id TEXT NOT NULL,
          accompaniment_pattern TEXT NOT NULL,
          chord_events TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS app_meta (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS user_presets (
          id TEXT PRIMARY KEY NOT NULL,
          data TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
      `);
      await addColumns(db);
      return db;
    })();
  }
  return dbPromise;
}
