// Run new booking/auth/search fixes against a disposable database. This does not
// mark historical migrations as applied or alter the application's database.
require("dotenv/config");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { PrismaClient } = require("@prisma/client");
const { load } = require("./load-ts.cjs");

const database = `nha_xe_booking_fixes_verify_${Date.now()}`;
const url = new URL(process.env.DATABASE_URL);
url.pathname = `/${database}`;
const control = new PrismaClient();
const prisma = new PrismaClient({ datasources: { db: { url: url.toString() } } });
process.env.SESSION_SECRET = "isolated-booking-fixes-secret-".repeat(2);
const mocks = { "@/lib/prisma": { prisma } };
const cache = new Map();
const bookings = load("services/bookingService.ts", mocks, cache);
const orders = load("services/orderService.ts", mocks, cache);
const trips = load("services/tripService.ts", mocks, cache);
const holds = load("services/seatService.ts", mocks, cache);
const buses = load("services/busService.ts", mocks, cache);
const registration = load("app/api/auth/register/route.ts", mocks, cache);
const { isGuestPhone } = load("lib/guest-account.ts", mocks, cache);
let created = false;

function register(phone, email) {
  return registration.POST(new Request("http://localhost/api/auth/register", {
    method: "POST", headers: { origin: "http://localhost", "Content-Type": "application/json" },
    body: JSON.stringify({ fullName: "Registered Passenger", email, phone,
      password: "test-password-123", confirmPassword: "test-password-123", agreeTerms: true }),
  }));
}

