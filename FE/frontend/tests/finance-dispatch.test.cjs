const { test } = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./load-ts.cjs");

const { getBookingMoney, getMoneySummary } = load("lib/booking-money.ts");
const receipt = { kind: "RECEIPT", amount: 100000, method: "CASH", reference: "sale-1" };

test("canceling a paid seat keeps its receipt and creates a refund liability, not a fake refund", () => {
  const booking = { totalPrice: 100000, status: "CANCELLED", transactions: [receipt] };
  assert.deepEqual(getBookingMoney(booking.totalPrice, booking.status, booking.transactions), {
    received: 100000, refunded: 0, refundDue: 100000, amountDue: 0, paymentStatus: "REFUND_DUE",
  });
  booking.transactions.push({ ...receipt, kind: "REFUND", reference: "refund-1" });
  const summary = getMoneySummary([booking]);
  assert.equal(summary.received, 100000);
  assert.equal(summary.refunded, 100000);
  assert.equal(summary.refundDue, 0);
});

test("three seats in one sale count as one money transaction; demo is excluded from real reports", () => {
  const rows = [1, 2, 3].map(() => ({ totalPrice: 100000, status: "CONFIRMED", transactions: [receipt] }));
  assert.equal(getMoneySummary(rows).transactionCount, 1);
  assert.equal(getMoneySummary(rows).received, 300000);
  const demo = { totalPrice: 100000, status: "CONFIRMED", transactions: [{ ...receipt, method: "DEMO" }] };
  assert.equal(getMoneySummary([demo], false).received, 0);
  assert.equal(getMoneySummary([demo], false).amountDue, 0);
});

function financeSetup() {
  const row = { id: 1, totalPrice: 100000, status: "PENDING", confirmedAt: null, expiresAt: null, trip: { status: "OPEN" }, transactions: [] };
  const tx = {
    booking: { findUnique: async () => row, update: async ({ data }) => Object.assign(row, data) },
    bookingTransaction: { create: async ({ data }) => { row.transactions.push(data); return data; } },
  };
  const mocks = { "@/lib/prisma": { prisma: tx }, "@/lib/transaction": { runTransaction: async (work) => work(tx) } };
  return { row, tx, mocks, service: load("services/bookingFinanceService.ts", mocks) };
}

test("counter receipt records amount, method, time owner and does not charge twice", async () => {
  const { row, service } = financeSetup();
  await service.receiveBookingPayment(1, "BANK_TRANSFER", 7);
  await service.receiveBookingPayment(1, "BANK_TRANSFER", 7);
  assert.equal(row.status, "CONFIRMED");
  assert.equal(row.transactions.length, 1);
  assert.equal(row.transactions[0].amount, 100000);
  assert.equal(row.transactions[0].method, "BANK_TRANSFER");
  assert.equal(row.transactions[0].actorId, 7);
  assert.ok(row.confirmedAt instanceof Date);
});

test("refund requires a canceled ticket, preserves receipt and is repeat-safe", async () => {
  const { row, service } = financeSetup();
  await service.receiveBookingPayment(1, "CASH", 7);
  await assert.rejects(service.refundBookingPayment(1, "CASH", 7), { status: 409 });
  row.status = "CANCELLED";
  await service.refundBookingPayment(1, "BANK_TRANSFER", 8);
  await service.refundBookingPayment(1, "BANK_TRANSFER", 8);
  assert.equal(row.transactions.length, 2);
  assert.equal(row.transactions[0].kind, "RECEIPT");
  assert.equal(row.transactions[1].kind, "REFUND");
  assert.equal(row.transactions[1].actorId, 8);
  assert.equal(getBookingMoney(100000, row.status, row.transactions).refundDue, 0);
});

test("expired and canceled tickets cannot receive money; demo refunds never become real cash refunds", async () => {
  const { row, service } = financeSetup();
  row.expiresAt = new Date(Date.now() - 1000);
  await assert.rejects(service.receiveBookingPayment(1, "CASH", 7), { status: 409 });
  row.status = "CANCELLED";
  row.transactions.push({ ...receipt, method: "DEMO" });
  await assert.rejects(service.receiveBookingPayment(1, "CASH", 7), { status: 409 });
  await service.refundBookingPayment(1, "CASH", 7);
  assert.equal(row.transactions[1].method, "DEMO");
});

