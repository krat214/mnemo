import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { homedir } from "node:os";
import { resolve } from "node:path";

export function defaultDbPath(): string {
  return resolve(process.env.MNEMO_DB ?? `${homedir()}/.mnemo/mem.db`);
}

export function openDb(path: string = defaultDbPath()): Database.Database {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  return db;
}

function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS episodes (
      id TEXT PRIMARY KEY,
      scope TEXT NOT NULL,
      content TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      consolidated_into TEXT
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_episodes_scope_hash ON episodes(scope, content_hash);
    CREATE INDEX IF NOT EXISTS idx_episodes_scope ON episodes(scope);

    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY,
      scope TEXT NOT NULL,
      gist TEXT NOT NULL,
      details TEXT,
      salience REAL NOT NULL DEFAULT 1.0,
      salience_updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
    CREATE INDEX IF NOT EXISTS idx_memories_scope ON memories(scope);

    CREATE TABLE IF NOT EXISTS traits (
      id TEXT PRIMARY KEY,
      scope TEXT NOT NULL,
      name TEXT NOT NULL,
      value TEXT NOT NULL,
      evidence TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_traits_scope_name ON traits(scope, name);

    CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
      gist, details, content='memories', content_rowid='rowid'
    );

    CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
      INSERT INTO memories_fts(rowid, gist, details) VALUES (new.rowid, new.gist, new.details);
    END;
    CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
      INSERT INTO memories_fts(memories_fts, rowid, gist, details) VALUES ('delete', old.rowid, old.gist, old.details);
    END;
    CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE ON memories BEGIN
      INSERT INTO memories_fts(memories_fts, rowid, gist, details) VALUES ('delete', old.rowid, old.gist, old.details);
      INSERT INTO memories_fts(rowid, gist, details) VALUES (new.rowid, new.gist, new.details);
    END;
  `);
}
