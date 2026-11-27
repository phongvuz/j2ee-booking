// Explicit integration command: creates only uniquely named local demo databases.
// It deliberately leaves those databases in place for inspection; never drops.
const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { randomBytes, scryptSync, timingSafeEqual } = require("node:crypto");
require("dotenv").config({ quiet: true });
const { PrismaClient } = require("@prisma/client");
const { parseArguments, createConfiguration, accounts } = require("../scripts/demo.cjs");
const database = `sgu_booking_demo_qa_${Date.now()}_${randomBytes(3).toString("hex")}`;
const configuration = createConfiguration(parseArguments(["--database", database, "--no-start"]), process.env);
const root = path.resolve(__dirname, "..");
const target = new PrismaClient({ datasources: { db: { url: configuration.targetUrl } }, log: [] });
const control = new PrismaClient({ datasources: { db: { url: configuration.controlUrl } }, log: [] });

function runDemo(name) {
  return spawnSync(process.execPath, ["scripts/demo.cjs", "--database", name, "--no-start"], { cwd: root, env: process.env, encoding: "utf8" });
}

async function main() {
  const first = runDemo(database);
  assert.equal(first.status, 0, "Fresh demo provisioning failed; connection details are intentionally suppressed.");
  const version = await target.$queryRawUnsafe("SELECT VERSION() AS version");
  console.log(`Database engine: ${version[0].version}`);
  const users = await target.user.findMany({ orderBy: { id: "asc" } });
  assert.deepEqual(users.map((user) => user.role), ["ADMIN", "CUSTOMER"]);
  for (const user of users) {
    const [, salt, stored] = user.password.split(":");
    assert.equal(timingSafeEqual(scryptSync(process.env.DEMO_PASSWORD || "Demo@12345", salt, 64), Buffer.from(stored, "hex")), true);
  }
  const profile = await target.customer.findUnique({ where: { phone: accounts.customer } });
  assert.equal(profile.email, accounts.email);
  assert.equal(profile.status, "Đang hoạt động");
  assert.equal(await target.trip.count({ where: { time: { gt: new Date() } } }), 6);
  assert.equal(await target.bus.count(), 2);
  assert.equal(await target.employee.count(), 1);
  assert.equal(await target.booking.count(), 1);
  const booking = await target.booking.findFirst();
  const trip = await target.trip.findUnique({ where: { id: booking.tripId }, include: { bus: true } });
  assert.equal(trip.availableSeats, trip.bus.capacity - 1);
  assert.equal("capacity" in trip, false);
  const constraints = await target.$queryRawUnsafe("SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND CONSTRAINT_TYPE = 'CHECK'");
  assert.equal(constraints.length, 6);
  const foreignKey = await target.$queryRawUnsafe("SELECT UPDATE_RULE FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'booking' AND REFERENCED_TABLE_NAME = 'trip'");
  assert.equal(foreignKey[0].UPDATE_RULE, "RESTRICT");
  await assert.rejects(() => target.bus.update({ where: { id: trip.busId }, data: { capacity: 0 } }));
  await assert.rejects(() => target.trip.update({ where: { id: trip.id }, data: { availableSeats: 61 } }));
  await assert.rejects(() => target.trip.update({ where: { id: trip.id }, data: { busId: "MISSING-BUS" } }));
  await assert.rejects(() => target.bus.delete({ where: { id: trip.busId } }));
  await assert.rejects(() => target.booking.update({ where: { id: booking.id }, data: { activeSeat: null } }));
  await assert.rejects(() => target.booking.update({ where: { id: booking.id }, data: { totalPrice: -1 } }));
  await assert.rejects(() => target.booking.update({ where: { id: booking.id }, data: { status: "UNKNOWN" } }));
  await assert.rejects(() => target.booking.update({ where: { id: booking.id }, data: { userId: 2147483647 } }));
  await assert.rejects(() => target.booking.create({ data: {
    seatNumber: booking.seatNumber, activeSeat: booking.activeSeat, totalPrice: booking.totalPrice,
    userId: booking.userId, tripId: booking.tripId, status: "CONFIRMED",
  } }), { code: "P2002" });
  console.log("PASS: ADMIN/CUSTOMER seed, password hashes, bus-backed trips, history, unique indexes, FK and all six CHECK constraints.");

  const added = await target.trip.create({ data: { from: "QA preserve", to: "QA destination", time: new Date(Date.now() + 86400000), price: 100000, busId: trip.busId, availableSeats: trip.bus.capacity } });
  const originalHash = users[0].password;
  const again = runDemo(database);
  assert.equal(again.status, 0, "Owned demo reuse failed.");
  assert.equal(await target.trip.count(), 7);
  assert.equal((await target.trip.findUnique({ where: { id: added.id } })).from, "QA preserve");
  assert.equal((await target.user.findUnique({ where: { id: users[0].id } })).password, originalHash);
  console.log("PASS: repeating the provisioning command preserves added records and existing account hashes.");

  const foreignName = `${database}_unowned`;
  await control.$executeRawUnsafe(`CREATE DATABASE \`${foreignName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  const foreignUrl = new URL(configuration.targetUrl);
  foreignUrl.pathname = `/${foreignName}`;
  const foreign = new PrismaClient({ datasources: { db: { url: foreignUrl.toString() } }, log: [] });
  try {
    await foreign.$executeRawUnsafe("CREATE TABLE `preserve_me` (`id` INTEGER PRIMARY KEY)");
    await foreign.$executeRawUnsafe("INSERT INTO `preserve_me` (`id`) VALUES (42)");
    const refused = runDemo(foreignName);
    assert.notEqual(refused.status, 0);
    const sentinel = await foreign.$queryRawUnsafe("SELECT `id` FROM `preserve_me`");
    assert.deepEqual(sentinel, [{ id: 42 }]);
    const tables = await foreign.$queryRawUnsafe("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()");
    assert.equal(tables.length, 1);
  } finally { await foreign.$disconnect(); }
  assert.notEqual(runDemo("sgu-booking").status, 0);
  console.log("PASS: existing unowned demo database and application database name are refused without modification.");
  console.log(`Retained isolated QA databases: ${database}; ${foreignName}. No database was deleted.`);
}

main().catch(() => {
  console.error("Demo DB verification failed; credentials are suppressed and isolated test databases were retained.");
  process.exitCode = 1;
}).finally(() => Promise.all([target.$disconnect(), control.$disconnect()]));