async function main() {
  assert.match(database, /^nha_xe_booking_fixes_verify_\d+$/);
  await control.$executeRawUnsafe(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  created = true;

  // Exercise the actual new SQL against DOUBLE prices before the conversion.
  await prisma.$executeRawUnsafe("CREATE TABLE trip (id INTEGER PRIMARY KEY, price DOUBLE NOT NULL)");
  await prisma.$executeRawUnsafe("CREATE TABLE booking (id INTEGER PRIMARY KEY, totalPrice DOUBLE NOT NULL)");
  await prisma.$executeRawUnsafe("INSERT INTO trip VALUES (1, 10000.5)");
  await prisma.$executeRawUnsafe("INSERT INTO booking VALUES (1, 20000.5)");
  const statements = fs.readFileSync(path.resolve("prisma/admin-migrations/20261105000000_integer_vnd/migration.sql"), "utf8")
    .split(";").map((sql) => sql.trim()).filter(Boolean);
  await assert.rejects(prisma.$executeRawUnsafe(statements[0]));
  assert.equal((await prisma.$queryRawUnsafe("SELECT price FROM trip"))[0].price, 10000.5);
  await prisma.$executeRawUnsafe("UPDATE trip SET price = 10000");
  await prisma.$executeRawUnsafe(statements[0]);
  await assert.rejects(prisma.$executeRawUnsafe(statements[1]));
  assert.equal((await prisma.$queryRawUnsafe("SELECT totalPrice FROM booking"))[0].totalPrice, 20000.5);
  await prisma.$executeRawUnsafe("UPDATE booking SET totalPrice = 20000");
  for (const statement of statements.slice(1)) await prisma.$executeRawUnsafe(statement);
  assert.equal((await prisma.$queryRawUnsafe("SELECT price FROM trip"))[0].price, 10000);
  assert.equal((await prisma.$queryRawUnsafe("SELECT totalPrice FROM booking"))[0].totalPrice, 20000);
  const columns = await prisma.$queryRawUnsafe("SELECT DATA_TYPE AS type FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND ((TABLE_NAME = 'trip' AND COLUMN_NAME = 'price') OR (TABLE_NAME = 'booking' AND COLUMN_NAME = 'totalPrice'))");
  assert.equal(columns.length, 2);
  assert.ok(columns.every(({ type }) => type === "int"));
  console.log("PASS: integer-VND migration refuses fractional history and preserves valid prices.");
  await prisma.$executeRawUnsafe("DROP TABLE booking");
  await prisma.$executeRawUnsafe("DROP TABLE trip");

  // This checks the current datamodel independently of legacy migration support
  // across MySQL/MariaDB. Historical migrations have their own admin-db suite.
  const pushed = spawnSync(process.execPath, [require.resolve("prisma/build/index.js"), "db", "push", "--skip-generate"], {
    encoding: "utf8", env: { ...process.env, DATABASE_URL: url.toString() },
  });
  assert.equal(pushed.status, 0, pushed.error?.message || pushed.stderr || pushed.stdout);

  const future = new Date(Date.now() + 2 * 86400000);
  const bus = await buses.createBus({ plate: "99B-101.01", type: "Ghế ngồi", capacity: 6, status: "Đang hoạt động" });
  const trip = await trips.createTrip({ from: "Fix Origin", to: "Fix Destination", time: future, price: 100000, busId: bus.id });
  const input = { tripId: trip.id, seats: ["A01"], fullName: "Guest Passenger", phone: "0999000001" };
  await assert.rejects(trips.createTrip({ from: "Bad Price", to: "Destination", time: future, price: 10000.5, busId: bus.id }), { status: 400 });
  const result = await bookings.createBooking(input);
  const original = await prisma.booking.findUnique({ where: { id: result.bookingIds[0] }, include: { user: true } });
  assert.equal(original.status, "PENDING");
  assert.equal(original.totalPrice, 100000);
  assert.equal(isGuestPhone(original.user.phone), true);
  assert.equal(await prisma.user.findUnique({ where: { phone: input.phone } }), null);
  await assert.rejects(bookings.getBookings({ phone: input.phone }), { status: 400 });
  assert.equal((await bookings.getBookings({ pnr: result.pnr, phone: input.phone })).length, 1);
  assert.equal((await bookings.getBookings({ pnr: result.pnr, phone: "0999000002" })).length, 0);
  const registered = await register(input.phone, "new-guest@example.test");
  assert.equal(registered.status, 201, JSON.stringify(await registered.clone().json()));
  const account = await prisma.user.findUnique({ where: { phone: input.phone } });
  assert.equal(account.role, "CUSTOMER");
  assert.notEqual(account.id, original.userId);
  assert.equal(await prisma.booking.count({ where: { userId: account.id } }), 0);
  console.log("PASS: guest booking leaves registration available; lookup requires PNR and phone without transferring history.");

  const legacy = await prisma.user.create({ data: { fullName: "Legacy Guest", phone: "0999000003", password: "unusable-guest-password", role: "USER" } });
  const legacyTicket = await prisma.booking.create({ data: { tripId: trip.id, userId: legacy.id, seatNumber: "B01", activeSeat: `${trip.id}:B01`, pnr: "LEGACY-PNR", status: "PENDING", totalPrice: 100000 } });
  await prisma.trip.update({ where: { id: trip.id }, data: { availableSeats: { decrement: 1 } } });
  const legacyRegistration = await register(legacy.phone, "legacy-guest@example.test");
  assert.equal(legacyRegistration.status, 201, JSON.stringify(await legacyRegistration.clone().json()));
  const detached = await prisma.user.findUnique({ where: { id: legacy.id } });
  assert.equal(isGuestPhone(detached.phone), true);
  const preserved = await prisma.booking.findUnique({ where: { id: legacyTicket.id } });
  assert.equal(preserved.userId, legacy.id);
  assert.equal(preserved.passengerPhone, legacy.phone);
  assert.equal(preserved.passengerName, legacy.fullName);
  console.log("PASS: registering after a legacy guest purchase preserves passenger snapshots and historical ownership.");

  await holds.holdSeat(trip.id, "C01", "private-owner-one");
  const publicHolds = await holds.getActiveSeatHolds(trip.id);
  assert.deepEqual(publicHolds, [{ seatNumber: "C01", isOwn: false }]);
  await assert.rejects(bookings.createBooking({ ...input, seats: ["C01"], holdOwnerKey: "private-owner-two" }), { status: 409 });
  const own = await bookings.createBooking({ ...input, seats: ["C01"], holdOwnerKey: "private-owner-one" });
  assert.equal(await prisma.seatHold.count(), 0);
  const availability = (await prisma.trip.findUnique({ where: { id: trip.id } })).availableSeats;
  await orders.deleteOrder(own.bookingIds[0]);
  await orders.deleteOrder(own.bookingIds[0]);
  assert.equal((await prisma.trip.findUnique({ where: { id: trip.id } })).availableSeats, availability + 1);
  await orders.updateOrderStatus(own.bookingIds[0], "PENDING");
  await orders.updateOrderStatus(own.bookingIds[0], "CONFIRMED");
  assert.equal((await orders.getOrderById(own.bookingIds[0])).status, "CONFIRMED");
  console.log("PASS: hold owner keys remain private; completed admin services cancel and restore seats exactly once.");

  const sameBus = await buses.createBus({ plate: "99B-101.02", type: "Ghế ngồi", capacity: 6, status: "Đang hoạt động" });
  const largerBus = await buses.createBus({ plate: "99B-101.03", type: "Ghế ngồi", capacity: 12, status: "Đang hoạt động" });
  await assert.rejects(buses.updateBus(bus.id, { capacity: 12 }), { status: 409 });
  await assert.rejects(buses.deleteBus(bus.id), { status: 409 });
  await assert.rejects(trips.updateTrip(trip.id, { busId: largerBus.id }), { status: 409 });
  const oldAvailability = (await trips.getTripById(trip.id)).availableSeats;
  const reassigned = await trips.updateTrip(trip.id, { busId: sameBus.id });
  assert.equal(reassigned.availableSeats, oldAvailability);
  assert.equal(reassigned.capacity, 6);
  assert.equal(reassigned.busId, sameBus.id);
  console.log("PASS: referenced bus capacity/deletion are protected and equal-capacity reassignment preserves active seats.");

  const instant = new Date(Date.now() + 3 * 86400000);
  instant.setUTCHours(0, 0, 0, 0); // 07:00 Vietnam.
  const sleeperBus = await buses.createBus({ plate: "99B-101.04", type: "Giường nằm 28 chỗ", capacity: 28, status: "Đang hoạt động" });
  const limousineBus = await buses.createBus({ plate: "99B-101.05", type: "Limousine 34 phòng", capacity: 34, status: "Đang hoạt động" });
  const morning = await trips.createTrip({ from: "Search Origin", to: "Search Destination", time: instant, price: 200000, busId: sleeperBus.id });
  await prisma.trip.update({ where: { id: morning.id }, data: { availableSeats: 22 } });
  await prisma.trip.create({ data: { from: "Search Origin", to: "Search Destination", time: new Date(Date.now() - 86400000), price: 100000, busId: sleeperBus.id, availableSeats: sleeperBus.capacity } });
  await prisma.trip.create({ data: { from: "Search Origin", to: "Search Destination", time: instant, price: 100000, busId: sleeperBus.id, availableSeats: 0 } });
  await trips.createTrip({ from: "Search Origin", to: "Search Destination", time: instant, price: 200000, busId: limousineBus.id });
  const matches = await trips.queryPublicTrips({ fromCity: "Search Origin", times: ["morning"], vehicles: ["sleeper"], limit: 1 });
  assert.equal(matches.pagination.total, 1);
  assert.equal(matches.data[0].id, morning.id);
  assert.equal(matches.data[0].capacity, 28);
  const withoutTime = await trips.queryPublicTrips({ fromCity: "Search Origin", vehicles: ["sleeper"] });
  assert.equal(withoutTime.pagination.total, 1);
  assert.equal(withoutTime.data[0].id, morning.id);
  const excluded = await trips.queryPublicTrips({ fromCity: "Search Origin", times: ["early"] });
  assert.equal(excluded.pagination.total, 0);
  const extraTrips = [];
  for (let index = 0; index < 3; index++) {
    extraTrips.push(await trips.createTrip({ from: "Search Origin", to: "Search Destination", time: instant, price: 200000, busId: sleeperBus.id }));
  }
  const secondPage = await trips.queryPublicTrips({ fromCity: "Search Origin", times: ["morning"], vehicles: ["sleeper"], page: 2, limit: 2 });
  assert.equal(secondPage.pagination.total, 4);
  assert.equal(secondPage.pagination.page, 2);
  assert.deepEqual(secondPage.data.map(({ id }) => id), extraTrips.slice(1).map(({ id }) => id));
  console.log("PASS: MySQL filters Vietnam hours, actual bus type independent of capacity, availability and pagination correctly.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => {
  await prisma.$disconnect();
  if (created && /^nha_xe_booking_fixes_verify_\d+$/.test(database)) {
    await control.$executeRawUnsafe(`DROP DATABASE \`${database}\``);
    console.log("Temporary verification database removed.");
  }
  await control.$disconnect();
});
