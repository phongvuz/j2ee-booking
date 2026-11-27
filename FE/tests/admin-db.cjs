// Integration checks use a newly created database, never the application's records.
require("dotenv/config");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { PrismaClient } = require("@prisma/client");
const { load } = require("./load-ts.cjs");
const database = `nha_xe_admin_verify_${Date.now()}`;
const control = new PrismaClient();
const url = new URL(process.env.DATABASE_URL);
url.pathname = `/${database}`;
const prisma = new PrismaClient({ datasources: { db: { url: url.toString() } }, log: [] });
const mocks = { "@/lib/prisma": { prisma } };
const bookings = load("services/bookingService.ts", mocks);
const orders = load("services/orderService.ts", mocks);
const trips = load("services/tripService.ts", mocks);
const users = load("services/userService.ts", mocks);
const buses = load("services/busService.ts", mocks);
const employees = load("services/employeeService.ts", mocks);
const holds = load("services/seatService.ts", mocks);
const { verifyPassword } = load("lib/password.ts");
let created = false;

function command(args, extra = {}) {
  const result = spawnSync(process.execPath, args, {
    encoding: "utf8", env: { ...process.env, DATABASE_URL: url.toString(), ...extra },
  });
  return result;
}

async function fails(work, status) {
  await assert.rejects(work, (error) => error.status === status);
}

