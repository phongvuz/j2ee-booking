const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { scryptSync, timingSafeEqual } = require("node:crypto");
const { parseArguments, createConfiguration, createDemoSchema, schemaFingerprint, createSeedData, generatedClientMatches, ensureGeneratedClient, provisionDemo, accounts, purpose } = require("../scripts/demo.cjs");

function configuration(database = "sgu_booking_demo_unit") {
  return createConfiguration(parseArguments(["--database", database, "--no-start"]), { DATABASE_URL: "mysql://unit:private@localhost:3306/application" });
}

function mockDatabase({ exists = true, marker, markerError = false } = {}) {
  const writes = [];
  const reads = [];
  const clients = [];
  class PrismaClient {
    constructor({ datasources }) { this.control = new URL(datasources.db.url).pathname === "/mysql"; clients.push(this); }
    async $queryRawUnsafe(query) {
      reads.push(query);
      if (this.control) return exists ? [{ SCHEMA_NAME: "sgu_booking_demo_unit" }] : [];
      if (markerError) throw new Error("No marker table");
      return marker ?? [];
    }
    async $executeRawUnsafe(query) { writes.push(query); }
    async $disconnect() { this.disconnected = true; }
  }
  return { PrismaClient, writes, reads, clients };
}

test("demo names reject existing application names, SQL fragments, paths and oversized identifiers before connection", () => {
  for (const name of ["sgu-booking", "sgu_booking_v2", "mysql", "sgu_booking_demo;DROP DATABASE x", "sgu_booking_demo/other", "SGU_BOOKING_DEMO", "sgu_booking_demo_", `sgu_booking_demo_${"x".repeat(60)}`]) {
    assert.throws(() => parseArguments(["--database", name]));
  }
  assert.equal(parseArguments([]).database, "sgu_booking_demo");
  assert.equal(parseArguments(["--database", "sgu_booking_demo_qa_123"]).database, "sgu_booking_demo_qa_123");
  assert.throws(() => parseArguments(["--port", "80"]));
  assert.throws(() => parseArguments(["--port", "NaN"]));
  assert.throws(() => parseArguments(["--database"]));
});

test("configuration derives a loopback control URL and distinct target without changing source env", () => {
  const environment = { DATABASE_URL: "mysql://unit:private@127.0.0.1:3306/sgu-booking?connection_limit=3", SESSION_SECRET: "original", PAYMENT_DEMO_ENABLED: "false" };
  const original = { ...environment };
  const result = createConfiguration(parseArguments([]), environment);
  assert.deepEqual(environment, original);
  assert.equal(new URL(result.controlUrl).pathname, "/mysql");
  assert.equal(new URL(result.targetUrl).pathname, "/sgu_booking_demo");
  assert.equal(result.childEnvironment.DATABASE_URL, result.targetUrl);
  assert.equal(result.childEnvironment.NODE_ENV, "development");
  assert.equal(result.childEnvironment.SGU_DEMO, "true");
  assert.equal(result.childEnvironment.PAYMENT_DEMO_ENABLED, "true");
  assert.match(result.childEnvironment.SESSION_SECRET, /^[a-f0-9]{64}$/);
  assert.notEqual(result.childEnvironment.SESSION_SECRET, environment.SESSION_SECRET);
  assert.throws(() => createConfiguration(parseArguments([]), { DATABASE_URL: "mysql://unit:private@db.example.test/app" }), /only connects/);
  assert.throws(() => createConfiguration(parseArguments([]), { DATABASE_URL: "postgres://localhost/app" }), /only connects/);
  assert.throws(() => createConfiguration(parseArguments([]), { DATABASE_URL: "mysql://localhost/sgu_booking_demo" }), /matches the configured source/);
});

test("demo snapshot restricts updates only on the CHECK-dependent relation, preserving source schema", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../prisma/schema.prisma"), "utf8");
  const snapshot = createDemoSchema(source);
  assert.equal(snapshot.includes("onDelete: Restrict, onUpdate: Restrict, map: \"Booking_tripId_fkey\""), true);
  assert.equal(snapshot.includes("onDelete: Cascade)"), true);
  assert.equal(source.includes('onDelete: Restrict, map: "Booking_tripId_fkey"'), true);
  assert.equal(source.includes('onUpdate: Restrict, map: "trip_busId_fkey"'), true);
  assert.equal(createDemoSchema(source), snapshot);
  assert.throws(() => createDemoSchema("model unrelated {}"), /relation changed/);
});

const smallSchema = "model user {\n  id Int @id\n  name String?\n  bookings booking[]\n}\nmodel booking {\n  id Int @id\n}\n";
function smallClient() {
  return { PrismaClient: class {}, Prisma: { dmmf: { datamodel: { models: [
    { name: "user", fields: [
      { name: "id", type: "Int", isRequired: true, isList: false },
      { name: "name", type: "String", isRequired: false, isList: false },
      { name: "bookings", type: "booking", isRequired: true, isList: true },
    ] },
    { name: "booking", fields: [{ name: "id", type: "Int", isRequired: true, isList: false }] },
  ] } } } };
}

test("matching generated schema and full DMMF skip generation, including Windows line endings", () => {
  let generated = false;
  const client = smallClient();
  const result = ensureGeneratedClient({}, { source: smallSchema, readGeneratedSchema: () => `\r\n${smallSchema.replaceAll("\n", "\r\n")}\r\n`, loadClient: () => client, generate: () => { generated = true; } });
  assert.equal(result, client);
  assert.equal(generated, false);
});

