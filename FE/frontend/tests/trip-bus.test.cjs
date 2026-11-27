const { test } = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./load-ts.cjs");

function bus(id, capacity, status = "Đang hoạt động") {
  return { id, plate: `51B-${id === "BUS-OLD" ? "111.11" : "222.22"}`, type: "Ghế ngồi", capacity, status, createdAt: new Date() };
}

function setup({ capacity = 22, targetCapacity = capacity, bookings = [], holds = [] } = {}) {
  const oldBus = bus("BUS-OLD", capacity, "Ngừng hoạt động");
  const targetBus = bus("BUS-NEW", targetCapacity);
  const buses = new Map([[oldBus.id, oldBus], [targetBus.id, targetBus]]);
  const store = { trip: { id: 7, status: "DRAFT", driverId: null, endsAt: null, busId: oldBus.id, from: "Sài Gòn", to: "Đà Lạt", time: new Date(Date.now() + 86400000), price: 300000, availableSeats: capacity - bookings.filter(row => row.status !== "CANCELLED").length } };
  const writes = [];
  const notifications = [];
  let committed = false;
  const hydrate = () => ({ ...store.trip, bus: buses.get(store.trip.busId), booking: bookings });
  const tx = {
    bus: {
      findUnique: async ({ where }) => buses.get(where.id) ?? null,
      findFirst: async ({ where }) => [...buses.values()].find(row => where.OR.some(filter => filter.id === row.id || filter.plate === row.plate)) ?? null,
      findMany: async ({ where }) => [...buses.values()].filter(row => row.status === where.status),
      update: async ({ where, data }) => { writes.push(["bus.update", data]); Object.assign(buses.get(where.id), data); return buses.get(where.id); },
      delete: async ({ where }) => { writes.push(["bus.delete", where.id]); buses.delete(where.id); },
    },
    trip: {
      findUnique: async () => hydrate(),
      count: async ({ where }) => store.trip.busId === where.busId ? 1 : 0,
      create: async ({ data }) => { writes.push(["trip.create", data]); store.trip = { id: 8, ...data }; return hydrate(); },
      update: async ({ data }) => { writes.push(["trip.update", data]); Object.assign(store.trip, data); return hydrate(); },
    },
    seatHold: { findMany: async () => holds, deleteMany: async () => ({ count: 0 }) },
  };
  const mocks = {
    "@/lib/prisma": { prisma: tx },
    "@/lib/transaction": { runTransaction: async work => { committed = false; const result = await work(tx); committed = true; return result; } },
    "@/lib/sse": { broadcastSeatRefresh: tripId => { assert.equal(committed, true); notifications.push(tripId); } },
  };
  return { store, buses, writes, notifications, tripService: load("services/tripService.ts", mocks), busService: load("services/busService.ts", mocks) };
}

const input = () => ({ from: "Sài Gòn", to: "Đà Lạt", time: new Date(Date.now() + 86400000), price: 300000, busId: "BUS-NEW" });

test("creating a trip derives seats from the selected bus and never persists client capacity", async () => {
  const { tripService, store } = setup({ targetCapacity: 28 });
  const result = await tripService.createTrip({ ...input(), capacity: 60, availableSeats: 60 });
  assert.equal(result.busId, "BUS-NEW");
  assert.equal(result.bus.capacity, 28);
  assert.equal(result.capacity, 28);
  assert.equal(result.availableSeats, 28);
  assert.equal(Object.hasOwn(store.trip, "capacity"), false);
});

test("creating a trip rejects missing and inactive buses before writing", async () => {
  for (const [busId, status] of [["BUS-MISSING", 404], ["BUS-OLD", 409]]) {
    const { tripService, writes } = setup();
    await assert.rejects(tripService.createTrip({ ...input(), busId }), { status });
    assert.deepEqual(writes, []);
  }
});

test("same-capacity reassignment preserves sold seats and cancelled history after live holds expire", async () => {
  const bookings = [{ seatNumber: "A01", status: "CONFIRMED" }, { seatNumber: "B01", status: "CANCELLED" }];
  const holds = [{ seatNumber: "C01" }];
  const { tripService, notifications } = setup({ capacity: 3, bookings, holds });
  await assert.rejects(tripService.updateTrip(7, { busId: "BUS-NEW" }), { status: 409 });
  assert.deepEqual(notifications, []);
  holds.length = 0;
  const result = await tripService.updateTrip(7, { busId: "BUS-NEW" });
  assert.equal(result.busId, "BUS-NEW");
  assert.equal(result.capacity, 3);
  assert.equal(result.availableSeats, 2);
  assert.deepEqual(result.booking, bookings);
  assert.deepEqual(notifications, [7]);
});

test("different-capacity reassignment is blocked by booking history or an active hold", async () => {
  for (const state of [
    { bookings: [{ seatNumber: "A01", status: "CONFIRMED" }] },
    { bookings: [{ seatNumber: "A01", status: "CANCELLED" }] },
    { holds: [{ seatNumber: "A01" }] },
  ]) {
    const { tripService, writes, notifications } = setup({ capacity: 22, targetCapacity: 34, ...state });
    await assert.rejects(tripService.updateTrip(7, { busId: "BUS-NEW" }), { status: 409 });
    assert.deepEqual(writes, []);
    assert.deepEqual(notifications, []);
  }
});