test("payment API rejects unauthenticated users, cross-origin writes and injected amounts or actors", async () => {
  let calls = 0;
  const createRoute = (account) => load("app/api/admin/orders/[id]/payment/route.ts", {
    "@/lib/session": { getCurrentUser: async () => account },
    "@/services/bookingFinanceService": { receiveBookingPayment: async (_id, _method, actorId) => { assert.equal(actorId, 7); calls++; return true; } },
  });
  const request = (body, origin) => new Request("http://localhost/api/admin/orders/1/payment", { method: "POST", body: JSON.stringify(body), headers: origin ? { origin } : {} });
  const params = { params: Promise.resolve({ id: "1" }) };
  const body = { kind: "RECEIPT", method: "CASH" };
  for (const [account, status] of [[null, 401], [{ role: "CUSTOMER" }, 403]]) assert.equal((await createRoute(account).POST(request(body), params)).status, status);
  const route = createRoute({ id: 7, role: "ADMIN" });
  assert.equal((await route.POST(request(body, "https://evil.test"), params)).status, 403);
  for (const extra of [{ amount: 1 }, { actorId: 99 }, { kind: "PAID" }, { method: "DEMO" }]) assert.equal((await route.POST(request({ ...body, ...extra }), params)).status, 400);
  assert.equal(calls, 0);
  assert.equal((await route.POST(request(body), params)).status, 200);
  assert.equal(calls, 1);
});

function dispatchSetup() {
  const time = new Date(Date.now() + 86400000);
  const bus = { id: "BUS-1", plate: "51B-123.45", capacity: 3, status: "Đang hoạt động" };
  const driver = { id: "EMP-1", name: "Driver", role: "Tài xế", status: "Đang làm việc" };
  const trip = { id: 7, from: "Sai Gon", to: "Da Lat", time, endsAt: new Date(time.getTime() + 3600000), price: 100000, bus, availableSeats: 3, status: "OPEN", busId: bus.id, driverId: driver.id, booking: [] };
  const state = { held: 0, conflict: null, deleted: false, conflictQuery: null };
  const tx = {
    bus: { findUnique: async () => bus }, employee: { findUnique: async () => driver },
    trip: {
      findUnique: async () => trip,
      findFirst: async (query) => { state.conflictQuery = query; return state.conflict; },
      create: async ({ data }) => ({ id: 8, ...data, bus }),
      update: async ({ data }) => Object.assign(trip, data),
      delete: async () => { state.deleted = true; return trip; },
    },
    booking: { count: async () => trip.booking.length },
    seatHold: { count: async () => state.held, findMany: async () => Array.from({ length: state.held }, () => ({ seatNumber: "A01" })), deleteMany: async () => ({ count: 0 }) },
  };
  const service = load("services/tripService.ts", {
    "@/lib/prisma": { prisma: tx }, "@/lib/transaction": { runTransaction: async (work) => work(tx) },
    "@/lib/sse": { broadcastSeatRefresh: () => {} },
  });
  return { trip, bus, driver, state, service };
}

function tripCreateApi(service) {
  return load("app/api/trips/route.ts", {
    "@/lib/admin-api": {
      requireAdmin: async () => ({ id: 7, role: "ADMIN" }),
      readJson: (request) => request.json(),
      apiError: (error) => Response.json({ success: false, message: error.message }, { status: error.status ?? 500 }),
    },
    "@/services/tripService": service,
  });
}

test("creating through the admin API saves status, driver and end time on the first submission", async () => {
  for (const status of ["OPEN", "DRAFT"]) {
    const { bus, driver, service } = dispatchSetup();
    const payload = {
      from: "Sai Gon", to: "Da Lat", price: 100000, busId: bus.id,
      status, driverId: driver.id, time: "2099-12-02T08:00", endsAt: "2099-12-02T10:30",
    };
    const response = await tripCreateApi(service).POST(new Request("http://localhost/api/trips", { method: "POST", body: JSON.stringify(payload) }));
    assert.equal(response.status, 201);
    const { data } = await response.json();
    assert.equal(data.status, status);
    assert.equal(data.driverId, driver.id);
    assert.equal(data.endsAt, "2099-12-02T03:30:00.000Z");
    assert.equal(data.time, "2099-12-02T01:00:00.000Z");
    assert.equal(data.availableSeats, bus.capacity);
  }
});

