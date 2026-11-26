const { test } = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./load-ts.cjs");

test("management guard requires an authenticated administrator for reads and writes", async () => {
  const databaseAdmin = { id: 7, fullName: "Admin", phone: "0900000000", role: "ADMIN", isActive: true };
  for (const [account, status] of [[null, 401], [{ role: "CUSTOMER" }, 403], [{ role: "USER" }, 403], [databaseAdmin, 200]]) {
    const helpers = load("lib/admin-api.ts", { "@/lib/session": { getCurrentUser: async () => account } });
    for (const method of ["GET", "POST"]) {
      const request = new Request("http://localhost/api/users", { method });
      if (status === 200) assert.equal((await helpers.requireAdmin(request)).id, databaseAdmin.id);
      else await assert.rejects(helpers.requireAdmin(request), { status });
    }
  }
});

test("management guard rejects mutations from another origin and malformed JSON", async () => {
  const helpers = load("lib/admin-api.ts", { "@/lib/session": { getCurrentUser: async () => ({ id: 1, role: "ADMIN" }) } });
  await assert.rejects(helpers.requireAdmin(new Request("http://localhost/api/users", { method: "POST", headers: { origin: "https://elsewhere.test" } })), { status: 403 });
  await assert.rejects(helpers.readJson(new Request("http://localhost", { method: "POST", body: "{" })), { status: 400 });
  const response = helpers.apiError({ code: "P2002" }, "Error");
  assert.equal(response.status, 409);
});

test("admin pages send visitors and customers to the separate admin login page", async () => {
  for (const account of [null, { role: "CUSTOMER" }]) {
    const helpers = load("lib/admin-api.ts", {
      "@/lib/session": { getCurrentUser: async () => account },
      "next/navigation": { redirect: url => { throw new Error(`redirect:${url}`); } },
    });
    await assert.rejects(helpers.requireAdmin(), /^Error: redirect:\/admin\/login$/);
  }
});

test("validates bus selection, bus capacity, distinct locations, real dates and employee identity", () => {
  const { tripSchema } = load("lib/validations/trip.ts");
  const trip = { from: "Sài Gòn", to: "Đà Lạt", time: "2026-12-02T08:00", price: 300000, busId: "BUS-001" };
  assert.equal(tripSchema.safeParse(trip).success, true);
  for (const data of [{ busId: " " }, { to: " SÀI GÒN " }, { time: "bad" }, { time: "2026-02-30T08:00" }, { busId: undefined }]) assert.equal(tripSchema.safeParse({ ...trip, ...data }).success, false);
  assert.equal("capacity" in tripSchema.parse({ ...trip, capacity: 60 }), false);
  const { employeeSchema } = load("lib/validations/employee.ts");
  const employee = { name: "Nhân viên", email: "staff@example.test", phone: "0901234567", role: "Tài xế", department: "Đội xe", status: "Đang làm việc", startDate: "2026-10-01" };
  assert.equal(employeeSchema.safeParse(employee).success, true);
  for (const data of [{ startDate: "2026-02-30" }, { identityCard: "1234567890" }]) assert.equal(employeeSchema.safeParse({ ...employee, ...data }).success, false);
  const { busSchema } = load("lib/validations/bus.ts");
  const bus = { plate: "51B-123.45", type: "Giường nằm", capacity: 22, status: "Đang hoạt động", year: "" };
  assert.equal(busSchema.parse(bus).year, null);
  for (const capacity of [0, 22.5, 61]) assert.equal(busSchema.safeParse({ ...bus, capacity }).success, false);
  assert.equal(busSchema.safeParse({ ...bus, capacity: 3 }).success, true);
});

test("seat map has exactly database capacity and treats legacy aliases as one seat", () => {
  const { normalizeSeat, getSeatCodes } = load("lib/seats.ts");
  const { default: generateSeats } = load("components/trips/seatUtils.ts");
  for (const value of ["a1", " A01 ", "1A1", "2A01"]) assert.equal(normalizeSeat(value), "A01");
  assert.equal(getSeatCodes(22).length, 22);
  assert.ok(!getSeatCodes(22).includes("C08"));
  const seats = generateSeats(["a1"], 22);
  assert.equal(seats.length, 22);
  assert.equal(seats.filter((seat) => seat.isBooked).length, 1);
});

test("serializable transactions retry conflicts only and stop after three attempts", async () => {
  let attempts = 0;
  const prisma = { $transaction: async (work, options) => {
    assert.equal(options.isolationLevel, "Serializable");
    attempts++;
    if (attempts < 3) throw { code: "P2034" };
    return work({ value: 7 });
  } };
  const { runTransaction } = load("lib/transaction.ts", { "@/lib/prisma": { prisma } });
  assert.equal(await runTransaction(async (tx) => tx.value), 7);
  assert.equal(attempts, 3);
  attempts = 0;
  prisma.$transaction = async () => { attempts++; throw { code: "P2034" }; };
  await assert.rejects(runTransaction(async () => 0), { code: "P2034" });
  assert.equal(attempts, 3);
  attempts = 0;
  prisma.$transaction = async () => { attempts++; throw new Error("Disconnected"); };
  await assert.rejects(runTransaction(async () => 0), /Disconnected/);
  assert.equal(attempts, 1);
});

test("locked accounts cannot use an existing signed session", async () => {
  process.env.SESSION_SECRET = "test-secret-".repeat(4);
  const { createSessionToken } = load("lib/session.ts", { "@/lib/prisma": { prisma: {} } });
  const session = load("lib/session.ts", {
    "next/headers": { cookies: async () => ({ get: () => ({ value: createSessionToken(7, "stored-hash") }) }) },
    "@/lib/prisma": { prisma: { user: { findUnique: async () => ({ id: 7, role: "ADMIN", isActive: false }) } } },
  });
  assert.equal(await session.getCurrentAdmin(), null);
});

test("Vietnam date-time input round trips without a seven-hour shift", () => {
  const { formatVietnamDateTime, parseVietnamDateTime, getVietnamMonthStart } = load("lib/trip-search.ts");
  const instant = new Date("2026-10-02T01:30:00Z");
  assert.equal(formatVietnamDateTime(instant), "2026-10-02T08:30");
  assert.equal(parseVietnamDateTime(formatVietnamDateTime(instant)).toISOString(), instant.toISOString());
  assert.equal(getVietnamMonthStart(instant).toISOString(), "2026-09-30T17:00:00.000Z");
});
