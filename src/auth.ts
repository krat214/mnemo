import { timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export interface AuthConfig {
  user: string;
  pass: string;
}

/**
 * Reads MNEMO_AUTH_USER / MNEMO_AUTH_PASS. Unlike misMEM (which fails OPEN if these
 * are unset), Mnemo fails CLOSED: the HTTP server refuses to start without explicit
 * credentials, unless the caller opts in to running unauthenticated on purpose via
 * MNEMO_ALLOW_NO_AUTH=true (e.g. for local-only development).
 */
export function resolveAuthConfig(): AuthConfig | null {
  const user = process.env.MNEMO_AUTH_USER;
  const pass = process.env.MNEMO_AUTH_PASS;
  if (user && pass) return { user, pass };

  if (process.env.MNEMO_ALLOW_NO_AUTH === "true") {
    // eslint-disable-next-line no-console
    console.warn(
      "[mnemo] WARNING: running the HTTP server with NO AUTHENTICATION (MNEMO_ALLOW_NO_AUTH=true). " +
        "Anyone who can reach this port can read and write your entire memory. Only do this on localhost."
    );
    return null;
  }

  throw new Error(
    "[mnemo] Refusing to start: MNEMO_AUTH_USER and MNEMO_AUTH_PASS are not set. " +
      "Set both, or set MNEMO_ALLOW_NO_AUTH=true if you understand the risk and are running purely on localhost."
  );
}

export function basicAuthMiddleware(config: AuthConfig | null) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!config) {
      next();
      return;
    }

    const header = req.headers.authorization ?? "";
    const [scheme, encoded] = header.split(" ");
    if (scheme !== "Basic" || !encoded) {
      res.set("WWW-Authenticate", 'Basic realm="mnemo"').status(401).json({ error: "authentication required" });
      return;
    }

    const decoded = Buffer.from(encoded, "base64").toString("utf8");
    const separatorIndex = decoded.indexOf(":");
    const user = separatorIndex === -1 ? decoded : decoded.slice(0, separatorIndex);
    const pass = separatorIndex === -1 ? "" : decoded.slice(separatorIndex + 1);

    if (safeEqual(user, config.user) && safeEqual(pass, config.pass)) {
      next();
      return;
    }

    res.set("WWW-Authenticate", 'Basic realm="mnemo"').status(401).json({ error: "invalid credentials" });
  };
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
