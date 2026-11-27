const { test } = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./load-ts.cjs");
process.env.SESSION_SECRET = "trip-id-seat-secret-".repeat(3);
const seatSession = load("lib/seat-session.ts");
const seatCookie = `${seatSession.SEAT_SESSION_COOKIE}=${seatSession.createSeatSessionToken()}`;

const apiHelpers = {
  requireAdmin: async () => ({ id: 1 }),
  readJson: (request) => request.json(),
  apiError: (error) => Response.json({ success: false, message: error.message }, { status: error.status ?? 500 }),
};
const context = (id) => ({ params: Promise.resolve({ id }) });

test("trip IDs require numeric positive database integers; URLs parse decimal digits", () => {
  const { tripIdSchema, parseTripId } = load("lib/trip-id.ts");
  for (const id of [1, 42, 2147483647]) assert.equal(tripIdSchema.parse(id), id);
  for (const id of ["42", "SG-DL-01", true, null, undefined, 0, -1, 1.5, NaN, Infinity, 2147483648]) {
    assert.equal(tripIdSchema.safeParse(id).success, false);
  }
  assert.equal(parseTripId("42"), 42);
  assert.equal(parseTripId("0042"), 42);
  for (const id of ["", "SG-DL-01", "0", "-1", "1.5", "1e2", "0x2a", "+42", " 42", "2147483648"]) {
    assert.throws(() => parseTripId(id), { status: 400 });
  }
});

test("online and offline bookings reject string IDs and trip forms have no code field", () => {
  const { onlineOrderSchema, offlineOrderSchema } = load("lib/validations/order.ts");
  const input = { tripId: 42, seats: ["A01"], fullName: "Khách hàng", phone: "0901234567" };
  for (const schema of [onlineOrderSchema, offlineOrderSchema]) {
    assert.equal(schema.parse(input).tripId, 42);
    for (const tripId of ["42", "SG-DL-01", true, 0, -1, 1.5, 2147483648]) {
      assert.equal(schema.safeParse({ ...input, tripId }).success, false);
    }
  }
  const { tripSchema } = load("lib/validations/trip.ts");
  const trip = tripSchema.parse({ code: "OLD-CODE", from: "Sài Gòn", to: "Đà Lạt", time: "2026-12-02T08:00", price: 300000, busId: "BUS-001" });
  assert.equal("code" in trip, false);
});

test("trip detail, update and delete APIs pass numeric IDs and reject codes", async () => {
  const calls = [];
  const routes = load("app/api/trips/[id]/route.ts", {
    "@/lib/admin-api": apiHelpers,
    "@/services/tripService": Object.fromEntries(["getTripById", "updateTrip", "deleteTrip"].map((name) => [name, async (id) => {
      calls.push({ name, id });
      return id === 42 ? { id } : null;
    }])),
  });
  const trip = { from: "Sài Gòn", to: "Đà Lạt", time: "2026-12-02T08:00", price: 300000, busId: "BUS-001" };
  for (const method of ["GET", "PUT", "DELETE"]) {
    const request = () => new Request("http://localhost/api/trips/42", { method, ...(method === "PUT" ? { body: JSON.stringify(trip) } : {}) });
    assert.equal((await routes[method](request(), context("0042"))).status, 200);
    for (const id of ["OLD-CODE", "1.5", "0", "2147483648"]) {
      assert.equal((await routes[method](request(), context(id))).status, 400);
    }
  }
  assert.deepEqual(calls.map((call) => call.id), [42, 42, 42]);
  assert.equal((await routes.GET(new Request("http://localhost/api/trips/99"), context("99"))).status, 404);
});

