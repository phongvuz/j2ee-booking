// Verify only a newly created database. Never modify the application's records.
require("dotenv/config");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { PrismaClient } = require("@prisma/client");
const { ensureNumericTripIds } = require("../scripts/setup-trips.cjs");
const { load } = require("./load-ts.cjs");

const database = `nha_xe_trip_setup_verify_${Date.now()}`;
const control = new PrismaClient();
const url = new URL(process.env.DATABASE_URL);
url.pathname = `/${database}`;
url.searchParams.set("connection_limit", "1");
const prisma = new PrismaClient({ datasources: { db: { url: url.toString() } } });
const backupDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "sgu-trip-db-"));
let created = false;

async function main() {
  assert.match(database, /^nha_xe_trip_setup_verify_\d+$/);
  await control.$executeRawUnsafe(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  created = true;
  await prisma.$executeRawUnsafe("CREATE TABLE trip (id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, code VARCHAR(191) NOT NULL, `from` VARCHAR(191) NOT NULL, `to` VARCHAR(191) NOT NULL, time DATETIME(3) NOT NULL, price INT NOT NULL, capacity INT NOT NULL, availableSeats INT NOT NULL, createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), extraNotes TEXT NULL, UNIQUE INDEX Trip_code_key (code))");
  await prisma.$executeRawUnsafe("CREATE TABLE booking (id INT PRIMARY KEY, tripId INT NOT NULL, pnr VARCHAR(191) NOT NULL, CONSTRAINT booking_trip_fk FOREIGN KEY (tripId) REFERENCES trip (id))");
  await prisma.$executeRawUnsafe("CREATE TABLE SeatHold (id INT PRIMARY KEY, tripId INT NOT NULL, seatNumber VARCHAR(10) NOT NULL, CONSTRAINT hold_trip_fk FOREIGN KEY (tripId) REFERENCES trip (id))");
  await prisma.$executeRawUnsafe("CREATE TABLE unrelated_audit (id INT PRIMARY KEY, note VARCHAR(191) NOT NULL)");
  await prisma.$executeRawUnsafe("INSERT INTO trip (id, code, `from`, `to`, time, price, capacity, availableSeats, extraNotes) VALUES (7, 'OLD-007', 'Sài Gòn', 'Đà Lạt', '2030-01-01 01:00:00', 100000, 22, 21, 'existing route note'), (18, 'OLD-018', 'Sài Gòn', 'Nha Trang', '2030-01-02 01:00:00', 200000, 34, 34, 'keep another note')");
  await prisma.$executeRawUnsafe("INSERT INTO booking (id, tripId, pnr) VALUES (11, 7, 'NHAXE-OLD-007-111')");
  await prisma.$executeRawUnsafe("INSERT INTO SeatHold (id, tripId, seatNumber) VALUES (12, 18, 'A01')");
  await prisma.$executeRawUnsafe("INSERT INTO unrelated_audit (id, note) VALUES (1, 'keep unrelated data')");

  const initialTrips = await prisma.$queryRawUnsafe("SELECT * FROM trip ORDER BY id");
  const initialBookings = await prisma.$queryRawUnsafe("SELECT * FROM booking ORDER BY id");
  const initialHolds = await prisma.$queryRawUnsafe("SELECT * FROM SeatHold ORDER BY id");
  const initialAudit = await prisma.$queryRawUnsafe("SELECT * FROM unrelated_audit ORDER BY id");
  const service = load("services/tripService.ts", { "@/lib/prisma": { prisma } });
  const input = { from: "Sài Gòn", to: "Cần Thơ", time: new Date(Date.now() + 86_400_000), price: 150000, capacity: 22 };
  await assert.rejects(service.createTrip(input), (error) => error.code === "P2011");
  console.log("PASS: the legacy required code column reproduces Prisma P2011 on trip creation.");

  await prisma.$executeRawUnsafe("CREATE TABLE legacy_trip_reference (id INT PRIMARY KEY, tripCode VARCHAR(191) NOT NULL, CONSTRAINT legacy_code_fk FOREIGN KEY (tripCode) REFERENCES trip (code))");
  await prisma.$executeRawUnsafe("INSERT INTO legacy_trip_reference (id, tripCode) VALUES (1, 'OLD-007')");
  await assert.rejects(ensureNumericTripIds(prisma, { backupDirectory }), /khóa ngoại/);
  assert.deepEqual(fs.readdirSync(backupDirectory), []);
  assert.deepEqual(await prisma.$queryRawUnsafe("SELECT * FROM trip ORDER BY id"), initialTrips);
  await prisma.$executeRawUnsafe("DROP TABLE legacy_trip_reference");

  const repaired = await ensureNumericTripIds(prisma, { backupDirectory });
  assert.equal(repaired.changed, true);
  const backup = JSON.parse(fs.readFileSync(repaired.backupPath, "utf8"));
  assert.deepEqual(backup.legacyCodes, [{ id: 7, code: "OLD-007" }, { id: 18, code: "OLD-018" }]);
  assert.deepEqual(backup.rows, JSON.parse(JSON.stringify(initialTrips)));
  const createTableSql = Object.values(backup.schema[0]).find((value) => typeof value === "string" && value.startsWith("CREATE TABLE"));
  assert.match(createTableSql, /`code` varchar/);
  // Use explicit columns after DDL: an existing prepared SELECT * can retain old field metadata.
  const currentTripQuery = "SELECT id, `from`, `to`, time, price, capacity, availableSeats, createdAt, extraNotes FROM trip ORDER BY id";
  assert.deepEqual(await prisma.$queryRawUnsafe(currentTripQuery), initialTrips.map((trip) => {
    const preserved = { ...trip };
    delete preserved.code;
    return preserved;
  }));
  assert.deepEqual(await prisma.$queryRawUnsafe("SELECT * FROM booking ORDER BY id"), initialBookings);
  assert.deepEqual(await prisma.$queryRawUnsafe("SELECT * FROM SeatHold ORDER BY id"), initialHolds);
  assert.deepEqual(await prisma.$queryRawUnsafe("SELECT * FROM unrelated_audit ORDER BY id"), initialAudit);
  assert.deepEqual(await prisma.$queryRawUnsafe("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '_prisma_migrations'"), []);
  console.log("PASS: repair preserves trip IDs, extra columns, bookings, PNRs, seat holds and unrelated data, with an old-code backup.");

  const createdTrip = await service.createTrip(input);
  assert.ok(createdTrip.id > 18);
  assert.equal(createdTrip.capacity, 22);
  assert.equal(createdTrip.availableSeats, 22);
  assert.equal("code" in createdTrip, false);
  const afterCreation = await prisma.$queryRawUnsafe(currentTripQuery);
  assert.deepEqual(await ensureNumericTripIds(prisma, { backupDirectory }), { changed: false });
  assert.equal(fs.readdirSync(backupDirectory).length, 1);
  assert.deepEqual(await prisma.$queryRawUnsafe(currentTripQuery), afterCreation);
  console.log("PASS: trip creation works after repair; a second repair is a no-op and does not reset history.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => {
  await prisma.$disconnect();
  if (created && /^nha_xe_trip_setup_verify_\d+$/.test(database)) {
    await control.$executeRawUnsafe(`DROP DATABASE \`${database}\``);
    console.log("Temporary trip verification database removed.");
  }
  await control.$disconnect();
  const absolute = path.resolve(backupDirectory);
  assert.ok(absolute.startsWith(path.resolve(os.tmpdir()) + path.sep));
  assert.ok(path.basename(absolute).startsWith("sgu-trip-db-"));
  fs.rmSync(absolute, { recursive: true, force: true });
});
