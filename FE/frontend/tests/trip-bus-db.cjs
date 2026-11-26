// Exercise both the forward SQL migration and the imported-database repair on
// isolated local databases. No writes target DATABASE_URL's application database.
require("dotenv/config");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { randomBytes } = require("node:crypto");
const { PrismaClient } = require("@prisma/client");
const { createConfiguration, parseArguments } = require("../scripts/demo.cjs");
const { ensureTripBusRelation, migrationName } = require("../scripts/setup-trip-buses.cjs");

const root = path.resolve(__dirname, "..");
const sourceSchema = fs.readFileSync(path.join(root, "prisma/schema.prisma"), "utf8").replaceAll("\r\n", "\n");
// Construct the supported legacy datamodel: capacity belongs to trip, seats to
// bus, and no bus assignment exists. All other current models remain unchanged.
const legacySchema = sourceSchema
  .replace(/model trip \{([\s\S]*?)\n\}/, (_, body) => "model trip {" + body
    .replace(/^\s*busId\s+String\s*$/m, "  capacity       Int")
    .replace(/^.*bus\s+bus\s+@relation[^\n]*\n/m, "")
    .replace(/^.*@@index\(\[busId(?:\]|,)[^\n]*$/gm, "") + "\n}")
  .replace(/model bus \{([\s\S]*?)\n\}/, (_, body) => "model bus {" + body
    .replace(/\bcapacity\s+Int/, "seats           Int")
    .replace(/^.*trips\s+trip\[\][^\n]*$/m, "") + "\n}");
assert.ok(legacySchema.includes("seats           Int"));
assert.equal(/busId\s+String/.test(legacySchema), false);

const databases = [];
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "sgu-trip-bus-db-"));
const schemaPath = path.join(scratch, "legacy.prisma");
fs.writeFileSync(schemaPath, legacySchema);
const json = (value) => JSON.stringify(value, (_, item) => typeof item === "bigint" ? item.toString() : item);

async function snapshot(prisma) {
  const columns = await prisma.$queryRawUnsafe("SHOW COLUMNS FROM trip");
  const projection = columns.map(({ Field }) => {
    assert.match(Field, /^[A-Za-z0-9_]+$/);
    return "`" + Field + "`";
  }).join(",");
  return {
    trips: await prisma.$queryRawUnsafe(`SELECT ${projection} FROM trip ORDER BY id`),
    bookings: await prisma.$queryRawUnsafe("SELECT * FROM booking ORDER BY id"),
    holds: await prisma.$queryRawUnsafe("SELECT * FROM SeatHold ORDER BY id"),
  };
}

async function fixture(prisma) {
  await prisma.$executeRawUnsafe("INSERT INTO bus (id,plate,type,seats,status,createdAt) VALUES ('EXISTING-BUS','51B-12345','Limousine',22,'Đang hoạt động',CURRENT_TIMESTAMP(3))");
  const time = new Date(Date.now() + 7 * 86400000);
  await prisma.$executeRawUnsafe("INSERT INTO trip (id,`from`,`to`,time,price,capacity,availableSeats,createdAt) VALUES (1,'Legacy origin','Legacy destination',?,100000,3,2,CURRENT_TIMESTAMP(3)),(2,'Other origin','Other destination',?,200000,23,23,CURRENT_TIMESTAMP(3))", time, time);
  const user = await prisma.user.create({ data: { fullName: "Migration fixture", phone: "0999000041", password: "fixture-only-unusable", role: "USER" } });
  await prisma.booking.create({ data: { id: 1, tripId: 1, userId: user.id, seatNumber: "A01", activeSeat: "1:A01", pnr: "MIGRATION-PRESERVE", status: "CONFIRMED", totalPrice: 100000 } });
  // Cancelled history can refer to a seat outside today's seat map; preserve it.
  await prisma.booking.create({ data: { id: 2, tripId: 1, userId: user.id, seatNumber: "C07", pnr: "CANCELLED-HISTORY", status: "CANCELLED", totalPrice: 100000 } });
  await prisma.seatHold.create({ data: { tripId: 2, seatNumber: "C01", clientId: "migration-owner", expiresAt: new Date(Date.now() + 300000) } });
  await prisma.$executeRawUnsafe("ALTER TABLE trip ADD CONSTRAINT trip_seat_counts_check CHECK (capacity BETWEEN 1 AND 60 AND availableSeats BETWEEN 0 AND capacity)");
}