test("booking API rejects legacy codes before creating bookings", async () => {
  const calls = [];
  const route = load("app/api/bookings/route.ts", {
    "@/lib/admin-api": apiHelpers,
    "@/lib/session": { getCurrentCustomer: async () => null },
    "@/services/bookingService": { createBooking: async (input) => { calls.push(input); return { tripId: input.tripId, pnr: "NHAXE-42-TEST" }; } },
  });
  const input = { seats: ["A01"], fullName: "Khách hàng", phone: "0901234567" };
  for (const tripId of ["42", "OLD-CODE", 0, 1.5, 42]) {
    const response = await route.POST(new Request("http://localhost/api/bookings", { method: "POST", body: JSON.stringify({ ...input, tripId }) }));
    assert.equal(response.status, tripId === 42 ? 201 : 400);
  }
  assert.equal(calls.length, 1);
  assert.equal(calls[0].tripId, 42);
});

test("seat hold API broadcasts numeric IDs and rejects string IDs", async () => {
  const calls = [];
  const route = load("app/api/seats/hold/route.ts", {
    "@/lib/admin-api": apiHelpers,
    "@/services/seatService": { holdSeat: async (id) => calls.push(id), releaseSeat: async (id) => calls.push(id) },
    "@/lib/sse": { broadcastSeatRefresh: (id) => calls.push(id) },
  });
  for (const tripId of ["42", "OLD-CODE", 42]) {
    const response = await route.POST(new Request("http://localhost/api/seats/hold", { method: "POST", headers: { cookie: seatCookie }, body: JSON.stringify({ tripId, seatNumber: "A01", clientId: "client-one", action: "hold" }) }));
    assert.equal(response.status, tripId === 42 ? 200 : 400);
  }
  assert.deepEqual(calls, [42, 42]);
});

test("seat hold URLs validate before querying and streams use the canonical numeric ID", async () => {
  const calls = [];
  const holds = load("app/api/trips/[id]/holds/route.ts", {
    "@/lib/admin-api": apiHelpers,
    "@/services/seatService": { getActiveSeatHolds: async (id) => { calls.push(id); return []; } },
    "@/lib/prisma": { prisma: { trip: { findUnique: async () => ({ bus: { capacity: 6 }, booking: [] }) } } },
  });
  assert.equal((await holds.GET(new Request("http://localhost"), context("OLD-CODE"))).status, 400);
  assert.equal((await holds.GET(new Request("http://localhost"), context("0042"))).status, 200);
  const stream = load("app/api/trips/[id]/stream/route.ts", {
    "@/lib/admin-api": apiHelpers,
    "@/lib/prisma": { prisma: { trip: { findUnique: async ({ where }) => ({ id: where.id, booking: [] }) } } },
    "@/lib/sse": {
      addClient: (id) => calls.push(id),
      removeClient: (id) => calls.push(id),
      getSeatSnapshot: (id) => ({ type: "SEAT_SNAPSHOT", tripId: id, selections: [], bookedSeats: [], viewerCount: 0, timestamp: new Date().toISOString() }),
      broadcastViewerCount: () => {},
      encodeRealtimeMessage: (message) => new TextEncoder().encode(JSON.stringify(message)),
    },
  });
  assert.equal((await stream.GET(new Request("http://localhost"), context("OLD-CODE"))).status, 400);
  const abort = new AbortController();
  const response = await stream.GET(new Request("http://localhost", { signal: abort.signal }), context("0042"));
  assert.equal(response.status, 200);
  abort.abort();
  assert.deepEqual(calls, [42, 42, 42]);
});

test("order trip filter is parsed at the API boundary and rejects invalid IDs", async () => {
  const calls = [];
  const route = load("app/api/admin/orders/route.ts", {
    "@/lib/admin-api": apiHelpers,
    "@/services/bookingService": {},
    "@/services/orderService": { queryOrdersAdmin: async (params) => { calls.push(params.tripId); return { data: [] }; } },
  });
  for (const query of ["", "?tripId=42", "?tripId=OLD-CODE", "?tripId=", "?tripId=1.5"]) {
    const response = await route.GET(new Request(`http://localhost/api/admin/orders${query}`));
    assert.equal(response.status, query === "" || query === "?tripId=42" ? 200 : 400);
  }
  assert.deepEqual(calls, [undefined, 42]);
});
