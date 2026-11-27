require("dotenv/config");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { spawnSync } = require("node:child_process");
const { PrismaClient } = require("@prisma/client");
const { load } = require("./load-ts.cjs");

const source = new URL(process.env.DATABASE_URL);
assert.equal(source.protocol, "mysql:");
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(source.hostname), "Integration check only uses local MySQL.");
const database = `nha_xe_finance_verify_${Date.now()}`;
const controlUrl = new URL(source);
controlUrl.pathname = "/mysql";
const targetUrl = new URL(source);
targetUrl.pathname = `/${database}`;
const control = new PrismaClient({ datasources: { db: { url: controlUrl.toString() } } });
const prisma = new PrismaClient({ datasources: { db: { url: targetUrl.toString() } } });
const mocks = { "@/lib/prisma": { prisma }, "@/lib/sse": { broadcastSeatRefresh: () => {} } };
const trips = load("services/tripService.ts", mocks);
const bookings = load("services/bookingService.ts", mocks);
const orders = load("services/orderService.ts", mocks);
const finance = load("services/bookingFinanceService.ts", mocks);
const dashboard = load("services/dashboardService.ts", mocks);
const buses = load("services/busService.ts", mocks);
const employees = load("services/employeeService.ts", mocks);
const holds = load("services/seatService.ts", mocks);
let created = false;

