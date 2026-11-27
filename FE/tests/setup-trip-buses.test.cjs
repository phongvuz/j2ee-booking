const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { ensureTripBusRelation, validateSchema, validateData, createBackfillBus } = require("../scripts/setup-trip-buses.cjs");

function fixture({ migrated = false } = {}) {
  const columns = [];
  for (const [tableName, names] of [["trip", ["id", "from", "to", "time", "price", "availableSeats", "createdAt"]], ["bus", ["id", "plate", "type", "status", "notes", "createdAt"]]]) {
    for (const name of names) columns.push({ tableName, name, type: ["id", "availableSeats"].includes(name) && tableName === "trip" ? "int" : "varchar", columnType: "int", length: 191, collation: "utf8mb4_unicode_ci", nullable: "NO" });
  }
  columns.push({ tableName: "bus", name: migrated ? "capacity" : "seats", type: "int", nullable: "NO" });
  if (migrated) columns.push({ tableName: "trip", name: "busId", type: "varchar", length: 191, collation: "utf8mb4_unicode_ci", nullable: "NO" });
  else columns.push({ tableName: "trip", name: "capacity", type: "int", nullable: "NO" });
  const schema = {
    columns,
    checks: migrated ? [
      { tableName: "bus", name: "bus_capacity_check", clause: "(`capacity` between 1 and 60)" },
      { tableName: "trip", name: "trip_seat_counts_check", clause: "(`availableSeats` between 0 and 60)" },
    ] : [],
    keys: migrated ? [{ tableName: "trip", name: "trip_busId_fkey", columnName: "busId", referencedTable: "bus", referencedColumn: "id", deleteRule: "RESTRICT", updateRule: "RESTRICT" }] : [],
    indexes: migrated ? [{ tableName: "trip", name: "trip_busId_idx", columnName: "busId", position: 1 }] : [],
  };
  const trip = { id: 14, from: "A", to: "B", price: 100000, availableSeats: 2, ...(migrated ? { busId: "SAMPLE-TRIP-14" } : { capacity: 3 }) };
  const snapshot = {
    bus: { rows: migrated ? [createBackfillBus({ id: 14, capacity: 3 }, { sampleBuses: true })] : [], schema: [] },
    trip: { rows: [trip], schema: [] },
    booking: { rows: [{ id: 1, tripId: 14, seatNumber: "A01", status: "CONFIRMED", activeSeat: "14:A01", totalPrice: 100000 }], schema: [] },
    SeatHold: { rows: [], schema: [] },
  };
  return { schema, snapshot };
}

