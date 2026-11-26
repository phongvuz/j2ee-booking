const { test } = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./load-ts.cjs");

process.env.SESSION_SECRET = "seat-test-secret-".repeat(4);
const seatSession = load("lib/seat-session.ts");
const sessionToken = seatSession.createSeatSessionToken();
const sessionId = seatSession.verifySeatSessionToken(sessionToken);
const cookie = `${seatSession.SEAT_SESSION_COOKIE}=${sessionToken}`;
const owner = (clientId) => seatSession.deriveSeatOwner(sessionId, clientId);
const realtimeModule = load("lib/sse.ts");
const realtime = {
  ...realtimeModule,
  applySeatInteraction: (event, ownerKey = owner(event.clientId)) => realtimeModule.applySeatInteraction(event, ownerKey),
  synchronizeClientSeats: (tripId, clientId, seats, ownerKey = owner(clientId)) => realtimeModule.synchronizeClientSeats(tripId, clientId, seats, ownerKey),
};
const schemas = load("lib/validations/seat-realtime.ts");
let nextTripId = 1000000;

function connect(tripId, clientId) {
  let controller;
  let isClosed = false;
  const stream = new ReadableStream({
    start(streamController) {
      controller = streamController;
    },
  });
  function cleanup() {
    if (isClosed) return;
    isClosed = true;
    realtime.removeClient(tripId, controller);
    controller.close();
  }
  realtime.addClient(tripId, controller, { clientId, ownerKey: clientId ? owner(clientId) : undefined, cleanup });
  return { reader: stream.getReader(), cleanup };
}

function event(tripId, clientId, seatNumber, type = "SEAT_SELECTED") {
  return { tripId, clientId, seatNumber, type, timestamp: new Date().toISOString() };
}

async function readMessage(connection) {
  const result = await connection.reader.read();
  return JSON.parse(new TextDecoder().decode(result.value).slice(6).trim());
}

async function readEvent(connection) {
  let message = await readMessage(connection);
  while (message.type === "VIEWERS_UPDATED") message = await readMessage(connection);
  return message;
}

test("realtime input rejects malformed events, extra personal fields and duplicate seats", () => {
  const input = { tripId: 1, clientId: "client-one", seatNumber: "A01", type: "SEAT_SELECTED" };
  assert.equal(schemas.seatInteractionRequestSchema.safeParse(input).success, true);
  for (const invalid of [
    { ...input, tripId: "1" }, { ...input, seatNumber: "A00X" },
    { ...input, type: "BOOKED" }, { ...input, clientId: "" },
    { ...input, passengerPhone: "0901234567" },
  ]) assert.equal(schemas.seatInteractionRequestSchema.safeParse(invalid).success, false);
  assert.equal(schemas.seatSyncRequestSchema.safeParse({ tripId: 1, clientId: "one", selectedSeats: ["A01", "A01"] }).success, false);
});

test("broadcast isolates trips and prevents selecting or releasing another client's seat", async () => {
  const tripId = nextTripId++;
  const first = connect(tripId, "first");
  const second = connect(tripId, "second");
  const other = connect(tripId + 1, "other");
  try {
    realtime.applySeatInteraction(event(tripId, "first", "A01"));
    assert.equal((await readEvent(second)).type, "SEAT_SELECTED");
    realtime.applySeatInteraction(event(tripId, "first", "A01"));
    assert.throws(() => realtime.applySeatInteraction(event(tripId, "second", "A01")), { status: 409 });
    assert.throws(() => realtime.synchronizeClientSeats(tripId, "second", ["A01"]), { status: 409 });
    realtime.applySeatInteraction(event(tripId, "second", "A01", "SEAT_DESELECTED"));
    assert.deepEqual(realtime.getSeatSnapshot(tripId).selections, [{ clientId: "first", seatNumber: "A01" }]);
    realtime.applySeatInteraction(event(tripId, "first", "A01", "SEAT_DESELECTED"));
    assert.equal((await readEvent(second)).type, "SEAT_DESELECTED");
    assert.deepEqual(realtime.getSeatSnapshot(tripId).selections, []);
    realtime.applySeatInteraction(event(tripId, "second", "A01"));
    assert.equal((await readEvent(second)).clientId, "second");
    assert.deepEqual(realtime.getSeatSnapshot(tripId + 1).selections, []);
    // Marker ở chuyến khác phải là message đầu tiên; nếu bị phát nhầm sẽ thất bại.
    realtime.broadcast(tripId + 1, event(tripId + 1, "other", "B01"));
    assert.equal((await readEvent(other)).seatNumber, "B01");
    assert.throws(() => realtime.broadcast(tripId, event(tripId + 1, "other", "B01")), { status: 400 });
  } finally {
    first.cleanup();
    second.cleanup();
    other.cleanup();
  }
});