test("admin creation validates the submitted OPEN assignment instead of silently creating a draft", async () => {
  const { trip, state, service } = dispatchSetup();
  state.conflict = { id: 99 };
  const response = await tripCreateApi(service).POST(new Request("http://localhost/api/trips", {
    method: "POST", body: JSON.stringify({
      from: trip.from, to: trip.to, price: trip.price, busId: trip.busId,
      time: trip.time.toISOString(), endsAt: trip.endsAt.toISOString(), status: "OPEN", driverId: trip.driverId,
    }),
  }));
  assert.equal(response.status, 409);
  assert.match((await response.json()).message, /99/);
});

test("live holds block route changes, vehicle swaps, closing sales and deleting trips", async () => {
  const { trip, state, service } = dispatchSetup();
  state.held = 1;
  for (const change of [{ from: "Can Tho" }, { time: new Date(trip.time.getTime() + 1000) }, { busId: "BUS-2" }, { status: "DRAFT" }, { status: "CANCELLED" }]) {
    await assert.rejects(service.updateTrip(7, change), { status: 409 });
  }
  await assert.rejects(service.deleteTrip(7), { status: 409 });
  assert.equal(state.deleted, false);
  state.held = 0;
  assert.equal((await service.updateTrip(7, { from: "Can Tho" })).from, "Can Tho");
});

test("opening a trip requires available vehicle, working driver and valid interval", async () => {
  for (const change of [
    { busId: null }, { driverId: null }, { endsAt: null },
    { endsAt: new Date(0) },
  ]) {
    const { trip, service } = dispatchSetup();
    await assert.rejects(service.createTrip({ ...trip, ...change }));
  }
  const { trip, bus, driver, service } = dispatchSetup();
  bus.status = "Bảo dưỡng";
  await assert.rejects(service.createTrip(trip), { status: 409 });
  bus.status = "Đang hoạt động";
  driver.status = "Nghỉ phép";
  await assert.rejects(service.createTrip(trip), { status: 409 });
  driver.status = "Đang làm việc";
  driver.role = "Phụ xe";
  await assert.rejects(service.createTrip(trip), { status: 409 });
});

test("dispatch checks both vehicle and driver overlap using half-open intervals", async () => {
  const { trip, state, service } = dispatchSetup();
  state.conflict = { id: 99 };
  await assert.rejects(service.createTrip(trip), { status: 409 });
  assert.equal(state.conflictQuery.where.AND[0].OR[0].time.lt, trip.endsAt);
  assert.equal(state.conflictQuery.where.AND[0].OR[0].endsAt.gt, trip.time);
  assert.equal(state.conflictQuery.where.AND[0].OR.length, 1);
  assert.deepEqual(state.conflictQuery.where.OR, [{ busId: trip.busId }, { driverId: trip.driverId }]);
  state.conflict = null;
  assert.equal((await service.createTrip(trip)).status, "OPEN");
});

test("a delayed OPEN trip can replace its driver but a past DRAFT cannot open sales", async () => {
  const { trip, driver, state, service } = dispatchSetup();
  trip.time = new Date(Date.now() - 7200000);
  trip.endsAt = new Date(Date.now() - 3600000);
  driver.id = "EMP-2";
  assert.equal((await service.updateTrip(7, { driverId: driver.id })).driverId, "EMP-2");
  assert.deepEqual(state.conflictQuery.where.id, { not: 7 });
  assert.deepEqual(state.conflictQuery.where.AND[0].OR[1], { status: "DEPARTED" });
  trip.status = "DRAFT";
  await assert.rejects(service.updateTrip(7, { status: "OPEN" }), { status: 409 });
});

