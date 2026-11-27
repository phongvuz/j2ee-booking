const { test } = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./load-ts.cjs");
const { getDepartureDayRange, formatDepartureDate } = load("lib/trip-search.ts");

test("search options use database locations and Vietnamese departure dates", async () => {
  let query;
  const trips = [
    { from: "Hồ Chí Minh", to: "Huế", time: new Date("2026-10-01T21:00:00Z") },
    { from: "Huế", to: "Hồ Chí Minh", time: new Date("2026-10-02T18:00:00Z") },
  ];
  const prisma = { trip: { findMany: async (value) => { query = value; return trips; } } };
  const { getTripSearchOptions } = load("services/tripService.ts", { "@/lib/prisma": { prisma } });
  assert.deepEqual(await getTripSearchOptions(), [
    { from: "Hồ Chí Minh", to: "Huế", date: "2026-10-02" },
    { from: "Huế", to: "Hồ Chí Minh", date: "2026-10-03" },
  ]);
  assert.deepEqual(query.select, { from: true, to: true, time: true });
  assert.ok(query.where.time.gt instanceof Date);
  assert.deepEqual(query.where.availableSeats, { gt: 0 });
});

test("search applies both cities and the full Vietnam day regardless of server timezone", async () => {
  const trips = [
    { id: 1, from: "Hồ Chí Minh", to: "Huế", time: new Date("2099-10-01T16:59:59Z") },
    { id: 2, from: "Hồ Chí Minh", to: "Huế", time: new Date("2099-10-01T17:00:00Z") },
    { id: 3, from: "Hồ Chí Minh", to: "Huế", time: new Date("2099-10-02T16:59:59Z") },
    { id: 4, from: "Hồ Chí Minh", to: "Huế", time: new Date("2099-10-02T17:00:00Z") },
    { id: 5, from: "Hà Nội", to: "Huế", time: new Date("2099-10-02T08:00:00Z") },
    { id: 6, from: "Hồ Chí Minh", to: "Đà Lạt", time: new Date("2099-10-02T08:00:00Z") },
  ].map((trip) => ({ ...trip, busId: "BUS-SEARCH", bus: { id: "BUS-SEARCH", capacity: 22, type: "Limousine" }, availableSeats: 1 }));
  const prisma = { trip: { findMany: async ({ where }) => trips.filter((trip) =>
    trip.from.includes(where.from.contains) && trip.to.includes(where.to.contains) &&
    trip.time >= where.time.gte && trip.time < where.time.lt &&
    trip.time > where.time.gt && trip.availableSeats > where.availableSeats.gt
  ) } };
  const { getTrips } = load("services/tripService.ts", { "@/lib/prisma": { prisma } });
  const originalTimezone = process.env.TZ;
  try {
    for (const timezone of ["UTC", "Asia/Ho_Chi_Minh", "America/Los_Angeles"]) {
      process.env.TZ = timezone;
      const results = await getTrips({ fromCity: "Hồ Chí Minh", toCity: "Huế", date: "2099-10-02" });
      assert.deepEqual(results.map((trip) => trip.id), [2, 3]);
    }
  } finally {
    if (originalTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimezone;
  }
});

test("departure day parsing rejects invalid dates and supports leap years", () => {
  for (const date of ["", "2026-02-30", "2026-13-01", "02/10/2026"]) {
    assert.equal(getDepartureDayRange(date), null);
  }
  const leapDay = getDepartureDayRange("2028-02-29");
  assert.equal(leapDay.gte.toISOString(), "2028-02-28T17:00:00.000Z");
  assert.equal(leapDay.lt.toISOString(), "2028-02-29T17:00:00.000Z");
  assert.equal(formatDepartureDate("2026-10-01T21:00:00Z"), "2026-10-02");
});
