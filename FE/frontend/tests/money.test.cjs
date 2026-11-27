const { test } = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./load-ts.cjs");

test("trip input rejects fractional VND before a ticket can be reserved", () => {
  const { tripSchema } = load("lib/validations/trip.ts");
  const trip = { from: "Sài Gòn", to: "Đà Lạt", time: "2026-12-02T08:00", busId: "BUS-PRICE-TEST" };
  for (const price of [10000.5, "10000.5", NaN, Infinity, 9999, 10000001]) {
    assert.equal(tripSchema.safeParse({ ...trip, price }).success, false);
  }
  for (const price of [10000, 300000, 10000000]) {
    assert.equal(tripSchema.parse({ ...trip, price }).price, price);
  }
});

test("server price guard rejects legacy fractional amounts without rounding", () => {
  const { assertTripPrice } = load("lib/money.ts");
  for (const value of [10000.5, 0, -1, Infinity, 10000001]) assert.throws(() => assertTripPrice(value), { status: 400 });
  assert.equal(assertTripPrice(200000), 200000);
});