test("viewer count is unique per client, includes initial snapshot and stays within its trip", async () => {
  const tripId = nextTripId++;
  const first = connect(tripId, "first");
  const duplicate = connect(tripId, "first");
  const second = connect(tripId, "second");
  const other = connect(tripId + 1, "other");
  const observer = connect(tripId, undefined);
  try {
    assert.equal(realtime.getViewerCount(tripId), 2);
    assert.equal(realtime.getSeatSnapshot(tripId).viewerCount, 2);
    assert.equal(realtime.getViewerCount(tripId + 1), 1);
    realtime.broadcastViewerCount(tripId);
    assert.equal((await readMessage(second)).viewerCount, 2);
    duplicate.cleanup();
    assert.equal(realtime.getViewerCount(tripId), 2);
    first.cleanup();
    const update = await readMessage(second);
    assert.equal(update.type, "VIEWERS_UPDATED");
    assert.equal(update.viewerCount, 1);
    // Chuyến khác không nhận update của chuyến này.
    realtime.broadcastViewerCount(tripId + 1);
    const otherUpdate = await readMessage(other);
    assert.equal(otherUpdate.tripId, tripId + 1);
    assert.equal(otherUpdate.viewerCount, 1);
  } finally {
    first.cleanup();
    duplicate.cleanup();
    second.cleanup();
    other.cleanup();
    observer.cleanup();
  }
  assert.equal(realtime.getViewerCount(tripId), 0);
});

test("disconnect releases interaction only after the last connection and sync replaces stale seats", async () => {
  const tripId = nextTripId++;
  const first = connect(tripId, "first");
  const duplicate = connect(tripId, "first");
  const viewer = connect(tripId, "viewer");
  try {
    realtime.synchronizeClientSeats(tripId, "first", ["A01", "B01"]);
    await readEvent(viewer);
    await readEvent(viewer);
    first.cleanup();
    assert.equal(realtime.getSeatSnapshot(tripId).selections.length, 2);
    realtime.synchronizeClientSeats(tripId, "first", ["B01"]);
    assert.equal((await readEvent(viewer)).type, "SEAT_DESELECTED");
    duplicate.cleanup();
    assert.equal((await readEvent(viewer)).seatNumber, "B01");
    assert.deepEqual(realtime.getSeatSnapshot(tripId).selections, []);
    assert.throws(() => realtime.applySeatInteraction(event(tripId, "first", "A01")), { status: 409 });
  } finally {
    first.cleanup();
    duplicate.cleanup();
    viewer.cleanup();
  }
  assert.equal(globalThis.seatRealtimeStore.trips.has(tripId), false);
});

test("failed writes clean their connection and server limits each client to five seats", async () => {
  const tripId = nextTripId++;
  const connection = connect(tripId, "one");
  try {
    for (const seatNumber of ["A01", "B01", "C01", "A02", "B02"]) {
      realtime.applySeatInteraction(event(tripId, "one", seatNumber));
    }
    assert.throws(() => realtime.applySeatInteraction(event(tripId, "one", "C02")), { status: 409 });
  } finally {
    connection.cleanup();
  }
  let cleanupCount = 0;
  const brokenController = { enqueue() { throw new Error("closed"); } };
  realtime.addClient(tripId, brokenController, {
    clientId: "broken",
    ownerKey: owner("broken"),
    cleanup() {
      cleanupCount += 1;
      realtime.removeClient(tripId, brokenController);
    },
  });
  const viewer = connect(tripId, "viewer");
  realtime.applySeatInteraction(event(tripId, "broken", "A01"));
  assert.equal(cleanupCount, 1);
  assert.equal((await readEvent(viewer)).type, "SEAT_SELECTED");
  assert.equal((await readEvent(viewer)).type, "SEAT_DESELECTED");
  assert.deepEqual(realtime.getSeatSnapshot(tripId).selections, []);
  viewer.cleanup();
  assert.equal(globalThis.seatRealtimeStore.trips.has(tripId), false);
});

