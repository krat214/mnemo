import type Database from "better-sqlite3";
import { createHash } from "node:crypto";
import { ulid } from "ulid";
import { decay, reinforce } from "./salience.js";
import type { Episode, Memory, Trait } from "./types.js";

function hashContent(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export function capture(db: Database.Database, params: { scope: string; content: string }): { episode: Episode; deduped: boolean } {
  const { scope, content } = params;
  if (!scope.trim()) throw new Error("scope is required");
  if (!content.trim()) throw new Error("content is required");

  const hash = hashContent(content);
  const existing = db
    .prepare<[string, string], Episode>("SELECT * FROM episodes WHERE scope = ? AND content_hash = ?")
    .get(scope, hash);
  if (existing) return { episode: existing, deduped: true };

  const episode: Episode = {
    id: ulid(),
    scope,
    content,
    content_hash: hash,
    created_at: new Date().toISOString(),
    consolidated_into: null
  };
  db.prepare(
    "INSERT INTO episodes (id, scope, content, content_hash, created_at) VALUES (@id, @scope, @content, @content_hash, @created_at)"
  ).run(episode);
  return { episode, deduped: false };
}

export interface RecallResult {
  memories: Array<Memory & { rank: number }>;
  /** Raw episodes not yet consolidated that match the query (fresh captures). */
  episodes: Array<Episode & { rank: number }>;
  traits: Trait[];
}

export function recall(db: Database.Database, params: { scope?: string; query: string; limit?: number }): RecallResult {
  const { scope, query } = params;
  const limit = Math.min(Math.max(Math.trunc(Number(params.limit ?? 10)) || 10, 1), 100);
  if (!query.trim()) throw new Error("query is required");

  const ftsQuery = query
    .split(/\s+/)
    .filter(Boolean)
    .map((term) => `"${term.replace(/"/g, '""')}"*`)
    .join(" OR ");

  const episodeScopeFilter = scope ? "AND e.scope = @scope" : "";
  const episodes = db
    .prepare<{ ftsQuery: string; scope?: string; limit: number }, Episode & { rank: number }>(
      `SELECT e.*, bm25(episodes_fts) AS rank
       FROM episodes_fts
       JOIN episodes e ON e.rowid = episodes_fts.rowid
       WHERE episodes_fts MATCH @ftsQuery AND e.consolidated_into IS NULL ${episodeScopeFilter}
       ORDER BY rank LIMIT @limit`
    )
    .all({ ftsQuery, scope, limit });

  const scopeFilter = scope ? "AND m.scope = @scope" : "";
  const rows = db
    .prepare<{ ftsQuery: string; scope?: string; limit: number }, Memory & { rank: number }>(
      `SELECT m.*, bm25(memories_fts) AS rank
       FROM memories_fts
       JOIN memories m ON m.rowid = memories_fts.rowid
       WHERE memories_fts MATCH @ftsQuery ${scopeFilter}
       ORDER BY rank LIMIT @limit`
    )
    .all({ ftsQuery, scope, limit });

  const now = new Date();
  const touched: Array<Memory & { rank: number }> = [];
  const updateStmt = db.prepare("UPDATE memories SET salience = ?, salience_updated_at = ? WHERE id = ?");

  const tx = db.transaction(() => {
    for (const row of rows) {
      const decayed = decay(row.salience, new Date(row.salience_updated_at), now);
      const reinforced = reinforce(decayed);
      updateStmt.run(reinforced, now.toISOString(), row.id);
      touched.push({ ...row, salience: reinforced, salience_updated_at: now.toISOString() });
    }
  });
  tx();

  const traitFilter = scope ? "WHERE scope = ?" : "";
  const traitParams = scope ? [scope] : [];
  const traits = db.prepare<unknown[], Trait>(`SELECT * FROM traits ${traitFilter} ORDER BY updated_at DESC`).all(...traitParams);

  return { memories: touched, episodes, traits };
}

export function consolidate(
  db: Database.Database,
  params: { scope: string; summarize?: (episodes: Episode[]) => Promise<{ gist: string; details?: string }> | { gist: string; details?: string } }
): Promise<Memory | null> | Memory | null {
  const { scope, summarize } = params;
  const episodes = db
    .prepare<[string], Episode>("SELECT * FROM episodes WHERE scope = ? AND consolidated_into IS NULL ORDER BY created_at ASC")
    .all(scope);
  if (episodes.length === 0) return null;

  const finish = (result: { gist: string; details?: string }): Memory => {
    const memory: Memory = {
      id: ulid(),
      scope,
      gist: result.gist,
      details: result.details ?? null,
      salience: 1.0,
      salience_updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    const tx = db.transaction(() => {
      db.prepare(
        "INSERT INTO memories (id, scope, gist, details, salience, salience_updated_at, created_at, updated_at) VALUES (@id, @scope, @gist, @details, @salience, @salience_updated_at, @created_at, @updated_at)"
      ).run(memory);
      const markConsolidated = db.prepare("UPDATE episodes SET consolidated_into = ? WHERE id = ?");
      for (const ep of episodes) markConsolidated.run(memory.id, ep.id);
    });
    tx();
    return memory;
  };

  const summarizer = summarize ?? naiveSummarize;
  const result = summarizer(episodes);
  if (result instanceof Promise) return result.then(finish);
  return finish(result);
}

function naiveSummarize(episodes: Episode[]): { gist: string; details: string } {
  const gist = episodes.length === 1 ? episodes[0].content.slice(0, 200) : `${episodes.length} episodios consolidados`;
  const details = episodes.map((e) => `- [${e.created_at}] ${e.content}`).join("\n");
  return { gist, details };
}

export function crystallize(db: Database.Database, params: { scope: string; name: string; value: string; evidence?: string }): Trait {
  const { scope, name, value, evidence } = params;
  if (!name.trim()) throw new Error("name is required");
  if (!value.trim()) throw new Error("value is required");

  const now = new Date().toISOString();
  const existing = db.prepare<[string, string], Trait>("SELECT * FROM traits WHERE scope = ? AND name = ?").get(scope, name);

  if (existing) {
    db.prepare("UPDATE traits SET value = ?, evidence = ?, updated_at = ? WHERE id = ?").run(value, evidence ?? null, now, existing.id);
    return { ...existing, value, evidence: evidence ?? null, updated_at: now };
  }

  const trait: Trait = { id: ulid(), scope, name, value, evidence: evidence ?? null, created_at: now, updated_at: now };
  db.prepare(
    "INSERT INTO traits (id, scope, name, value, evidence, created_at, updated_at) VALUES (@id, @scope, @name, @value, @evidence, @created_at, @updated_at)"
  ).run(trait);
  return trait;
}

export function forget(db: Database.Database, params: { id?: string; scope?: string; belowSalience?: number }): { deleted: number } {
  const { id, scope, belowSalience } = params;

  if (id) {
    const result = db.prepare("DELETE FROM memories WHERE id = ?").run(id);
    return { deleted: result.changes };
  }

  if (belowSalience !== undefined) {
    const scopeFilter = scope ? "AND scope = ?" : "";
    const rows = db
      .prepare<unknown[], Memory>(`SELECT * FROM memories WHERE 1=1 ${scopeFilter}`)
      .all(...(scope ? [scope] : []));
    const now = new Date();
    const toDelete = rows.filter((r) => decay(r.salience, new Date(r.salience_updated_at), now) < belowSalience);
    const del = db.prepare("DELETE FROM memories WHERE id = ?");
    const tx = db.transaction(() => {
      for (const r of toDelete) del.run(r.id);
    });
    tx();
    return { deleted: toDelete.length };
  }

  throw new Error("forget requires either id or belowSalience");
}