test("missing and stale generated schemas trigger regeneration before the client is loaded", () => {
  for (const initial of [null, smallSchema.replace("name String?", "oldField String?")]) {
    let generated = false;
    let loaded = 0;
    const client = smallClient();
    const result = ensureGeneratedClient({}, {
      source: smallSchema,
      readGeneratedSchema: () => generated ? smallSchema : initial,
      generate: () => { assert.equal(loaded, 0); generated = true; },
      loadClient: () => { loaded++; return client; },
    });
    assert.equal(result, client);
    assert.equal(generated, true);
    assert.equal(loaded, 1);
  }
});

test("matching schema file alone cannot hide missing constructor, stale fields/types or broken client", () => {
  const malformed = [smallClient(), smallClient(), smallClient(), { PrismaClient: null }, null];
  malformed[0].Prisma.dmmf.datamodel.models[0].fields.pop();
  malformed[1].Prisma.dmmf.datamodel.models[0].fields[0].type = "String";
  malformed[2].Prisma.dmmf.datamodel.models[0].fields[1].isRequired = true;
  for (const client of malformed) assert.equal(generatedClientMatches(smallSchema, smallSchema, client), false);
  assert.throws(() => ensureGeneratedClient({}, { source: smallSchema, readGeneratedSchema: () => smallSchema, loadClient: () => { throw new Error("missing client"); }, generate: () => {} }), /does not match/);
  const locked = new Error("engine locked");
  assert.throws(() => ensureGeneratedClient({}, { source: smallSchema, readGeneratedSchema: () => null, generate: () => { throw locked; } }), (error) => error === locked);
});

test("seed includes usable ADMIN and CUSTOMER hashes, matching customer profile, future trips and capacity", () => {
  const now = new Date("2026-11-06T12:00:00Z");
  const data = createSeedData(now);
  assert.deepEqual(data.users.map((user) => user.role), ["ADMIN", "CUSTOMER"]);
  assert.equal(data.customer.phone, accounts.customer);
  assert.equal(data.customer.email, accounts.email);
  assert.equal(data.users[1].phone, data.customer.phone);
  for (const user of data.users) {
    const [algorithm, salt, hash] = user.password.split(":");
    assert.equal(algorithm, "scrypt");
    assert.equal(timingSafeEqual(scryptSync("Demo@12345", salt, 64), Buffer.from(hash, "hex")), true);
  }
  assert.equal(data.trips.length, 6);
  const buses = new Map(data.buses.map((bus) => [bus.id, bus]));
  assert.equal(data.trips.every((trip) => trip.time > now && trip.availableSeats === buses.get(trip.busId).capacity && trip.price > 0), true);
  assert.equal(data.trips.every((trip) => !Object.hasOwn(trip, "capacity")), true);
  assert.equal(new Set(data.trips.map((trip) => buses.get(trip.busId).capacity)).size, 2);
  assert.equal(data.trips.every((trip) => trip.status === "OPEN" && trip.endsAt > trip.time && trip.driverId === data.employee.id), true);
});

test("existing database without an owned schema marker is never changed or pushed", async () => {
  for (const options of [{ markerError: true }, { marker: [] }, { marker: [{ purpose: "foreign", schemaHash: "x" }] }]) {
    const database = mockDatabase(options);
    let pushed = false;
    await assert.rejects(() => provisionDemo(configuration(), { PrismaClient: database.PrismaClient, applySchema: () => { pushed = true; } }), /already exists|no matching/);
    assert.equal(pushed, false);
    assert.deepEqual(database.writes, []);
    assert.equal(database.clients.every((client) => client.disconnected), true);
  }
});

test("owned existing demo with matching schema is reused without any writes or seed", async () => {
  const schema = createDemoSchema(fs.readFileSync(path.resolve(__dirname, "../prisma/schema.prisma"), "utf8"));
  const database = mockDatabase({ marker: [{ purpose, schemaHash: schemaFingerprint(schema) }] });
  const result = await provisionDemo(configuration(), { PrismaClient: database.PrismaClient, applySchema: () => { assert.fail("must not push schema on reuse"); } });
  assert.deepEqual(result, { created: false, database: "sgu_booking_demo_unit" });
  assert.deepEqual(database.writes, []);
  assert.equal(database.clients.every((client) => client.disconnected), true);
});

test("provisioning failure preserves the new database and cannot issue destructive SQL", async () => {
  const database = mockDatabase({ exists: false });
  let snapshot;
  await assert.rejects(() => provisionDemo(configuration(), { PrismaClient: database.PrismaClient, applySchema: (args, environment) => {
    snapshot = args[3];
    assert.equal(fs.existsSync(snapshot), true);
    assert.equal(environment.DATABASE_URL, configuration().targetUrl);
    assert.equal(args.includes("--accept-data-loss"), false);
    assert.equal(args.includes("--force-reset"), false);
    throw new Error("test schema failure");
  } }), /test schema failure/);
  assert.deepEqual(database.writes, ["CREATE DATABASE `sgu_booking_demo_unit` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"]);
  assert.equal(fs.existsSync(snapshot), false);
  assert.equal(database.clients.every((client) => client.disconnected), true);
});

test("mutation boundary refuses a caller that bypasses CLI name or target URL validation", async () => {
  const database = mockDatabase({ exists: false });
  await assert.rejects(() => provisionDemo({ ...configuration(), database: "sgu-booking" }, database));
  await assert.rejects(() => provisionDemo({ ...configuration(), targetUrl: "mysql://localhost/sgu-booking" }, database));
  await assert.rejects(() => provisionDemo({ ...configuration(), childEnvironment: { DATABASE_URL: "mysql://localhost/sgu-booking" } }, database));
  await assert.rejects(() => provisionDemo({ ...configuration(), controlUrl: "mysql://elsewhere/mysql" }, database));
  assert.deepEqual(database.writes, []);
  assert.equal(database.clients.length, 0);
});
