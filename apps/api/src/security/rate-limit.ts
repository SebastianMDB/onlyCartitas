import { ApiError } from "../http.js";

type Hit = {
  count: number;
  resetAt: number;
};

const hits = new Map<string, Hit>();

type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
};

export function assertRateLimit({ key, limit, windowMs }: RateLimitOptions) {
  const now = Date.now();
  const hit = hits.get(key);

  if (!hit || hit.resetAt <= now) {
    hits.set(key, {
      count: 1,
      resetAt: now + windowMs
    });
    return;
  }

  hit.count += 1;
  if (hit.count > limit) {
    throw new ApiError(429, "Demasiados intentos. Intenta nuevamente mas tarde.");
  }
}