async function verify(prisma, before, sample) {
  const after = await snapshot(prisma);
  assert.equal(json(after.bookings), json(before.bookings));
  assert.equal(json(after.holds), json(before.holds));
  const withoutCapacity = before.trips.map(({ capacity, ...trip }) => trip);
  const withoutBus = after.trips.map(({ busId, ...trip }) => trip);
  assert.equal(json(withoutBus), json(withoutCapacity));
  const trips = await prisma.trip.findMany({ orderBy: { id: "asc" }, include: { bus: true } });
  assert.deepEqual(trips.map((trip) => trip.bus.capacity), [3, 23]);
  assert.deepEqual(trips.map((trip) => trip.availableSeats), [2, 23]);
  assert.equal(trips.every((trip) => trip.bus.status === (sample ? "Đang hoạt động" : "Ngừng hoạt động")), true);
  assert.equal((await prisma.bus.findUnique({ where: { id: "EXISTING-BUS" } })).capacity, 22);
  assert.equal(await prisma.bus.count(), 3);
  const columns = await prisma.$queryRawUnsafe("SELECT TABLE_NAME AS tableName,COLUMN_NAME AS name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('trip','bus')");
  assert.equal(columns.some((column) => column.tableName === "trip" && column.name === "capacity"), false);
  assert.equal(columns.some((column) => column.tableName === "bus" && column.name === "seats"), false);
  assert.ok(columns.some((column) => column.tableName === "bus" && column.name === "capacity"));
  await assert.rejects(prisma.bus.delete({ where: { id: trips[0].busId } }), { code: "P2003" });
  await assert.rejects(prisma.trip.update({ where: { id: 2 }, data: { busId: "MISSING-BUS" } }), { code: "P2003" });
  await assert.rejects(prisma.bus.update({ where: { id: trips[0].busId }, data: { capacity: 0 } }));
  await assert.rejects(prisma.trip.update({ where: { id: 2 }, data: { availableSeats: -1 } }));
  const again = await ensureTripBusRelation(prisma, { backupDirectory: path.join(scratch, "backups"), sampleBuses: sample });
  assert.equal(again.changed, false);
  assert.equal(again.createdBusCount, 0);
  assert.equal(await prisma.bus.count(), 3);
}

async function run(sample) {
  const name = `sgu_booking_demo_bus_migration_${Date.now()}_${randomBytes(3).toString("hex")}`;
  const config = createConfiguration(parseArguments(["--database", name, "--no-start"]), process.env);
  const control = new PrismaClient({ datasources: { db: { url: config.controlUrl } } });
  const prisma = new PrismaClient({ datasources: { db: { url: config.targetUrl } } });
  try {
    await control.$executeRawUnsafe(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    databases.push(name);
    const pushed = spawnSync(process.execPath, [require.resolve("prisma/build/index.js"), "db", "push", "--schema", schemaPath, "--skip-generate"], {
      cwd: root, env: { ...process.env, DATABASE_URL: config.targetUrl }, encoding: "utf8", windowsHide: true,
    });
    assert.equal(pushed.status, 0, pushed.error?.message || pushed.stderr || pushed.stdout);
    await fixture(prisma);
    const before = await snapshot(prisma);
    if (sample) {
      const preview = await ensureTripBusRelation(prisma, { checkOnly: true, sampleBuses: true });
      assert.equal(preview.createdBusCount, 2);
      assert.equal(json(await snapshot(prisma)), json(before));
      assert.equal(await prisma.bus.count(), 1);
      // Exercise recovery after an interrupted, additive migration stage.
      await prisma.$executeRawUnsafe("ALTER TABLE bus RENAME COLUMN seats TO capacity");
      await prisma.$executeRawUnsafe("ALTER TABLE trip ADD COLUMN busId VARCHAR(191) NULL");
      const result = await ensureTripBusRelation(prisma, { backupDirectory: path.join(scratch, "backups"), sampleBuses: true });
      assert.equal(result.createdBusCount, 2);
      assert.ok(fs.existsSync(result.backupPath));
      const backup = JSON.parse(fs.readFileSync(result.backupPath, "utf8"));
      assert.equal(backup.purpose, migrationName);
      assert.equal(backup.tables.booking.rows.length, 2);
    } else {
      const databaseUrl = new URL(config.targetUrl);
      const executable = process.env.MYSQL_CLIENT || "C:/Program Files/MySQL/MySQL Server 8.0/bin/mysql.exe";
      const migrated = spawnSync(executable, ["--host=" + databaseUrl.hostname, "--port=" + (databaseUrl.port || "3306"), "--protocol=TCP", "--user=" + decodeURIComponent(databaseUrl.username), "--default-character-set=utf8mb4", name], {
        cwd: root, env: { ...process.env, MYSQL_PWD: decodeURIComponent(databaseUrl.password) },
        input: fs.readFileSync(path.join(root, "prisma/admin-migrations", migrationName, "migration.sql")),
        encoding: "utf8", windowsHide: true,
      });
      assert.equal(migrated.status, 0, migrated.error?.code || migrated.stderr);
    }
    await verify(prisma, before, sample);
    console.log(`PASS: ${sample ? "repair with active sample buses + interrupted-stage recovery" : "forward SQL with explicit legacy placeholders"}; capacities, bookings, holds, availability, FK/CHECK and idempotency preserved.`);
  } finally { await Promise.all([prisma.$disconnect(), control.$disconnect()]); }
}

(async () => {
  await run(false);
  await run(true);
  console.log("Retained isolated verification databases: " + databases.join(", "));
})().catch((error) => {
  console.error(error.message.replace(/mysql:\/\/[^\s"'<>]+/gi, "[redacted]"));
  process.exitCode = 1;
});