test("an unused trip can move to a different-capacity bus and receives its full seat map", async () => {
  const { tripService } = setup({ capacity: 22, targetCapacity: 34 });
  const result = await tripService.updateTrip(7, { busId: "BUS-NEW" });
  assert.equal(result.capacity, 34);
  assert.equal(result.availableSeats, 34);
});

test("price-only edits preserve cancelled historical seats outside an unchanged bus seat map", async () => {
  const bookings = [{ seatNumber: "A01", status: "CONFIRMED" }, { seatNumber: "C07", status: "CANCELLED" }];
  const { tripService } = setup({ capacity: 3, bookings });
  const result = await tripService.updateTrip(7, { price: 200000 });
  assert.equal(result.price, 200000);
  assert.equal(result.busId, "BUS-OLD");
  assert.equal(result.availableSeats, 2);
  assert.deepEqual(result.booking, bookings);
});

test("a same-capacity swap still rejects missing or inactive buses and invalid historical seats", async () => {
  for (const [state, busId, expected] of [
    [{}, "BUS-MISSING", 404],
    [{ bookings: [{ seatNumber: "C99", status: "CANCELLED" }] }, "BUS-NEW", 409],
    [{ holds: [{ seatNumber: "C99" }] }, "BUS-NEW", 409],
  ]) {
    const { tripService, writes } = setup(state);
    await assert.rejects(tripService.updateTrip(7, { busId }), { status: expected });
    assert.deepEqual(writes, []);
  }
  const { tripService, buses, writes } = setup();
  buses.get("BUS-NEW").status = "Bảo dưỡng";
  await assert.rejects(tripService.updateTrip(7, { busId: "BUS-NEW" }), { status: 409 });
  assert.deepEqual(writes, []);
});

test("capacity edits and deletion cannot change a bus referenced by a trip", async () => {
  const { busService, writes } = setup();
  await assert.rejects(busService.updateBus("BUS-OLD", { capacity: 34 }), { status: 409 });
  await assert.rejects(busService.deleteBus("BUS-OLD"), { status: 409 });
  assert.deepEqual(writes, []);
  const result = await busService.updateBus("BUS-OLD", { capacity: 22, notes: "Kiểm tra xe" });
  assert.equal(result.capacity, 22);
  assert.equal(result.notes, "Kiểm tra xe");
});

test("capacity edits remain available for buses with no linked trips, with direct service bounds", async () => {
  const { busService, writes } = setup();
  for (const capacity of [0, 1.5, 61]) {
    await assert.rejects(busService.updateBus("BUS-NEW", { capacity }), { status: 400 });
  }
  assert.deepEqual(writes, []);
  assert.equal((await busService.updateBus("BUS-NEW", { capacity: 3 })).capacity, 3);
  assert.equal(await busService.deleteBus("BUS-NEW"), true);
});

test("selectable bus options include every active bus and exclude unassigned legacy buses", async () => {
  const { busService, buses } = setup();
  for (let index = 0; index < 105; index++) buses.set(`BUS-${index}`, bus(`BUS-${index}`, 22));
  const options = await busService.getSelectableBuses();
  assert.equal(options.length, 106);
  assert.equal(options.some(row => row.id === "BUS-OLD"), false);
  assert.ok(options.every(row => row.status === "Đang hoạt động" && row.capacity === 22));
});

test("bus option API checks admin authorization before returning active buses", async () => {
  const calls = [];
  const route = load("app/api/buses/route.ts", {
    "@/lib/admin-api": { requireAdmin: async () => calls.push("admin"), apiError: error => Response.json({ success: false }, { status: error.status ?? 500 }) },
    "@/services/busService": { getSelectableBuses: async () => { calls.push("options"); return [bus("BUS-NEW", 22)]; } },
  });
  const response = await route.GET(new Request("http://localhost/api/buses?selectable=true"));
  assert.equal(response.status, 200);
  assert.deepEqual(calls, ["admin", "options"]);
  assert.equal((await response.json()).data[0].capacity, 22);
});

test("public trip reads expose only bus details needed to display and book the trip", async () => {
  const record = { ...bus("BUS-PUBLIC", 22), notes: "Internal maintenance note", driverPhone: "0999000001", driverName: "Private Driver" };
  const trip = { id: 1, busId: record.id, from: "Sài Gòn", to: "Đà Lạt", time: new Date(Date.now() + 86400000), availableSeats: 22 };
  const resultFor = query => ({ ...trip, bus: query.include.bus.select ? Object.fromEntries(Object.entries(record).filter(([key]) => query.include.bus.select[key])) : record });
  const { getTrips, getTripById, queryPublicTrips } = load("services/tripService.ts", {
    "@/lib/prisma": { prisma: { trip: {
      count: async () => 1,
      findUnique: async query => resultFor(query),
      findMany: async query => [resultFor(query)],
    } } },
  });
  for (const data of [await getTrips({}), [await getTripById(1)], (await queryPublicTrips({})).data]) {
    assert.equal(data[0].capacity, 22);
    assert.deepEqual(Object.keys(data[0].bus).sort(), ["capacity", "id", "plate", "status", "type"]);
    assert.equal(JSON.stringify(data).includes("Internal maintenance note"), false);
  }
});
