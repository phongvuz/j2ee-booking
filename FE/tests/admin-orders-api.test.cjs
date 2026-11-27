const { test } = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./load-ts.cjs");

const context = (id) => ({ params: Promise.resolve({ id }) });
const admin = { id: 1, role: "ADMIN", isActive: true };

function setup({ account = admin, missing = false, conflict = false } = {}) {
  const calls = [];
  const cache = new Map();
  const { BusinessError } = load("lib/business-error.ts", {}, cache);
  const route = load("app/api/admin/orders/[id]/route.ts", {
    "@/lib/session": { getCurrentUser: async () => account },
    "@/services/orderService": {
      getOrderById: async (id) => { calls.push(["get", id]); return missing ? null : { id }; },
      updateOrderStatus: async (id, status) => {
        calls.push(["update", id, status]);
        if (conflict) throw new BusinessError("Ghế đã được đặt.", 409);
        return missing ? null : { id, status };
      },
      deleteOrder: async (id) => { calls.push(["delete", id]); return !missing; },
    },
  }, cache);
  return { route, calls };
}

function request(method, payload, headers = {}) {
  return new Request("http://localhost/api/admin/orders/42", {
    method, headers,
    ...(payload === undefined ? {} : { body: typeof payload === "string" ? payload : JSON.stringify(payload) }),
  });
}

test("admin can read, change status and cancel tickets through the completed endpoints", async () => {
  const { route, calls } = setup();
  const read = await route.GET(request("GET"), context("0042"));
  assert.equal(read.status, 200);
  assert.equal(read.headers.get("cache-control"), "no-store");
  assert.deepEqual((await read.json()).data, { id: 42 });
  const update = await route.PATCH(request("PATCH", { status: "CONFIRMED" }), context("42"));
  assert.equal(update.status, 200);
  assert.deepEqual((await update.json()).data, { id: 42, status: "CONFIRMED" });
  const cancel = await route.DELETE(request("DELETE"), context("42"));
  assert.equal(cancel.status, 200);
  assert.equal((await cancel.json()).success, true);
  assert.deepEqual(calls, [["get", 42], ["update", 42, "CONFIRMED"], ["delete", 42]]);
});

test("order endpoints reject unauthenticated, customer and cross-origin mutations before accessing orders", async () => {
  for (const [account, expected] of [[null, 401], [{ id: 2, role: "CUSTOMER" }, 403]]) {
    const { route, calls } = setup({ account });
    for (const method of ["GET", "PATCH", "DELETE"]) {
      assert.equal((await route[method](request(method, method === "PATCH" ? { status: "CANCELLED" } : undefined), context("42"))).status, expected);
    }
    assert.deepEqual(calls, []);
  }
  const { route, calls } = setup();
  for (const method of ["PATCH", "DELETE"]) {
    assert.equal((await route[method](request(method, method === "PATCH" ? { status: "CANCELLED" } : undefined, { origin: "https://elsewhere.test" }), context("42"))).status, 403);
  }
  assert.deepEqual(calls, []);
});

test("invalid order IDs, JSON and statuses never reach the service", async () => {
  const { route, calls } = setup();
  for (const id of ["", "0", "-1", "1.5", "1e2", " 42", "2147483648", "NaN"]) {
    for (const method of ["GET", "PATCH", "DELETE"]) {
      assert.equal((await route[method](request(method, method === "PATCH" ? { status: "PENDING" } : undefined), context(id))).status, 400);
    }
  }
  for (const payload of ["{", {}, { status: "PAID" }, { status: 1 }]) {
    assert.equal((await route.PATCH(request("PATCH", payload), context("42"))).status, 400);
  }
  assert.deepEqual(calls, []);
});

test("missing orders return 404 and business conflicts remain 409", async () => {
  const { route } = setup({ missing: true });
  for (const method of ["GET", "PATCH", "DELETE"]) {
    assert.equal((await route[method](request(method, method === "PATCH" ? { status: "CANCELLED" } : undefined), context("42"))).status, 404);
  }
  const conflict = setup({ conflict: true });
  const response = await conflict.route.PATCH(request("PATCH", { status: "PENDING" }), context("42"));
  assert.equal(response.status, 409);
  assert.match((await response.json()).message, /Ghế/);
});

test("cancel and restore return seats once, preserve history and notify viewers after commit", async () => {
  const row = { id: 42, tripId: 7, status: "PENDING", seatNumber: "A01", confirmedAt: null, totalPrice: 100000, transactions: [],
    trip: { status: "OPEN", bus: { capacity: 3 }, availableSeats: 2, time: new Date(Date.now() + 86400000) } };
  const events = [];
  let committed = false;
  const tx = {
    booking: {
      findUnique: async () => ({ ...row, trip: { ...row.trip } }),
      findFirst: async () => null,
      update: async ({ data }) => Object.assign(row, data),
    },
    trip: {
      update: async ({ data }) => { row.trip.availableSeats += data.availableSeats.increment; },
      updateMany: async ({ data }) => { row.trip.availableSeats -= data.availableSeats.decrement; return { count: 1 }; },
    },
    seatHold: { findFirst: async () => null },
    bookingTransaction: { create: async ({ data }) => { row.transactions.push(data); return data; } },
  };
  const service = load("services/orderService.ts", {
    "@/lib/prisma": { prisma: tx },
    "@/lib/transaction": { runTransaction: async (work) => { committed = false; const value = await work(tx); committed = true; return value; } },
    "@/lib/record-mappers": { toOrderItem: (value) => value },
    "@/lib/sse": { broadcastSeatRefresh: (tripId) => { assert.equal(committed, true); events.push(tripId); } },
  });
  assert.equal(await service.deleteOrder(42), true);
  assert.equal(row.status, "CANCELLED");
  assert.equal(row.activeSeat, null);
  assert.equal(row.trip.availableSeats, 3);
  await service.deleteOrder(42);
  assert.equal(row.trip.availableSeats, 3);
  await service.updateOrderStatus(42, "PENDING");
  assert.equal(row.activeSeat, "7:A01");
  assert.equal(row.trip.availableSeats, 2);
  await service.updateOrderStatus(42, "CONFIRMED", 1);
  const confirmedAt = row.confirmedAt;
  await service.updateOrderStatus(42, "CONFIRMED", 1);
  assert.equal(row.confirmedAt, confirmedAt);
  await assert.rejects(service.updateOrderStatus(42, "PENDING"), { status: 409 });
  assert.equal(row.transactions.length, 1);
  assert.deepEqual(events, [7, 7]);
});
