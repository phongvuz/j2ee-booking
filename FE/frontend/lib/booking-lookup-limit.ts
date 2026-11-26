import { createHash } from "node:crypto";

interface LookupLimitOptions {
  phoneLimit?: number;
  sourceLimit?: number;
  windowMs?: number;
  maxEntries?: number;
}

interface Counter {
  count: number;
  resetAt: number;
}

function key(kind: string, value: string) {
  return createHash("sha256").update(`${kind}:${value}`).digest("hex");
}

// Forwarded headers must be set by the deployment proxy. The phone limit also
// applies when a caller changes source addresses or no proxy address is present.
export function bookingLookupSource(request: Request) {
  return (request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() || "unknown").slice(0, 256);
}

export function createBookingLookupLimiter({
  phoneLimit = 20, sourceLimit = 60, windowMs = 60_000, maxEntries = 4096,
}: LookupLimitOptions = {}) {
  if (![phoneLimit, sourceLimit, windowMs, maxEntries].every((value) => Number.isSafeInteger(value) && value > 0) || maxEntries < 2) {
    throw new Error("Invalid booking lookup limits");
  }
  const counters = new Map<string, Counter>();

  return (phone: string, source: string, now = Date.now()) => {
    for (const [counterKey, counter] of counters) {
      if (counter.resetAt <= now) counters.delete(counterKey);
    }

    const limits = [
      { key: key("phone", phone.trim().replace(/^\+84/, "0")), limit: phoneLimit },
      { key: key("source", source), limit: sourceLimit },
    ];
    let retryAfter = 0;
    for (const limit of limits) {
      const counter = counters.get(limit.key);
      if (counter && counter.count >= limit.limit) {
        retryAfter = Math.max(retryAfter, Math.ceil((counter.resetAt - now) / 1000));
      }
    }
    if (retryAfter) return { allowed: false, retryAfter };

    const newEntries = limits.filter((limit) => !counters.has(limit.key)).length;
    if (counters.size + newEntries > maxEntries) {
      // Preserve live counters so flooding new identities cannot reset a limit.
      let nextReset = now + windowMs;
      for (const counter of counters.values()) nextReset = Math.min(nextReset, counter.resetAt);
      return { allowed: false, retryAfter: Math.max(1, Math.ceil((nextReset - now) / 1000)) };
    }

    for (const limit of limits) {
      const counter = counters.get(limit.key);
      if (counter) counter.count++;
      else counters.set(limit.key, { count: 1, resetAt: now + windowMs });
    }
    return { allowed: true, retryAfter: 0 };
  };
}

// One bounded store per Node process; deployments with multiple workers need a shared store.
export const checkBookingLookupLimit = createBookingLookupLimiter();
