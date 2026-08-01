#!/usr/bin/env node
import express from "express";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { openDb } from "./db.js";
import { capture, recall, consolidate, crystallize, forget } from "./tools.js";
import { resolveAuthConfig, basicAuthMiddleware } from "./auth.js";
import type { Memory, Episode, Trait } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const authConfig = resolveAuthConfig(); // throws (refuses to start) if unset and not explicitly opted out

const db = openDb();
const app = express();
app.use(express.json());
app.use(basicAuthMiddleware(authConfig));

app.get("/healthz", (_req, res) => res.json({ ok: true }));

app.post("/api/capture", (req, res) => {
  try {
    res.json(capture(db, req.body));
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

app.get("/api/recall", (req, res) => {
  try {
    const scope = typeof req.query.scope === "string" ? req.query.scope : undefined;
    const query = typeof req.query.q === "string" ? req.query.q : "";
    res.json(recall(db, { scope, query }));
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

app.post("/api/consolidate", async (req, res) => {
  try {
    res.json(await consolidate(db, req.body));
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

app.post("/api/crystallize", (req, res) => {
  try {
    res.json(crystallize(db, req.body));
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

app.delete("/api/forget", (req, res) => {
  try {
    res.json(forget(db, req.body));
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

// --- Read/write endpoints for the memory-editing UI (Mnemo's differentiator) ---

app.get("/api/memories", (req, res) => {
  const scope = typeof req.query.scope === "string" ? req.query.scope : undefined;
  const rows = scope
    ? db.prepare<[string], Memory>("SELECT * FROM memories WHERE scope = ? ORDER BY updated_at DESC").all(scope)
    : db.prepare<[], Memory>("SELECT * FROM memories ORDER BY updated_at DESC").all();
  res.json(rows);
});

app.patch("/api/memories/:id", (req, res) => {
  const { gist, details } = req.body as { gist?: string; details?: string };
  const now = new Date().toISOString();
  const result = db
    .prepare("UPDATE memories SET gist = COALESCE(?, gist), details = COALESCE(?, details), updated_at = ? WHERE id = ?")
    .run(gist, details, now, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: "not found" });
  res.json(db.prepare<[string], Memory>("SELECT * FROM memories WHERE id = ?").get(req.params.id));
});

app.delete("/api/memories/:id", (req, res) => {
  const result = db.prepare("DELETE FROM memories WHERE id = ?").run(req.params.id);
  res.json({ deleted: result.changes });
});

app.get("/api/episodes", (req, res) => {
  const scope = typeof req.query.scope === "string" ? req.query.scope : undefined;
  const rows = scope
    ? db.prepare<[string], Episode>("SELECT * FROM episodes WHERE scope = ? ORDER BY created_at DESC").all(scope)
    : db.prepare<[], Episode>("SELECT * FROM episodes ORDER BY created_at DESC").all();
  res.json(rows);
});

app.get("/api/traits", (req, res) => {
  const scope = typeof req.query.scope === "string" ? req.query.scope : undefined;
  const rows = scope
    ? db.prepare<[string], Trait>("SELECT * FROM traits WHERE scope = ? ORDER BY updated_at DESC").all(scope)
    : db.prepare<[], Trait>("SELECT * FROM traits ORDER BY updated_at DESC").all();
  res.json(rows);
});

app.delete("/api/traits/:id", (req, res) => {
  const result = db.prepare("DELETE FROM traits WHERE id = ?").run(req.params.id);
  res.json({ deleted: result.changes });
});

app.get("/api/scopes", (_req, res) => {
  const rows = db
    .prepare<[], { scope: string }>(
      `SELECT scope FROM episodes UNION SELECT scope FROM memories UNION SELECT scope FROM traits ORDER BY scope`
    )
    .all();
  res.json(rows.map((r) => r.scope));
});

// --- Static UI ---
const uiDist = join(__dirname, "..", "ui", "dist");
if (existsSync(uiDist)) {
  app.use(express.static(uiDist));
  app.get("*", (_req, res) => res.sendFile(join(uiDist, "index.html")));
}

const port = Number(process.env.PORT ?? 3200);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`[mnemo] HTTP server listening on :${port}${authConfig ? " (auth required)" : " (NO AUTH)"}`);
});
