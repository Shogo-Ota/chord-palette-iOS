import * as SQLite from 'expo-sqlite';

const DB_NAME = 'chord-palette.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

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
      return db;
    })();
  }
  return dbPromise;
}
