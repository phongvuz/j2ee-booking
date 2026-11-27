const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { ensureNumericTripIds } = require("../scripts/setup-trips.cjs");

function temporaryDirectory(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "sgu-trip-unit-"));
  t.after(() => {
    const absolute = path.resolve(directory);
    assert.ok(absolute.startsWith(path.resolve(os.tmpdir()) + path.sep));
    assert.ok(path.basename(absolute).startsWith("sgu-trip-unit-"));
    fs.rmSync(absolute, { recursive: true, force: true });
  });
  return directory;
}

function setup({ code = true, columns, foreignKeys = [], triggers = [], views = [], indexes, onAlter } = {}) {
  const normalColumns = [
    { name: "id", type: "int", nullable: "NO", extra: "auto_increment" },
    { name: "code", type: "varchar", nullable: "NO", extra: "" },
    ...["from", "to"].map((name) => ({ name, type: "varchar", nullable: "NO", extra: "" })),
    ...["time", "createdAt"].map((name) => ({ name, type: "datetime", nullable: "NO", extra: "" })),
    ...["price", "capacity", "availableSeats"].map((name) => ({ name, type: "int", nullable: "NO", extra: "" })),
  ];
  let hasCode = code;
  const selectedColumns = columns ?? normalColumns;
  const queries = [];
  const ddl = [];
  const rows = [{ id: 7, code: "LEGACY-007", from: "Sài Gòn", to: "Đà Lạt", capacity: 22, note: "preserve extra column", externalNumber: 42n }];
  const prisma = {
    $queryRawUnsafe: async (query) => {
      queries.push(query);
      if (query.includes("information_schema.COLUMNS")) {
        if (query.includes("COLUMN_NAME = 'code'")) return hasCode ? [{ name: "code" }] : [];
        return selectedColumns.filter((column) => hasCode || column.name !== "code");
      }
      if (query.includes("information_schema.KEY_COLUMN_USAGE")) return foreignKeys;
      if (query.includes("information_schema.TRIGGERS")) return triggers;
      if (query.includes("information_schema.VIEWS") || query.includes("information_schema.VIEW_TABLE_USAGE")) return views;
      if (query.startsWith("SHOW INDEX")) return indexes ?? [
        { Key_name: "PRIMARY", Column_name: "id", Non_unique: 0 },
        { Key_name: "Trip_code_key", Column_name: "code", Non_unique: 0 },
      ];
      if (query.startsWith("SHOW CREATE TABLE")) return [{ Table: "trip", "Create Table": "CREATE TABLE trip (id INT PRIMARY KEY AUTO_INCREMENT, code VARCHAR(191) NOT NULL)" }];
      if (query.startsWith("SELECT * FROM `trip`")) return rows;
      throw new Error(`Unexpected query: ${query}`);
    },
    $transaction: async (work, options) => {
      assert.equal(options.isolationLevel, "RepeatableRead");
      return work(prisma);
    },
    $executeRawUnsafe: async (query) => {
      assert.equal(query, "ALTER TABLE `trip` DROP COLUMN `code`");
      if (onAlter) await onAlter();
      ddl.push(query);
      hasCode = false;
      return 0;
    },
  };
  return { prisma, queries, ddl, rows, normalColumns };
}

test("trip repair persists schema, rows and the old code mapping before DDL and reruns without changes", async (t) => {
  const directory = temporaryDirectory(t);
  const s = setup({ onAlter: () => {
    const files = fs.readdirSync(directory);
    assert.equal(files.length, 1);
    const backup = JSON.parse(fs.readFileSync(path.join(directory, files[0]), "utf8"));
    assert.equal(backup.purpose, "numeric-trip-id");
    assert.match(backup.schema[0]["Create Table"], /code VARCHAR/);
    assert.deepEqual(backup.legacyCodes, [{ id: 7, code: "LEGACY-007" }]);
    assert.equal(backup.rows[0].note, "preserve extra column");
    assert.equal(backup.rows[0].externalNumber, "42");
  } });
  const first = await ensureNumericTripIds(s.prisma, { backupDirectory: directory });
  assert.equal(first.changed, true);
  assert.equal(path.dirname(first.backupPath), directory);
  assert.equal(s.ddl.length, 1);
  assert.deepEqual(await ensureNumericTripIds(s.prisma, { backupDirectory: directory }), { changed: false });
  assert.equal(s.ddl.length, 1);
  assert.equal(fs.readdirSync(directory).length, 1);
  assert.equal(s.queries.some((query) => /_prisma_migrations/.test(query)), false);
});

test("a compatible numeric trip table is a no-op without creating backup files", async (t) => {
  const directory = temporaryDirectory(t);
  const s = setup({ code: false });
  assert.deepEqual(await ensureNumericTripIds(s.prisma, { backupDirectory: directory }), { changed: false });
  assert.equal(s.ddl.length, 0);
  assert.deepEqual(fs.readdirSync(directory), []);
});

test("trip repair stops on incomplete schema, incompatible IDs and unexpected code types", async (t) => {
  const directory = temporaryDirectory(t);
  const { normalColumns } = setup();
  for (const columns of [
    normalColumns.filter((column) => column.name !== "capacity"),
    normalColumns.map((column) => column.name === "id" ? { ...column, type: "varchar" } : column),
    normalColumns.map((column) => column.name === "id" ? { ...column, extra: "" } : column),
    normalColumns.map((column) => column.name === "code" ? { ...column, type: "int" } : column),
    normalColumns.map((column) => column.name === "capacity" ? { ...column, type: "varchar" } : column),
    normalColumns.map((column) => column.name === "availableSeats" ? { ...column, nullable: "YES" } : column),
  ]) {
    const s = setup({ columns });
    await assert.rejects(ensureNumericTripIds(s.prisma, { backupDirectory: directory }));
    assert.equal(s.ddl.length, 0);
  }
  assert.deepEqual(fs.readdirSync(directory), []);
});

test("foreign-key dependencies, composite or primary code indexes and triggers stop repair before backup", async (t) => {
  const directory = temporaryDirectory(t);
  for (const options of [
    { foreignKeys: [{ name: "booking_legacy_code_fk" }] },
    { indexes: [{ Key_name: "PRIMARY", Column_name: "code" }] },
    { indexes: [{ Key_name: "custom_index", Column_name: "code" }, { Key_name: "custom_index", Column_name: "from" }] },
    { triggers: [{ name: "legacy_trip_trigger" }] },
    { views: [{ name: "legacy_trip_view" }] },
  ]) {
    const s = setup(options);
    await assert.rejects(ensureNumericTripIds(s.prisma, { backupDirectory: directory }));
    assert.equal(s.ddl.length, 0);
  }
  assert.deepEqual(fs.readdirSync(directory), []);
});

test("trip repair never executes DDL when the backup cannot be persisted", async (t) => {
  const directory = temporaryDirectory(t);
  const blocker = path.join(directory, "file-instead-of-directory");
  fs.writeFileSync(blocker, "keep this file");
  const s = setup();
  await assert.rejects(ensureNumericTripIds(s.prisma, { backupDirectory: blocker }));
  assert.equal(s.ddl.length, 0);
  assert.equal(fs.readFileSync(blocker, "utf8"), "keep this file");
});