function mockDatabase(schema, snapshot) {
  const writes = [];
  const prisma = {
    async $queryRawUnsafe(sql) {
      if (sql.includes("information_schema.COLUMNS")) return structuredClone(schema.columns);
      if (sql.includes("information_schema.CHECK_CONSTRAINTS")) return structuredClone(schema.checks);
      if (sql.includes("information_schema.KEY_COLUMN_USAGE")) return structuredClone(schema.keys);
      if (sql.includes("information_schema.STATISTICS")) return structuredClone(schema.indexes);
      if (sql.includes("information_schema.TRIGGERS")) return [];
      if (sql.startsWith("SHOW COLUMNS FROM")) {
        const table = /`([^`]+)`/.exec(sql)[1];
        const names = schema.columns.filter((column) => column.tableName === table).map((column) => column.name);
        return (names.length ? names : Object.keys(snapshot[table].rows[0] || { id: 1 })).map((Field) => ({ Field }));
      }
      const table = /(?:SHOW CREATE TABLE|FROM) `([^`]+)`/.exec(sql)?.[1];
      if (table && snapshot[table]) return structuredClone(sql.startsWith("SHOW CREATE") ? snapshot[table].schema : snapshot[table].rows);
      throw new Error(`Unexpected read: ${sql}`);
    },
    async $executeRawUnsafe(sql) { writes.push(sql); throw new Error("Unexpected write"); },
    async $transaction(callback) { return callback(prisma); },
  };
  return { prisma, writes };
}

test("backfill preserves each unusual legacy capacity and only creates active illustrative buses when requested", () => {
  for (const capacity of [3, 23, 30, 34]) {
    const legacy = createBackfillBus({ id: 14, capacity });
    assert.equal(legacy.id, "LEGACY-TRIP-14");
    assert.equal(legacy.status, "Ngừng hoạt động");
    assert.equal(legacy.capacity, capacity);
    const sample = createBackfillBus({ id: 14, capacity }, { sampleBuses: true });
    assert.equal(sample.id, "SAMPLE-TRIP-14");
    assert.equal(sample.plate, "50F-90014");
    assert.equal(sample.status, "Đang hoạt động");
    assert.equal(sample.capacity, capacity);
    assert.match(sample.notes, /minh họa/);
  }
  assert.equal(createBackfillBus({ id: 1, capacity: 22 }, { sampleBuses: true }).type, "Limousine");
  assert.equal(createBackfillBus({ id: 1, capacity: 34 }, { sampleBuses: true }).type, "Giường nằm");
  assert.throws(() => createBackfillBus({ id: 10000, capacity: 22 }, { sampleBuses: true }), /biển số mẫu/);
});

test("schema validation accepts legacy and target shapes but refuses ambiguous capacity, foreign keys and indexes", () => {
  for (const migrated of [false, true]) {
    const { schema } = fixture({ migrated });
    const state = validateSchema(schema);
    assert.equal(state.legacyTripCapacity, !migrated);
    assert.equal(state.legacyBusSeats, !migrated);
  }
  const changes = [
    (schema) => schema.columns.push({ tableName: "bus", name: "capacity", type: "int", nullable: "NO" }),
    (schema) => { schema.columns = schema.columns.filter((column) => !(column.tableName === "trip" && column.name === "id")); },
    (schema) => { schema.columns.find((column) => column.tableName === "bus" && column.name === "id").collation = "unsafe;SQL"; },
    (schema) => schema.indexes.push({ tableName: "trip", name: "custom", columnName: "capacity", position: 1 }),
    (schema) => schema.keys.push({ tableName: "trip", name: "custom_fk", columnName: "busId", referencedTable: "bus", referencedColumn: "id", deleteRule: "CASCADE", updateRule: "CASCADE" }),
  ];
  for (const change of changes) {
    const { schema } = fixture();
    change(schema);
    assert.throws(() => validateSchema(schema));
  }
});

test("data preflight refuses accounting errors, out-of-map seats, or a conflicting sample identity before migration", () => {
  const changes = [
    (snapshot) => { snapshot.trip.rows[0].availableSeats = 3; },
    (snapshot) => { snapshot.booking.rows[0].seatNumber = "B02"; },
    (snapshot) => { snapshot.bus.rows.push({ id: "SAMPLE-TRIP-14", plate: "51B-123.45", seats: 3 }); },
    (snapshot) => { snapshot.bus.rows.push({ id: "ANOTHER", plate: "50F-90014", seats: 3 }); },
    (snapshot) => { snapshot.trip.rows[0].busId = "MISSING"; },
    (snapshot) => { snapshot.trip.rows[0].busId = "BUS-1"; snapshot.bus.rows.push({ id: "BUS-1", plate: "51B-123.45", seats: 4 }); },
  ];
  for (const change of changes) {
    const { schema, snapshot } = fixture();
    change(snapshot);
    assert.throws(() => validateData(snapshot, validateSchema(schema), { sampleBuses: true }));
  }
  const { schema, snapshot } = fixture();
  assert.doesNotThrow(() => validateData(snapshot, validateSchema(schema), { sampleBuses: true }));
});

test("dispatch imports retain known bus assignments and plan only missing assignments", async (t) => {
  const { schema, snapshot } = fixture();
  schema.columns.push({ tableName: "trip", name: "busId", type: "varchar", length: 191, collation: "utf8mb4_unicode_ci", nullable: "YES" });
  schema.keys.push({ tableName: "trip", name: "trip_busId_fkey", columnName: "busId", referencedTable: "bus", referencedColumn: "id", deleteRule: "NO ACTION", updateRule: "CASCADE" });
  schema.indexes.push({ tableName: "trip", name: "trip_busId_time_endsAt_idx", columnName: "busId", position: 1 });
  snapshot.bus.rows.push({ id: "BUS-EXISTING", plate: "51B-123.45", seats: 3 });
  snapshot.trip.rows[0].busId = "BUS-EXISTING";
  snapshot.trip.rows.push({ ...snapshot.trip.rows[0], id: 15, availableSeats: 3, busId: null });
  const state = validateSchema(schema);
  assert.doesNotThrow(() => validateData(snapshot, state));
  const { prisma, writes } = mockDatabase(schema, snapshot);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "sgu-trip-bus-dispatch-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const plan = await ensureTripBusRelation(prisma, { checkOnly: true, backupDirectory: directory });
  assert.equal(plan.changed, true);
  assert.equal(plan.createdBusCount, 1);
  assert.equal(plan.assignments[0].tripId, 15);
  assert.equal(plan.assignments[0].id, "LEGACY-TRIP-15");
  assert.equal(plan.assignments[0].status, "Ngừng hoạt động");
  assert.deepEqual(writes, []);
  assert.deepEqual(fs.readdirSync(directory), []);
});

test("a required dispatch FK with CASCADE still needs conversion on an otherwise migrated database", async () => {
  const { schema, snapshot } = fixture({ migrated: true });
  schema.keys[0].updateRule = "CASCADE";
  const { prisma, writes } = mockDatabase(schema, snapshot);
  const plan = await ensureTripBusRelation(prisma, { checkOnly: true });
  assert.equal(plan.changed, true);
  assert.equal(plan.createdBusCount, 0);
  assert.deepEqual(writes, []);
});

test("check-only planning returns the exact active sample assignment without writing a backup or executing SQL mutations", async (t) => {
  const { schema, snapshot } = fixture();
  const { prisma, writes } = mockDatabase(schema, snapshot);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "sgu-trip-bus-plan-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const result = await ensureTripBusRelation(prisma, { checkOnly: true, sampleBuses: true, backupDirectory: directory });
  assert.equal(result.changed, true);
  assert.equal(result.createdBusCount, 1);
  assert.deepEqual(result.assignments[0], { tripId: 14, ...createBackfillBus({ id: 14, capacity: 3 }, { sampleBuses: true }) });
  assert.deepEqual(writes, []);
  assert.deepEqual(fs.readdirSync(directory), []);
});

test("a migrated database is a no-op on rerun and backup persistence failure prevents the first DDL statement", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "sgu-trip-bus-backup-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const target = fixture({ migrated: true });
  const complete = mockDatabase(target.schema, target.snapshot);
  const result = await ensureTripBusRelation(complete.prisma, { backupDirectory: directory });
  assert.equal(result.changed, false);
  assert.equal(result.createdBusCount, 0);
  assert.deepEqual(complete.writes, []);
  assert.deepEqual(fs.readdirSync(directory), []);
  const legacy = fixture();
  const pending = mockDatabase(legacy.schema, legacy.snapshot);
  const blocker = path.join(directory, "file-not-directory");
  fs.writeFileSync(blocker, "prevent backup directory creation");
  await assert.rejects(ensureTripBusRelation(pending.prisma, { backupDirectory: blocker, sampleBuses: true }));
  assert.deepEqual(pending.writes, []);
});
