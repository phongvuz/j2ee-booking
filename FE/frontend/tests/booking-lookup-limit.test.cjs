const { test } = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./load-ts.cjs");

const { createBookingLookupLimiter, bookingLookupSource } = load("lib/booking-lookup-limit.ts");

test("lookup limits each phone across sources and resets at the fixed window boundary", () => {
  const check = createBookingLookupLimiter({ phoneLimit: 2, sourceLimit: 10, windowMs: 60_000 });
  assert.equal(check("0901234567", "source-a", 1000).allowed, true);
  assert.equal(check("+84901234567", "source-b", 2000).allowed, true);
  assert.deepEqual(check("0901234567", "source-c", 3000), { allowed: false, retryAfter: 58 });
  assert.deepEqual(check("0901234567", "source-a", 61_000), { allowed: true, retryAfter: 0 });
});

test("source limit applies across target phones without affecting other sources", () => {
  const check = createBookingLookupLimiter({ phoneLimit: 10, sourceLimit: 2 });
  assert.equal(check("0901234567", "source-a", 1000).allowed, true);
  assert.equal(check("0901234568", "source-a", 1000).allowed, true);
  assert.equal(check("0901234569", "source-a", 1000).allowed, false);
  assert.equal(check("0901234569", "source-b", 1000).allowed, true);
});

test("bounded storage rejects new identities while preserving existing limits, then prunes expired entries", () => {
  const check = createBookingLookupLimiter({ phoneLimit: 2, sourceLimit: 2, maxEntries: 2, windowMs: 1000 });
  assert.equal(check("0901234567", "source-a", 100).allowed, true);
  for (let index = 0; index < 100; index++) {
    assert.deepEqual(check(`other-phone-${index}`, `other-source-${index}`, 200), { allowed: false, retryAfter: 1 });
  }
  assert.equal(check("0901234567", "source-a", 300).allowed, true);
  assert.equal(check("0901234567", "source-a", 400).allowed, false);
  assert.equal(check("0901234568", "source-b", 1100).allowed, true);
});

test("source selection supports proxy headers and a stable fallback", () => {
  const source = (headers) => bookingLookupSource(new Request("http://localhost", { headers }));
  assert.equal(source({ "x-forwarded-for": "198.51.100.1, 10.0.0.1", "x-real-ip": "198.51.100.2" }), "198.51.100.1");
  assert.equal(source({ "x-real-ip": "198.51.100.2" }), "198.51.100.2");
  assert.equal(source({}), "unknown");
});

test("API throttles valid lookup attempts before querying bookings and ignores invalid requests", async () => {
  const check = createBookingLookupLimiter({ phoneLimit: 2, sourceLimit: 3 });
  let reads = 0;
  const cache = new Map();
  const route = load("app/api/bookings/route.ts", {
    "@/lib/booking-lookup-limit": {
      bookingLookupSource,
      checkBookingLookupLimit: (phone, source) => check(phone, source, 1000),
    },
    "@/lib/prisma": { prisma: { booking: { findMany: async () => { reads++; return []; } } } },
  }, cache);
  const get = (query, source = "198.51.100.1") => route.GET(new Request(`http://localhost/api/bookings?${query}`, {
    headers: { "x-forwarded-for": source },
  }));
  const pnr = "NHAXE-42-1234567890ABCDEF";
  for (let index = 0; index < 10; index++) {
    assert.equal((await get("phone=0901234567")).status, 400);
    assert.equal((await get(`pnr=${pnr}&phone=invalid`)).status, 400);
  }
  assert.equal(reads, 0);
  assert.equal((await get(`pnr=${pnr}&phone=0901234567`)).status, 200);
  assert.equal((await get(`pnr=${pnr}&phone=0901234567`, "198.51.100.2")).status, 200);
  const blocked = await get(`pnr=${pnr}&phone=0901234567`, "198.51.100.3");
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers.get("retry-after"), "60");
  assert.equal(blocked.headers.get("cache-control"), "no-store");
  assert.equal(reads, 2);
  assert.equal((await get(`pnr=${pnr}&phone=0901234568`)).status, 200);
  assert.equal((await get(`pnr=${pnr}&phone=0901234569`)).status, 200);
  const sourceBlocked = await get(`pnr=${pnr}&phone=0901234566`);
  assert.equal(sourceBlocked.status, 429);
  assert.equal(reads, 4);
});
