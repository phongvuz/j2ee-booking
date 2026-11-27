const { test } = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./load-ts.cjs");

const reference = "NHAXE-42-1234567890ABCDEF";
const phone = "0901234567";

function setup() {
  const reads = [];
  const records = [
    { id: 1, pnr: reference, passengerPhone: phone, passengerName: "Passenger", seatNumber: "A01" },
    { id: 2, pnr: "NHAXE-43-FEDCBA0987654321", passengerPhone: phone, passengerName: "Passenger", seatNumber: "A02" },
    { id: 3, pnr: "NHAXE-44-1234567890ABCDEF", passengerPhone: "0901234568", passengerName: "Other passenger", seatNumber: "B01" },
  ];
  const prisma = { booking: { findMany: async (args) => {
    reads.push(args);
    assert.equal(args.where.OR, undefined);
    return records.filter((record) => record.pnr === args.where.pnr && record.passengerPhone === args.where.passengerPhone);
  } } };
  const cache = new Map();
  const mocks = { "@/lib/prisma": { prisma } };
  const service = load("services/bookingService.ts", mocks, cache);
  const route = load("app/api/bookings/route.ts", mocks, cache);
  return { service, get: (query) => route.GET(new Request(`http://localhost/api/bookings?${query}`)), reads };
}

test("lookup rejects phone-only and PNR-only requests without querying bookings", async () => {
  const s = setup();
  for (const filter of [{}, { phone }, { pnr: reference }, { query: phone }, { query: reference }, { pnr: reference, phone: "bad" }]) {
    await assert.rejects(s.service.getBookings(filter), { status: 400 });
  }
  assert.equal(s.reads.length, 0);
});

test("lookup requires the exact PNR and passenger phone pair and returns only that group", async () => {
  const { service } = setup();
  const result = await service.getBookings({ pnr: ` ${reference} `, phone: ` ${phone} ` });
  assert.deepEqual(result.map((record) => record.id), [1]);
  assert.deepEqual(result[0].user, { fullName: "Passenger", phone });
  assert.deepEqual(await service.getBookings({ pnr: reference, phone: "0901234568" }), []);
  assert.deepEqual(await service.getBookings({ pnr: "wrong-reference", phone }), []);
});

test("public API rejects the old phone enumeration interface and does not cache results or errors", async () => {
  const s = setup();
  for (const query of [`phone=${phone}`, `query=${phone}`, `query=${reference}`, `pnr=${reference}`]) {
    const response = await s.get(query);
    assert.equal(response.status, 400);
    assert.equal(response.headers.get("cache-control"), "no-store");
  }
  assert.equal(s.reads.length, 0);
  const response = await s.get(new URLSearchParams({ pnr: reference, phone }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const body = await response.json();
  assert.equal(body.count, 1);
  assert.deepEqual(body.data.map((record) => record.id), [1]);
});
