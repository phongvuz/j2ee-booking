// Database tạm: kiểm tra bấm đồng thời không tạo hai payment.
require("dotenv/config");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { PrismaClient } = require("@prisma/client");
const { load } = require("./load-ts.cjs");

const database = `nha_xe_payment_verify_${Date.now()}`;
const control = new PrismaClient();
const url = new URL(process.env.DATABASE_URL);
url.pathname = `/${database}`;
const prisma = new PrismaClient({ datasources: { db: { url: url.toString() } }, log: [] });
process.env.VIETQR_BANK_ID = "970436";
process.env.VIETQR_BANK_NAME = "Vietcombank";
process.env.VIETQR_ACCOUNT_NO = "0123456789";
process.env.VIETQR_ACCOUNT_NAME = "TEST ACCOUNT";
process.env.PAYMENT_DEMO_ENABLED = "true";
const mocks = { "@/lib/prisma": { prisma } };
const payments = load("services/paymentService.ts", mocks);
const bookings = load("services/bookingService.ts", mocks);
const orders = load("services/orderService.ts", mocks);
let created = false;

async function main() {
  assert.match(database, /^nha_xe_payment_verify_\d+$/);
  await control.$executeRawUnsafe(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  created = true;
  // Payment behavior uses the current datamodel; historical migration deployment
  // is checked separately by admin-db.cjs.
  const pushed = spawnSync(process.execPath, [require.resolve("prisma/build/index.js"), "db", "push", "--skip-generate"], { encoding: "utf8", env: { ...process.env, DATABASE_URL: url.toString() } });
  assert.equal(pushed.status, 0, pushed.error?.message || pushed.stderr || pushed.stdout);
  const bus = await prisma.bus.create({ data: { id: "BUS-PAYMENT", plate: "99B-100.01", type: "Ghế ngồi", capacity: 6, status: "Đang hoạt động" } });
  const trip = await prisma.trip.create({ data: { from: "Demo Test", to: "Destination", time: new Date(Date.now() + 86400000), price: 200000, busId: bus.id, availableSeats: bus.capacity } });
  const input = { tripId: trip.id, fullName: "Payment Test", phone: "0999000001", status: "PENDING" };
  const first = await bookings.createBooking({ ...input, seats: ["A01", "B01"] });
  const info = await payments.getVietqrPaymentInfo(first.pnr);
  assert.equal(info.total_amount, 400000);
  assert.equal(await prisma.payment.count(), 0);
  await Promise.all([payments.confirmDemoPayment(first.pnr), payments.confirmDemoPayment(first.pnr)]);
  await payments.confirmDemoPayment(first.pnr);
  assert.equal(await prisma.payment.count({ where: { pnr: first.pnr } }), 1);
  assert.equal(await prisma.booking.count({ where: { pnr: first.pnr, status: "CONFIRMED", confirmedAt: { not: null } } }), 2);
  const payment = await prisma.payment.findFirst({ where: { pnr: first.pnr } });
  assert.equal(payment.amount, 400000); assert.equal(payment.responseCode, "DEMO");
  assert.equal((await prisma.trip.findUnique({ where: { id: trip.id } })).availableSeats, 4);
  console.log("✓ QR reads database amount; concurrent clicks create one demo payment and confirm every seat once.");

  const cancelled = await bookings.createBooking({ ...input, seats: ["C01"] });
  await orders.updateOrderStatus(cancelled.bookingIds[0], "CANCELLED");
  await assert.rejects(payments.confirmDemoPayment(cancelled.pnr), (error) => error.status === 409);
  assert.equal(await prisma.payment.count({ where: { pnr: cancelled.pnr } }), 0);
  assert.equal((await prisma.trip.findUnique({ where: { id: trip.id } })).availableSeats, 4);
  console.log("✓ Cancelled tickets remain cancelled and seats are not deducted again.");

  const pending = await bookings.createBooking({ ...input, seats: ["A02"] });
  process.env.PAYMENT_DEMO_ENABLED = "false";
  await assert.rejects(payments.confirmDemoPayment(pending.pnr), (error) => error.status === 403);
  assert.equal(await prisma.payment.count({ where: { pnr: pending.pnr } }), 0);
  assert.equal((await prisma.booking.findUnique({ where: { id: pending.bookingIds[0] } })).status, "PENDING");
  console.log("✓ Backend refuses confirmation when demo mode is disabled.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => {
  await prisma.$disconnect();
  if (created) {
    assert.match(database, /^nha_xe_payment_verify_\d+$/);
    await control.$executeRawUnsafe(`DROP DATABASE \`${database}\``);
    console.log("✓ Temporary database removed.");
  }
  await control.$disconnect();
});
