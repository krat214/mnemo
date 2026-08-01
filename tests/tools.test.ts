import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type Database from "better-sqlite3";
import { openDb } from "../src/db.js";
import { capture, recall, consolidate, crystallize, forget } from "../src/tools.js";

let dir: string;
let db: Database.Database;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "mnemo-test-"));
  db = openDb(join(dir, "mem.db"));
});

afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("capture", () => {
  it("inserts a new episode", () => {
    const { episode, deduped } = capture(db, { scope: "test", content: "hello world" });
    expect(deduped).toBe(false);
    expect(episode.scope).toBe("test");
    expect(episode.content).toBe("hello world");
  });

  it("dedupes identical content within the same scope", () => {
    capture(db, { scope: "test", content: "same thing" });
    const { deduped } = capture(db, { scope: "test", content: "same thing" });
    expect(deduped).toBe(true);
    const count = db.prepare("SELECT COUNT(*) as n FROM episodes").get() as { n: number };
    expect(count.n).toBe(1);
  });

  it("does not dedupe across different scopes", () => {
    capture(db, { scope: "a", content: "same thing" });
    const { deduped } = capture(db, { scope: "b", content: "same thing" });
    expect(deduped).toBe(false);
  });

  it("rejects empty content", () => {
    expect(() => capture(db, { scope: "test", content: "" })).toThrow();
  });
});

describe("consolidate + recall", () => {
  it("consolidates episodes into a searchable memory", () => {
    capture(db, { scope: "test", content: "Angel prefers dark mode" });
    capture(db, { scope: "test", content: "Angel uses vim keybindings" });
    const memory = consolidate(db, { scope: "test" });
    expect(memory).not.toBeNull();

    const result = recall(db, { scope: "test", query: "dark mode" });
    expect(result.memories.length).toBeGreaterThan(0);
  });

  it("returns null when there are no un-consolidated episodes", () => {
    const memory = consolidate(db, { scope: "empty-scope" });
    expect(memory).toBeNull();
  });

  it("does not re-consolidate already-consolidated episodes", () => {
    capture(db, { scope: "test", content: "first batch" });
    consolidate(db, { scope: "test" });
    capture(db, { scope: "test", content: "second batch" });
    const second = consolidate(db, { scope: "test" });
    expect(second?.details).toContain("second batch");
    expect(second?.details).not.toContain("first batch");
  });

  it("reinforces salience on recall", () => {
    capture(db, { scope: "test", content: "reinforce me" });
    consolidate(db, { scope: "test" });
    const before = recall(db, { scope: "test", query: "reinforce" });
    const salienceBefore = before.memories[0].salience;
    const after = recall(db, { scope: "test", query: "reinforce" });
    expect(after.memories[0].salience).toBeGreaterThanOrEqual(salienceBefore);
  });
});

describe("crystallize", () => {
  it("creates a new trait", () => {
    const trait = crystallize(db, { scope: "test", name: "editor", value: "vim" });
    expect(trait.value).toBe("vim");
  });

  it("upserts on the same (scope, name)", () => {
    crystallize(db, { scope: "test", name: "editor", value: "vim" });
    const updated = crystallize(db, { scope: "test", name: "editor", value: "emacs" });
    expect(updated.value).toBe("emacs");
    const count = db.prepare("SELECT COUNT(*) as n FROM traits").get() as { n: number };
    expect(count.n).toBe(1);
  });

  it("shows up in recall results for its scope", () => {
    crystallize(db, { scope: "test", name: "editor", value: "vim" });
    const result = recall(db, { scope: "test", query: "anything" });
    expect(result.traits.some((t) => t.name === "editor")).toBe(true);
  });
});

describe("forget", () => {
  it("deletes a memory by id", () => {
    capture(db, { scope: "test", content: "temporary" });
    const memory = consolidate(db, { scope: "test" });
    const { deleted } = forget(db, { id: (memory as { id: string }).id });
    expect(deleted).toBe(1);
  });

  it("deletes memories below a salience threshold", () => {
    capture(db, { scope: "test", content: "low salience" });
    const memory = consolidate(db, { scope: "test" }) as { id: string };
    db.prepare("UPDATE memories SET salience = 0.01 WHERE id = ?").run(memory.id);
    const { deleted } = forget(db, { scope: "test", belowSalience: 0.5 });
    expect(deleted).toBe(1);
  });

  it("throws without id or belowSalience", () => {
    expect(() => forget(db, {})).toThrow();
  });
});