async function main() {
  assert.match(database, /^nha_xe_finance_verify_\d+$/);
  await control.$executeRawUnsafe(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  created = true;
  const migration = spawnSync(process.execPath, [require.resolve("prisma/build/index.js"), "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: targetUrl.toString() }, encoding: "utf8",
  });
  assert.equal(migration.status, 0, migration.stderr);
  console.log("PASS: fresh database accepts all migrations.");

  const actor = await prisma.user.create({ data: { fullName: "Finance test admin", phone: "0911000021", password: "integration-only", role: "ADMIN" } });
  const bus = await prisma.bus.create({ data: { id: "BUS-TEST", plate: "99B-123.45", type: "Ghế ngồi", capacity: 3 } });
  const driver = await prisma.employee.create({ data: { id: "EMP-TEST", name: "Test driver", email: "driver@example.test", phone: "0911000022", role: "Tài xế", department: "Đội xe", startDate: "2026-01-01" } });
  const time = new Date(Date.now() + 86400000);
  const input = { from: "Sai Gon", to: "Da Lat", time, endsAt: new Date(time.getTime() + 7200000), price: 100000, status: "OPEN", busId: bus.id, driverId: driver.id };
  const trip = await trips.createTrip(input);
  await assert.rejects(trips.createTrip(input), { status: 409 });
  await assert.rejects(buses.updateBusStatus(bus.id, "Bảo dưỡng"), { status: 409 });
  await assert.rejects(employees.updateEmployeeStatus(driver.id, "Nghỉ phép"), { status: 409 });
  console.log("PASS: dispatch prevents overlapping trips and unavailable assigned resources.");

  const historical = await prisma.booking.create({ data: {
    pnr: "OLD-PAID-CANCELLED", seatNumber: "C01", status: "CANCELLED", totalPrice: 100000,
    userId: actor.id, tripId: trip.id, confirmedAt: new Date("2026-01-02T00:00:00Z"),
  } });
  const sql = fs.readFileSync("prisma/admin-migrations/20261107000000_finance_and_dispatch/migration.sql", "utf8");
  await prisma.$executeRawUnsafe(sql.slice(sql.indexOf("INSERT INTO `BookingTransaction`")));
  const imported = await orders.getOrderById(historical.id);
  assert.equal(imported.received, 100000);
  assert.equal(imported.refundDue, 100000);
  assert.equal(imported.transactions[0].method, "LEGACY");
  assert.equal(imported.transactions[0].createdAt, "2026-01-02T00:00:00.000Z");
  console.log("PASS: canceled historical paid tickets retain receipt date and pending refund.");

  const sale = await bookings.createBooking({ tripId: trip.id, seats: ["A01", "B01"], fullName: "Passenger", phone: "0911000023", status: "CONFIRMED", actorId: actor.id, paymentMethod: "BANK_TRANSFER" });
  const listed = await orders.queryOrdersAdmin({ search: sale.pnr, limit: 1 });
  assert.equal(listed.pagination.total, 1);
  assert.equal(listed.data[0].tickets.length, 2);
  assert.equal(listed.stats.total, 2);
  assert.equal(listed.stats.orderCount, 1);
  assert.equal(listed.stats.transactionCount, 1);
  assert.equal(listed.stats.received, 200000);
  const beforeCancel = await dashboard.getDashboardStats();
  const firstId = sale.bookingIds[0];
  await orders.deleteOrder(firstId);
  const afterCancel = await dashboard.getDashboardStats();
  assert.equal(afterCancel.revenueThisMonth, beforeCancel.revenueThisMonth);
  assert.equal(afterCancel.received, beforeCancel.received);
  assert.equal(afterCancel.refundDue, beforeCancel.refundDue + 100000);
  await orders.updateOrderStatus(firstId, "PENDING");
  assert.equal((await orders.getOrderById(firstId)).status, "CONFIRMED");
  assert.equal(await prisma.bookingTransaction.count({ where: { bookingId: firstId } }), 1);
  await orders.deleteOrder(firstId);
  await Promise.all([finance.refundBookingPayment(firstId, "BANK_TRANSFER", actor.id), finance.refundBookingPayment(firstId, "BANK_TRANSFER", actor.id)]);
  const refunded = await orders.getOrderById(firstId);
  assert.equal(refunded.refunded, 100000);
  assert.equal(refunded.refundDue, 0);
  assert.equal(refunded.transactions.length, 2);
  assert.equal((await orders.getOrderById(sale.bookingIds[1])).refunded, 0);
  assert.equal((await dashboard.getDashboardStats()).revenueThisMonth, beforeCancel.revenueThisMonth - 100000);
  console.log("PASS: cancellation preserves revenue; individual refund is atomic, traceable and repeat-safe.");

  const pending = await bookings.createBooking({ tripId: trip.id, seats: ["C01"], fullName: "Counter passenger", phone: "0911000024" });
  await Promise.all([finance.receiveBookingPayment(pending.bookingIds[0], "CASH", actor.id), finance.receiveBookingPayment(pending.bookingIds[0], "CASH", actor.id)]);
  assert.equal(await prisma.bookingTransaction.count({ where: { bookingId: pending.bookingIds[0], kind: "RECEIPT" } }), 1);
  assert.equal((await orders.getOrderById(pending.bookingIds[0])).amountDue, 0);
  console.log("PASS: concurrent counter collection produces exactly one receipt.");

  const onlineStarted = Date.now();
  const anonymous = await bookings.createBooking({ tripId: trip.id, seats: ["A01"], fullName: "Online guest", phone: actor.phone, isOnline: true });
  const anonymousTicket = await prisma.booking.findUnique({ where: { id: anonymous.bookingIds[0] }, include: { user: true } });
  assert.notEqual(anonymousTicket.userId, actor.id);
  assert.match(anonymousTicket.user.phone, /^guest:/);
  assert.equal(anonymousTicket.passengerPhone, actor.phone);
  assert.ok(anonymousTicket.expiresAt.getTime() > onlineStarted);
  assert.ok(anonymousTicket.expiresAt.getTime() <= Date.now() + 5 * 60000);
  await orders.deleteOrder(anonymousTicket.id);
  console.log("PASS: online guest bookings preserve account ownership and payment expiry.");

  const nextTime = new Date(time.getTime() + 86400000);
  const nextInput = { ...input, time: nextTime, endsAt: new Date(nextTime.getTime() + 7200000) };
  const competing = await Promise.allSettled([trips.createTrip(nextInput), trips.createTrip(nextInput)]);
  assert.equal(competing.filter((result) => result.status === "fulfilled").length, 1);
  const heldTrip = competing.find((result) => result.status === "fulfilled").value;
  await holds.holdSeat(heldTrip.id, "A01", "test-owner");
  await assert.rejects(trips.updateTrip(heldTrip.id, { from: "Can Tho" }), { status: 409 });
  await assert.rejects(trips.deleteTrip(heldTrip.id), { status: 409 });
  await holds.releaseSeat(heldTrip.id, "A01", "test-owner");
  await trips.deleteTrip(heldTrip.id);
  console.log("PASS: concurrent dispatch has one winner; live holds prevent route changes and deletion.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
  if (created) {
    assert.match(database, /^nha_xe_finance_verify_\d+$/);
    await control.$executeRawUnsafe(`DROP DATABASE \`${database}\``);
    console.log("Removed only the isolated verification database.");
  }
  await control.$disconnect();
});
