// Upgrade a dispatched legacy database without touching the application's data.
require("dotenv/config");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { randomBytes } = require("node:crypto");
const { spawnSync } = require("node:child_process");
const { PrismaClient } = require("@prisma/client");
const { ensureTripBusRelation } = require("../scripts/setup-trip-buses.cjs");
const { load } = require("./load-ts.cjs");

const source = new URL(process.env.DATABASE_URL);
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(source.hostname));
const database = `sgu_trip_bus_dispatch_verify_${Date.now()}_${randomBytes(3).toString("hex")}`;
const target = new URL(source);
target.pathname = `/${database}`;
const control = new PrismaClient();
const prisma = new PrismaClient({ datasources: { db: { url: target.toString() } } });
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "sgu-trip-bus-dispatch-"));
const schemaPath = path.join(scratch, "legacy.prisma");
const json = (value) => JSON.stringify(value, (_, item) => typeof item === "bigint" ? item.toString() : item);
let created = false;

async function preservedRows() {
  const records = {};
  for (const table of ["booking", "BookingTransaction", "Payment", "employee", "user", "SeatHold", "_prisma_migrations"]) {
    records[table] = await prisma.$queryRawUnsafe(`SELECT * FROM \`${table}\` ORDER BY id`);
  }
  return records;
}