const apiHelpers = {
  readJson: async (request) => {
    try { return await request.json(); }
    catch { throw Object.assign(new Error("Invalid JSON"), { status: 400 }); }
  },
  apiError: (error) => Response.json({ success: false, message: error.message }, { status: error.status ?? 500 }),
};
const context = (tripId) => ({ params: Promise.resolve({ id: String(tripId) }) });

test("HTTP rejects mismatched trips, unknown seats, booked seats and missing connections", async () => {
  const tripId = nextTripId++;
  const route = load("app/api/trips/[id]/seat-events/route.ts", {
    "@/lib/admin-api": apiHelpers,
    "@/lib/prisma": { prisma: {
      trip: { findUnique: async ({ where }) => where.id === tripId ? { bus: { capacity: 6 }, time: new Date(Date.now() + 86400000) } : null },
      booking: { findFirst: async ({ where }) => where.seatNumber.in.includes("B01") ? { seatNumber: "B01" } : null },
    } },
  });
  const connection = connect(tripId, "one");
  async function post(body) {
    return route.POST(new Request("http://localhost/api/trips/" + tripId + "/seat-events", {
      method: "POST", body: JSON.stringify(body),
      headers: { cookie },
    }), context(tripId));
  }
  const input = { tripId, clientId: "one", seatNumber: "A01", type: "SEAT_SELECTED" };
  try {
    assert.equal((await post({ ...input, tripId: tripId + 1 })).status, 400);
    assert.equal((await post({ ...input, seatNumber: "C99" })).status, 400);
    assert.equal((await post({ ...input, seatNumber: "B01" })).status, 409);
    assert.equal((await post({ ...input, clientId: "disconnected" })).status, 409);
    assert.equal((await post(input)).status, 200);
    assert.equal((await post({ ...input, type: "SEAT_DESELECTED" })).status, 200);
  } finally {
    connection.cleanup();
  }
});

test("stream sends an immediate snapshot and cancel/abort clear heartbeat exactly once", async (testContext) => {
  const tripId = nextTripId++;
  const timers = new Set();
  const originalSetInterval = globalThis.setInterval;
  const originalClearInterval = globalThis.clearInterval;
  testContext.mock.method(globalThis, "setInterval", (...argumentsList) => {
    const timer = originalSetInterval(...argumentsList);
    timers.add(timer);
    return timer;
  });
  testContext.mock.method(globalThis, "clearInterval", (timer) => {
    timers.delete(timer);
    return originalClearInterval(timer);
  });
  const route = load("app/api/trips/[id]/stream/route.ts", {
    "@/lib/admin-api": apiHelpers,
    "@/lib/prisma": { prisma: { trip: { findUnique: async () => ({ id: tripId, booking: [] }) } } },
  });
  const abortController = new AbortController();
  const response = await route.GET(new Request("http://localhost/api/trips/" + tripId + "/stream?clientId=one", {
    signal: abortController.signal,
  }), context(tripId));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/event-stream/);
  const reader = response.body.getReader();
  const snapshot = JSON.parse(new TextDecoder().decode((await reader.read()).value).slice(6).trim());
  assert.equal(snapshot.type, "SEAT_SNAPSHOT");
  assert.deepEqual(snapshot.bookedSeats, []);
  assert.match(response.headers.get("set-cookie"), /HttpOnly/);
  assert.equal(timers.size, 1);
  await reader.cancel();
  abortController.abort();
  assert.equal(timers.size, 0);
  assert.equal(globalThis.seatRealtimeStore.trips.has(tripId), false);
});

test("seat session rejects forged and expired cookies and isolates identical public tab IDs", () => {
  const token = seatSession.createSeatSessionToken(1000);
  assert.ok(seatSession.verifySeatSessionToken(token, 1001));
  assert.equal(seatSession.verifySeatSessionToken(token, 1000 + 86400000), null);
  const forged = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;
  assert.equal(seatSession.verifySeatSessionToken(forged, 1001), null);
  const otherSession = seatSession.verifySeatSessionToken(seatSession.createSeatSessionToken());
  assert.notEqual(owner("same-tab"), seatSession.deriveSeatOwner(otherSession, "same-tab"));
});

