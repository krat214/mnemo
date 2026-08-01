import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resolveAuthConfig } from "../src/auth.js";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  delete process.env.MNEMO_AUTH_USER;
  delete process.env.MNEMO_AUTH_PASS;
  delete process.env.MNEMO_ALLOW_NO_AUTH;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("resolveAuthConfig (fail-closed by default — the misMEM bug this fixes)", () => {
  it("throws when no credentials and no explicit opt-out are set", () => {
    expect(() => resolveAuthConfig()).toThrow(/Refusing to start/);
  });

  it("returns credentials when both user and pass are set", () => {
    process.env.MNEMO_AUTH_USER = "alice";
    process.env.MNEMO_AUTH_PASS = "secret";
    const config = resolveAuthConfig();
    expect(config).toEqual({ user: "alice", pass: "secret" });
  });

  it("throws when only user is set", () => {
    process.env.MNEMO_AUTH_USER = "alice";
    expect(() => resolveAuthConfig()).toThrow();
  });

  it("throws when only pass is set", () => {
    process.env.MNEMO_AUTH_PASS = "secret";
    expect(() => resolveAuthConfig()).toThrow();
  });

  it("only runs unauthenticated with an explicit, deliberate opt-out", () => {
    process.env.MNEMO_ALLOW_NO_AUTH = "true";
    expect(resolveAuthConfig()).toBeNull();
  });

  it("does not treat any other value as an opt-out", () => {
    process.env.MNEMO_ALLOW_NO_AUTH = "1";
    expect(() => resolveAuthConfig()).toThrow();
  });
});