async function main() {
  assert.match(database, /^nha_xe_admin_verify_\d+$/);
  await control.$executeRawUnsafe(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  created = true;
  const deployed = command([require.resolve("prisma/build/index.js"), "migrate", "deploy"]);
  assert.equal(deployed.status, 0, deployed.stderr);
  console.log("✓ Fresh database: all migrations applied.");

  const seeded = command(["prisma/seed.js"], { SEED_PASSWORD: "test-password-123" });
  assert.equal(seeded.status, 0, seeded.stderr);
  const seededCount = await prisma.booking.count();
  const reseeded = command(["prisma/seed.js"], { SEED_PASSWORD: "test-password-123" });
  assert.notEqual(reseeded.status, 0);
  assert.equal(await prisma.booking.count(), seededCount);
  const seedAdmin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  assert.equal(await verifyPassword("test-password-123", seedAdmin.password), true);
  console.log("✓ Seed hashes passwords and refuses to overwrite existing data.");

  const admin = await users.createUser({ fullName: "Test Admin", phone: "0999000001", password: "admin-test-123", role: "ADMIN", isActive: true });
  assert.equal("password" in admin, false);
  const stored = await prisma.user.findUnique({ where: { id: admin.id } });
  assert.equal(await verifyPassword("admin-test-123", stored.password), true);
  await fails(() => users.updateUserRole(admin.id, "USER", admin.id), 409);
  await fails(() => users.updateUser(admin.id, { isActive: false }, admin.id), 409);
  await fails(() => users.deleteUser(admin.id, admin.id), 409);
  const guest = await users.createUser({ fullName: "Test Guest", phone: "0999000002", password: "guest-test-123", role: "USER", isActive: true });
  const updated = await users.updateUser(guest.id, { fullName: "Guest Updated", password: "changed-123", isActive: false }, admin.id);
  assert.equal(updated.isActive, false);
  assert.equal("password" in updated, false);
  assert.equal(await verifyPassword("changed-123", (await prisma.user.findUnique({ where: { id: guest.id } })).password), true);
  await users.deleteUser(guest.id, admin.id);
  console.log("✓ Accounts: hash, safe responses, updates, lock, delete, self-protection.");

  const bus = await buses.createBus({ plate: "99B-123.45", type: "Giường nằm", capacity: 22, status: "Đang hoạt động", year: null });
  assert.equal((await buses.updateBus(bus.id, { capacity: 30 })).capacity, 30);
  assert.equal((await buses.updateBusStatus(bus.id, "Bảo dưỡng")).status, "Bảo dưỡng");
  const busStats = await buses.queryBuses({ search: "99B-123.45" });
  assert.equal(busStats.stats.total, 1);
  assert.equal(busStats.stats.maintenance, 1);
  await assert.rejects(() => buses.createBus({ plate: "99B-123.45", type: "Giường nằm", capacity: 22, status: "Đang hoạt động" }), { code: "P2002" });
  assert.equal(await buses.deleteBus(bus.id), true);
  const employee = await employees.createEmployee({ name: "Test Employee", email: "staff-test@example.test", phone: "0999000003", role: "Tài xế", department: "Đội xe", startDate: "2026-10-01" });
  assert.equal((await employees.updateEmployee(employee.id, { name: "Employee Updated" })).name, "Employee Updated");
  assert.equal((await employees.updateEmployeeStatus(employee.id, "Nghỉ phép")).status, "Nghỉ phép");
  const employeeStats = await employees.queryEmployees({ search: employee.id });
  assert.equal(employeeStats.stats.total, 1);
  assert.equal(employeeStats.stats.onLeave, 1);
  assert.equal(await employees.deleteEmployee(employee.id), true);
  console.log("✓ Bus and employee CRUD, statuses, duplicate handling, filtered statistics.");

  const tripBus = await buses.createBus({ plate: "99B-123.46", type: "Ghế ngồi", capacity: 3, status: "Đang hoạt động" });
  const replacementBus = await buses.createBus({ plate: "99B-123.47", type: "Ghế ngồi", capacity: 3, status: "Đang hoạt động" });
  const largerBus = await buses.createBus({ plate: "99B-123.48", type: "Ghế ngồi", capacity: 4, status: "Đang hoạt động" });
  const smallerBus = await buses.createBus({ plate: "99B-123.49", type: "Ghế ngồi", capacity: 2, status: "Đang hoạt động" });
  const dispatchDriver = await employees.createEmployee({ name: "Dispatch Driver", email: "dispatch-driver@example.test", phone: "0999000011", role: "Tài xế", department: "Đội xe" });
  const departure = new Date(Date.now() + 86400000);
  const assignment = { time: departure, endsAt: new Date(departure.getTime() + 3600000), status: "OPEN", busId: tripBus.id, driverId: dispatchDriver.id };
  const trip = await trips.createTrip({ from: "Test Origin", to: "Test Destination", ...assignment, price: 100000 });
  assert.equal(typeof trip.id, "number");
  assert.equal("code" in trip, false);
  assert.equal((await trips.getTripById(trip.id)).id, trip.id);
  const input = { tripId: trip.id, seats: ["a1"], fullName: "Passenger One", phone: "0999000004" };
  await fails(() => bookings.createBooking({ ...input, tripId: String(trip.id) }), 400);
  await fails(() => bookings.createBooking({ ...input, seats: ["A1", "A01"] }), 400);
  await fails(() => bookings.createBooking({ ...input, seats: ["A02"] }), 400);
  const race = await Promise.allSettled([bookings.createBooking(input), bookings.createBooking(input)]);
  assert.equal(race.filter((result) => result.status === "fulfilled").length, 1);
  const first = race.find((result) => result.status === "fulfilled").value;
  assert.equal(first.seats[0], "A01");
  assert.equal(first.tripId, trip.id);
  assert.equal("tripCode" in first, false);
  assert.ok(first.pnr.startsWith(`NHAXE-${trip.id}-`));
  assert.deepEqual(await trips.getBookedSeats(trip.id), ["A01"]);
  assert.equal((await prisma.trip.findUnique({ where: { id: trip.id } })).availableSeats, 2);
  const firstId = first.bookingIds[0];
  assert.equal((await prisma.booking.findUnique({ where: { id: firstId } })).status, "PENDING");
  const lookup = await bookings.getBookings({ pnr: first.pnr, phone: input.phone });
  assert.equal(lookup.length, 1);
  assert.equal(lookup[0].user.fullName, "Passenger One");
  assert.equal("password" in lookup[0].user, false);
  await fails(() => bookings.getBookings({}), 400);
  console.log("✓ Booking: canonical seats, schema capacity, concurrency, pending payment, safe PNR lookup.");

  await Promise.all([orders.updateOrderStatus(firstId, "CANCELLED"), orders.updateOrderStatus(firstId, "CANCELLED")]);
  assert.equal((await prisma.trip.findUnique({ where: { id: trip.id } })).availableSeats, 3);
  const replacement = await bookings.createBooking({ ...input, fullName: "Passenger Replacement" });
  await fails(() => orders.updateOrderStatus(firstId, "PENDING"), 409);
  assert.equal((await prisma.trip.findUnique({ where: { id: trip.id } })).availableSeats, 2);
  await orders.updateOrderStatus(replacement.bookingIds[0], "CANCELLED");
  await orders.updateOrderStatus(firstId, "PENDING");
  await orders.updateOrderStatus(firstId, "CONFIRMED", admin.id);
  const paid = await prisma.booking.findUnique({ where: { id: firstId } });
  assert.ok(paid.confirmedAt);
  await orders.updateOrderStatus(firstId, "CONFIRMED", admin.id);
  assert.equal((await prisma.booking.findUnique({ where: { id: firstId } })).confirmedAt.getTime(), paid.confirmedAt.getTime());
  await fails(() => orders.updateOrderStatus(firstId, "PENDING"), 409);
  await fails(() => trips.updateTrip(trip.id, { from: "Changed Origin" }), 409);
  await fails(() => trips.updateTrip(trip.id, { busId: largerBus.id }), 409);
  await fails(() => buses.updateBus(tripBus.id, { capacity: 4 }), 409);
  await fails(() => buses.deleteBus(tripBus.id), 409);
  await trips.updateTrip(trip.id, { price: 200000, busId: replacementBus.id });
  assert.equal((await trips.getTripById(trip.id)).busId, replacementBus.id);
  assert.equal((await prisma.booking.findUnique({ where: { id: firstId } })).totalPrice, 100000);
  await fails(() => trips.deleteTrip(trip.id), 409);
  await fails(() => users.deleteUser(paid.userId, admin.id), 409);
  const orderStats = await orders.queryOrdersAdmin({ tripId: trip.id });
  assert.equal(orderStats.stats.total, 2);
  assert.equal(orderStats.stats.totalRevenue, 100000);
  await orders.deleteOrder(firstId);
  assert.ok(await prisma.booking.findUnique({ where: { id: firstId } }));
  assert.equal((await prisma.trip.findUnique({ where: { id: trip.id } })).availableSeats, 3);
  console.log("✓ Cancel/restore: idempotency, occupied-seat rejection, payment transitions, history and revenue.");

  const multi = await bookings.createBooking({ ...input, seats: ["B01", "C01"] });
  assert.equal((await bookings.getBookings({ pnr: multi.pnr, phone: input.phone })).length, 2);
  await fails(() => trips.updateTrip(trip.id, { busId: smallerBus.id }), 409);
  const snapshot = await prisma.booking.findUnique({ where: { id: multi.bookingIds[0] } });
  await users.updateUser(snapshot.userId, { fullName: "Renamed Account" }, admin.id);
  await fails(() => users.updateUser(snapshot.userId, { phone: "0999000005" }, admin.id), 409);
  assert.equal((await orders.getOrderById(snapshot.id)).user.fullName, "Passenger One");
  assert.equal((await orders.getOrderById(snapshot.id)).user.phone, "0999000004");
  const tripStats = await trips.queryTripsAdmin({ search: String(trip.id) });
  assert.equal(tripStats.stats.total, 1);
  assert.equal(tripStats.stats.totalBookings, 2);
  assert.equal(tripStats.stats.avgOccupancy, 67);
  console.log("✓ Multi-seat PNR, passenger snapshots, safe capacity edits, filtered trip statistics.");

  const heldDeparture = new Date(departure.getTime() + 7200000);
  const heldTrip = await trips.createTrip({ from: "Hold Origin", to: "Hold Destination", ...assignment, time: heldDeparture, endsAt: new Date(heldDeparture.getTime() + 3600000), price: 100000 });
  await holds.holdSeat(heldTrip.id, "a1", "client-one");
  await fails(() => holds.holdSeat(heldTrip.id, "A01", "client-two"), 409);
  await fails(() => bookings.createBooking({ ...input, tripId: heldTrip.id }), 409);
  await fails(() => holds.holdSeat(heldTrip.id, "A02", "client-one"), 400);
  const owned = await bookings.createBooking({ ...input, tripId: heldTrip.id, holdOwnerKey: "client-one" });
  assert.equal(await prisma.seatHold.count({ where: { tripId: heldTrip.id } }), 0);
  await orders.updateOrderStatus(owned.bookingIds[0], "CANCELLED");
  await holds.holdSeat(heldTrip.id, "C01", "client-one");
  await fails(() => trips.updateTrip(heldTrip.id, { busId: smallerBus.id }), 409);
  await holds.releaseSeat(heldTrip.id, "c1", "client-one");
  const highSeat = await bookings.createBooking({ ...input, tripId: heldTrip.id, seats: ["C01"] });
  await orders.updateOrderStatus(highSeat.bookingIds[0], "CANCELLED");
  await fails(() => trips.updateTrip(heldTrip.id, { busId: smallerBus.id }), 409);
  await orders.updateOrderStatus(highSeat.bookingIds[0], "PENDING");
  assert.equal((await trips.getTripById(heldTrip.id)).availableSeats, 2);
  console.log("✓ Holds: canonical codes, ownership and historical seat maps remain valid when unsafe bus swaps are refused.");

  await prisma.customer.create({ data: { id: "CUS-TEST", name: "Customer Test", email: "customer-test@example.test", phone: "0999000006" } });
  const customer = await prisma.user.create({ data: { fullName: "Customer Test", phone: "0999000006", password: stored.password, role: "CUSTOMER" } });
  await users.updateUser(customer.id, { fullName: "Customer Updated", phone: "0999000007", isActive: false }, admin.id);
  const profile = await prisma.customer.findUnique({ where: { phone: "0999000007" } });
  assert.equal(profile.name, "Customer Updated");
  assert.equal(profile.status, "Ngừng hoạt động");
  await fails(() => users.updateUserRole(customer.id, "ADMIN", admin.id), 409);
  assert.equal((await users.queryUsers({ role: "CUSTOMER" })).stats.users, 1);
  console.log("✓ Customer account updates synchronize profile and activity status.");

  const secondAdmin = await users.createUser({ fullName: "Second Admin", phone: "0999000008", password: "second-admin-123", role: "ADMIN", isActive: true });
  await prisma.user.update({ where: { id: seedAdmin.id }, data: { isActive: false } });
  const roleRace = await Promise.allSettled([
    users.updateUserRole(secondAdmin.id, "USER", admin.id),
    users.updateUserRole(admin.id, "USER", secondAdmin.id),
  ]);
  assert.equal(roleRace.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(await prisma.user.count({ where: { role: "ADMIN", isActive: true } }), 1);
  console.log("✓ Concurrent role changes preserve the last active administrator.");

  const constraints = await prisma.$queryRawUnsafe("SELECT COUNT(*) AS total FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_TYPE = 'CHECK'");
  assert.ok(Number(constraints[0].total) >= 3);
  const difference = command([require.resolve("prisma/build/index.js"), "migrate", "diff", "--from-schema-datasource", "prisma/schema.prisma", "--to-schema-datamodel", "prisma/schema.prisma", "--script"]);
  assert.equal(difference.status, 0, difference.stderr);
  assert.equal(difference.stdout.replace(/--[^\n]*/g, "").trim(), "");
  console.log("✓ Database schema matches Prisma; foreign keys, unique indexes and checks are present.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => {
  await prisma.$disconnect();
  if (created && /^nha_xe_admin_verify_\d+$/.test(database)) {
    await control.$executeRawUnsafe(`DROP DATABASE \`${database}\``);
    console.log("Temporary verification database removed.");
  }
  await control.$disconnect();
});