test("departure keeps unfinished trips occupied beyond their estimated end for both bus and driver", async () => {
  const { trip, state, service } = dispatchSetup();
  trip.time = new Date(Date.now() - 60000);
  state.conflict = { id: 99, status: "DEPARTED", endsAt: new Date(Date.now() - 3600000) };
  await assert.rejects(service.updateTrip(7, { status: "DEPARTED" }), { status: 409, message: /99/ });
  assert.equal(trip.status, "OPEN");
  assert.deepEqual(state.conflictQuery.where.OR, [{ busId: trip.busId }, { driverId: trip.driverId }]);
  assert.deepEqual(state.conflictQuery.where.id, { not: trip.id });
  assert.deepEqual(state.conflictQuery.where.AND[0].OR[1], { status: "DEPARTED" });
  state.conflict = null;
  assert.equal((await service.updateTrip(7, { status: "DEPARTED" })).status, "DEPARTED");
});

test("trip lifecycle cannot skip departure or reopen completed trips", async () => {
  const { trip, service } = dispatchSetup();
  await assert.rejects(service.updateTrip(7, { status: "COMPLETED" }), { status: 409 });
  await assert.rejects(service.updateTrip(7, { status: "DEPARTED" }), { status: 409 });
  trip.status = "COMPLETED";
  await assert.rejects(service.updateTrip(7, { status: "OPEN" }), { status: 409 });
});

test("a PNR page contains whole orders, including canceled seats, and counts money references separately", async () => {
  const time = new Date();
  const rows = [1, 2, 3].map((id) => ({
    id, pnr: "PNR-1", status: id === 3 ? "CANCELLED" : "CONFIRMED", totalPrice: 100000,
    seatNumber: `A0${id}`, createdAt: time,
    user: { id: 1, fullName: "Passenger", phone: "0901234567", role: "USER" },
    trip: { id: 7, from: "A", to: "B", time, price: 100000, availableSeats: 1 },
    transactions: [{ id, ...receipt, createdAt: time, actor: { fullName: "Admin" } }],
  }));
  let groupCalls = 0;
  let pageWhere;
  const service = load("services/orderService.ts", { "@/lib/prisma": { prisma: { booking: {
    groupBy: async () => ++groupCalls === 1 ? [{ pnr: "PNR-1" }, { pnr: "PNR-2" }] : [{ pnr: "PNR-1", _min: { id: 1, createdAt: time }, _sum: { totalPrice: 300000 } }],
    findMany: async (query) => { if (query.include) pageWhere = query.where; return rows; },
  } } } });
  const result = await service.queryOrdersAdmin({ page: 1, limit: 1, status: "CANCELLED" });
  assert.equal(result.pagination.total, 2);
  assert.equal(result.data.length, 1);
  assert.equal(result.data[0].tickets.length, 3);
  assert.equal(result.stats.total, 3);
  assert.equal(result.stats.transactionCount, 1);
  assert.equal(result.stats.received, 300000);
  assert.equal(result.stats.refundDue, 100000);
  assert.deepEqual(pageWhere, { pnr: { in: ["PNR-1"] } });
});

test("PNR sorting uses group totals or earliest ticket date and keeps stable group pagination", async () => {
  for (const sortBy of ["id", "createdAt", "totalPrice"]) {
    for (const sortOrder of ["asc", "desc"]) {
      let groupCalls = 0;
      const service = load("services/orderService.ts", { "@/lib/prisma": { prisma: { booking: {
        groupBy: async (query) => {
          if (++groupCalls === 1) { assert.ok(query.where.OR.length > 0); return Array.from({ length: 20 }, (_, index) => ({ pnr: `PNR-${index}` })); }
          assert.deepEqual(query.orderBy, [{ [sortBy === "totalPrice" ? "_sum" : "_min"]: { [sortBy]: sortOrder } }, { pnr: "asc" }]);
          assert.equal(query.skip, 8);
          assert.equal(query.take, 8);
          return [];
        },
        findMany: async () => [],
      } } } });
      const result = await service.queryOrdersAdmin({ search: "PNR", sortBy, sortOrder, page: 2, limit: 8 });
      assert.equal(result.pagination.page, 2);
      assert.equal(result.pagination.total, 20);
    }
  }
});