test("knowing a public client ID cannot take over its stream or deselect its seats", () => {
  const tripId = nextTripId++;
  const connection = connect(tripId, "victim");
  try {
    realtime.applySeatInteraction(event(tripId, "victim", "A01"));
    assert.throws(() => realtimeModule.applySeatInteraction(event(tripId, "victim", "A01", "SEAT_DESELECTED"), "attacker-owner"), { status: 409 });
    assert.throws(() => realtimeModule.synchronizeClientSeats(tripId, "victim", [], "attacker-owner"), { status: 409 });
    assert.throws(() => realtimeModule.addClient(tripId, {}, { clientId: "victim", ownerKey: "attacker-owner", cleanup() {} }), { status: 409 });
    assert.deepEqual(realtime.getSeatSnapshot(tripId).selections, [{ clientId: "victim", seatNumber: "A01" }]);
    assert.equal(JSON.stringify(realtime.getSeatSnapshot(tripId)).includes(owner("victim")), false);
  } finally { connection.cleanup(); }
});

test("HTTP rejects a second browser claiming the victim's public ID", async () => {
  const tripId = nextTripId++;
  const connection = connect(tripId, "victim");
  const route = load("app/api/trips/[id]/seat-events/route.ts", {
    "@/lib/admin-api": apiHelpers,
    "@/lib/prisma": { prisma: { trip: { findUnique: async () => ({ bus: { capacity: 6 }, time: new Date(Date.now() + 86400000) }) }, booking: { findFirst: async () => null } } },
  });
  const attackerCookie = `${seatSession.SEAT_SESSION_COOKIE}=${seatSession.createSeatSessionToken()}`;
  const body = JSON.stringify({ tripId, clientId: "victim", seatNumber: "A01", type: "SEAT_DESELECTED" });
  try {
    realtime.applySeatInteraction(event(tripId, "victim", "A01"));
    for (const headers of [{ cookie: attackerCookie }, {}, { cookie, origin: "https://attacker.example" }]) {
      const response = await route.POST(new Request(`http://localhost/api/trips/${tripId}/seat-events`, { method: "POST", headers, body }), context(tripId));
      assert.ok([403, 409].includes(response.status));
    }
    assert.equal(realtime.getSeatSnapshot(tripId).selections.length, 1);
  } finally { connection.cleanup(); }
});

test("hold mutations derive private ownership and public snapshots never expose it", async () => {
  const tripId = nextTripId++;
  const calls = [];
  const route = load("app/api/seats/hold/route.ts", {
    "@/lib/admin-api": apiHelpers,
    "@/lib/sse": { broadcastSeatRefresh() {} },
    "@/services/seatService": { holdSeat: async (...args) => calls.push(args), releaseSeat: async (...args) => calls.push(args) },
  });
  const publicClientId = "victim";
  const attackerCookie = `${seatSession.SEAT_SESSION_COOKIE}=${seatSession.createSeatSessionToken()}`;
  for (const browserCookie of [cookie, attackerCookie]) {
    const response = await route.POST(new Request("http://localhost/api/seats/hold", { method: "POST", headers: { cookie: browserCookie }, body: JSON.stringify({ tripId, clientId: publicClientId, seatNumber: "A01", action: "release" }) }));
    assert.equal(response.status, 200);
  }
  assert.notEqual(calls[0][2], publicClientId);
  assert.notEqual(calls[0][2], calls[1][2]);
  const { getActiveSeatHolds } = load("services/seatService.ts", { "@/lib/prisma": { prisma: { seatHold: { findMany: async () => [{ seatNumber: "A01", clientId: calls[0][2] }] } } } });
  assert.deepEqual(await getActiveSeatHolds(tripId, calls[1][2]), [{ seatNumber: "A01", isOwn: false }]);
  assert.deepEqual(await getActiveSeatHolds(tripId, calls[0][2]), [{ seatNumber: "A01", isOwn: true }]);
});

test("reconnect removes sold, foreign-held and removed seats, and cancellation frees the map", () => {
  const { availableSeatSelection } = load("lib/seat-selection.ts");
  const state = { capacity: 6, bookedSeats: ["A01"], holds: [{ seatNumber: "B01", isOwn: false }], selections: [{ seatNumber: "C01", clientId: "other" }] };
  assert.deepEqual(availableSeatSelection(["A01", "B01", "C01", "A02", "C99"], state, "mine"), ["A02"]);
  const cancelled = { ...state, bookedSeats: [] };
  assert.deepEqual(availableSeatSelection(["A01", "A02"], cancelled, "mine"), ["A01", "A02"]);
});