async function main() {
  let schema = fs.readFileSync(path.resolve("prisma/schema.prisma"), "utf8").replaceAll("\r\n", "\n");
  schema = schema.replace(/^model trip \{[\s\S]*?^\}/gm, (model) => model
    .replace(/busId\s+String\b/, "busId          String?\n  capacity       Int")
    .replace(/(\s+bus\s+)bus(\s+@relation)/, "$1bus?$2")
    .replace("onUpdate: Restrict", "onUpdate: Cascade")
    .replace(/^\s*@@index\(\[busId\],[^\n]*$/gm, ""))
    .replace(/^model bus \{[\s\S]*?^\}/gm, (model) => model.replace(/capacity\s+Int/, "seats           Int"));
  fs.writeFileSync(schemaPath, schema);
  await control.$executeRawUnsafe(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  created = true;
  const pushed = spawnSync(process.execPath, [require.resolve("prisma/build/index.js"), "db", "push", "--schema", schemaPath, "--skip-generate"], {
    env: { ...process.env, DATABASE_URL: target.toString() }, encoding: "utf8", windowsHide: true,
  });
  assert.equal(pushed.status, 0, pushed.error?.message || pushed.stderr || pushed.stdout);
  await prisma.$executeRawUnsafe("ALTER TABLE trip DROP FOREIGN KEY trip_busId_fkey");
  await prisma.$executeRawUnsafe("ALTER TABLE trip ADD CONSTRAINT trip_busId_fkey FOREIGN KEY (busId) REFERENCES bus(id) ON DELETE NO ACTION ON UPDATE CASCADE");
  await prisma.$executeRawUnsafe("CREATE TABLE _prisma_migrations (id VARCHAR(36) PRIMARY KEY, migration_name VARCHAR(255) NOT NULL, checksum VARCHAR(64) NOT NULL)");
  await prisma.$executeRawUnsafe("INSERT INTO _prisma_migrations VALUES ('fixture-history','20261107000000_finance_and_dispatch','unchanged-history')");
  await prisma.$executeRawUnsafe("INSERT INTO bus (id,plate,type,seats,status,createdAt) VALUES ('BUS-EXISTING','99B-123.45','Ghế ngồi',3,'Đang hoạt động',CURRENT_TIMESTAMP(3))");
  const driver = await prisma.employee.create({ data: { id: "EMP-EXISTING", name: "Dispatch fixture", email: "fixture@example.test", phone: "0999000042", role: "Tài xế", department: "Đội xe", startDate: "2026-01-01" } });
  const time = new Date(Date.now() + 86400000);
  const endsAt = new Date(time.getTime() + 3600000);
  await prisma.$executeRawUnsafe("INSERT INTO trip (id,`from`,`to`,time,endsAt,status,price,capacity,availableSeats,busId,driverId,createdAt) VALUES (1,'Origin','Destination',?,?,'OPEN',100000,3,2,'BUS-EXISTING',?,CURRENT_TIMESTAMP(3)),(2,'Legacy','Destination',?,NULL,'DRAFT',100000,23,23,NULL,NULL,CURRENT_TIMESTAMP(3))", time, endsAt, driver.id, time);
  const user = await prisma.user.create({ data: { fullName: "Fixture passenger", phone: "0999000043", password: "fixture-unusable", role: "USER" } });
  const booking = await prisma.booking.create({ data: { tripId: 1, userId: user.id, seatNumber: "A01", activeSeat: "1:A01", pnr: "PRESERVE-LEDGER", status: "CONFIRMED", totalPrice: 100000, confirmedAt: new Date() } });
  await prisma.bookingTransaction.create({ data: { bookingId: booking.id, kind: "RECEIPT", amount: 100000, method: "CASH", reference: "PRESERVED-RECEIPT" } });
  await prisma.payment.create({ data: { id: "PAYMENT-PRESERVED", pnr: booking.pnr, amount: 100000, checkoutUrl: "https://example.test/fixture", expiresAt: endsAt } });
  await prisma.seatHold.create({ data: { tripId: 2, seatNumber: "C01", clientId: "fixture-hold", expiresAt: endsAt } });
  const before = json(await preservedRows());
  const beforeTrips = await prisma.$queryRawUnsafe("SELECT id,`from`,`to`,time,endsAt,status,driverId,busId,price,availableSeats,createdAt FROM trip ORDER BY id");
  const options = { backupDirectory: path.join(scratch, "backups") };
  const preview = await ensureTripBusRelation(prisma, { ...options, checkOnly: true });
  assert.deepEqual(preview.assignments.map((bus) => bus.tripId), [2]);
  assert.equal(json(await preservedRows()), before);
  // A fresh connection exercises MySQL's first-versus-cached SHOW CREATE labels.
  await prisma.$disconnect();
  const result = await ensureTripBusRelation(prisma, options);
  assert.equal(result.createdBusCount, 1);
  assert.ok(fs.existsSync(result.backupPath));
  assert.equal(json(await preservedRows()), before);
  const afterTrips = await prisma.$queryRawUnsafe("SELECT id,`from`,`to`,time,endsAt,status,driverId,busId,price,availableSeats,createdAt FROM trip ORDER BY id");
  assert.equal(json(afterTrips), json(beforeTrips.map((trip) => ({ ...trip, busId: trip.busId ?? `LEGACY-TRIP-${trip.id}` }))));
  const buses = await prisma.bus.findMany({ orderBy: { id: "asc" } });
  assert.deepEqual(buses.map((bus) => [bus.id, bus.capacity]), [["BUS-EXISTING", 3], ["LEGACY-TRIP-2", 23]]);
  assert.equal(buses[1].status, "Ngừng hoạt động");
  const foreign = await prisma.$queryRawUnsafe("SELECT DELETE_RULE AS onDelete, UPDATE_RULE AS onUpdate FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND CONSTRAINT_NAME='trip_busId_fkey'");
  assert.deepEqual(foreign, [{ onDelete: "RESTRICT", onUpdate: "RESTRICT" }]);
  assert.equal((await ensureTripBusRelation(prisma, options)).changed, false);
  assert.equal(json(await preservedRows()), before);
  // Recover if an earlier run stopped between the two constraint replacements.
  await prisma.$executeRawUnsafe("ALTER TABLE trip DROP FOREIGN KEY trip_busId_fkey, ADD CONSTRAINT trip_busId_upgrade_fkey FOREIGN KEY (busId) REFERENCES bus(id) ON DELETE RESTRICT ON UPDATE RESTRICT");
  const resumed = await ensureTripBusRelation(prisma, options);
  assert.equal(resumed.changed, true);
  assert.equal(resumed.createdBusCount, 0);
  assert.equal(json(await preservedRows()), before);
  assert.equal((await ensureTripBusRelation(prisma, options)).changed, false);
  const trips = load("services/tripService.ts", { "@/lib/prisma": { prisma } });
  assert.equal((await trips.queryTripsAdmin({})).pagination.total, 2);
  console.log("PASS: dispatched legacy schema upgrades with assignments, schedules, ledger, payments, bookings, holds and migration history intact; rerun is a no-op.");
}

main().catch((error) => {
  console.error(error.message.replace(/mysql:\/\/[^\s"'<>]+/gi, "[redacted]"));
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
  if (created && /^sgu_trip_bus_dispatch_verify_\d+_[a-f0-9]+$/.test(database)) await control.$executeRawUnsafe(`DROP DATABASE \`${database}\``);
  await control.$disconnect();
  const actual = fs.realpathSync(scratch);
  const temporaryRoot = fs.realpathSync(os.tmpdir());
  assert.ok(actual.startsWith(temporaryRoot + path.sep) && path.basename(actual).startsWith("sgu-trip-bus-dispatch-"));
  fs.rmSync(actual, { recursive: true, force: true });
});
