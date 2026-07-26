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
const ADDED_COLUMNS: readonly {
  table: string;
  column: string;
  definition: string;
  /**
   * Run once, right after the column appears, when the DEFAULT is the right answer
   * for new rows but the wrong one for rows that already exist. Safe on a fresh
   * install: the table is empty at that point, so it touches nothing.
   */
  backfill?: string;
}[] = [
  {
    table: 'projects',
    column: 'accompaniment_variant',
    definition: "TEXT NOT NULL DEFAULT ''",
  },
  {
    table: 'projects',
    column: 'cap_exempt',
    definition: 'INTEGER NOT NULL DEFAULT 0',
    // Grandfathering. A free tier save limit is arriving, and people already have
    // projects that predate it — some of them more than the new cap allows. Marking
    // everything that exists at migration time as exempt means the limit only ever
    // applies to what someone makes next; nothing they already wrote is taken away
    // or held hostage.
    //
    // Export quality gets the same treatment, but it has no rows to mark, so the
    // install itself is flagged. `seeded` is only present once the app has run
    // before, which is exactly the "this person was already here" test.
    backfill: `
      UPDATE projects SET cap_exempt = 1;
      INSERT OR IGNORE INTO app_meta (key, value)
        SELECT 'legacy_export_quality', '1'
        WHERE EXISTS (SELECT 1 FROM app_meta WHERE key = 'seeded');
    `,
  },
  {
    table: 'projects',
    column: 'favorite',
    // No backfill: favourites did not exist before this column, so nothing to
    // grandfather — every row starts unfavourited whichever tier made it.
    definition: 'INTEGER NOT NULL DEFAULT 0',
  },
];

async function addColumns(db: SQLite.SQLiteDatabase): Promise<void> {
  for (const { table, column, definition, backfill } of ADDED_COLUMNS) {
    const existing = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table});`);
    if (existing.some((c) => c.name === column)) continue;
    await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
    if (backfill) await db.execAsync(backfill);
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
