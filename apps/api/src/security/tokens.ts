import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../env.js";
import type { AuthUser } from "../types.js";

type SessionPayload = AuthUser & {
  expiresAt: number;
};

const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");

const sign = (payload: string) => createHmac("sha256", env.API_SECRET).update(payload).digest("base64url");

export function createSessionToken(user: AuthUser, expiresAt = Date.now() + env.SESSION_TTL_SECONDS * 1000) {
  const payload = encode({
    ...user,
    expiresAt
  });

  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token?: string): SessionPayload | null {
  if (!token) return null;

  const [payload, signature] = token.replace(/^Bearer\s+/i, "").split(".");
  if (!payload || !signature) return null;

  const actual = Buffer.from(sign(payload));
  const expected = Buffer.from(signature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionPayload;
    return session.expiresAt > Date.now() ? session : null;
  } catch {
    return null;
  }
}
