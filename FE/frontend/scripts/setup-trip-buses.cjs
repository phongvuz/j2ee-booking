const fs = require("node:fs");
const path = require("node:path");
const { randomBytes, createHash } = require("node:crypto");

const migrationName = "20261106010000_trip_bus_relation";
const legacyPrefix = "LEGACY-TRIP-";
const legacyType = "Xe chưa xác minh";
const legacyStatus = "Ngừng hoạt động";
const legacyNote = (trip) => `Bản ghi chuyển đổi cho chuyến ${trip.id}. Chưa xác minh xe thực tế; không phải biển số xe. Giữ nguyên sức chứa cũ: ${trip.capacity}.`;
const stringify = (value) => JSON.stringify(value, (_, item) => typeof item === "bigint" ? item.toString() : item);
const fail = (message) => { throw new Error(message); };
const busForeignKeyName = "trip_busId_fkey";
const temporaryBusForeignKeyName = "trip_busId_upgrade_fkey";
const isTargetBusForeignKey = (key) => key?.name === busForeignKeyName && key.deleteRule === "RESTRICT" && key.updateRule === "RESTRICT";

function createBackfillBus(trip, { sampleBuses = false } = {}) {
  if (!sampleBuses) return { id: `${legacyPrefix}${trip.id}`, plate: `${legacyPrefix}${trip.id}`, type: legacyType, capacity: trip.capacity, status: legacyStatus, notes: legacyNote(trip) };
  const suffix = 90000 + trip.id;
  if (!Number.isSafeInteger(suffix) || suffix > 99999) fail("ID chuyến vượt dải biển số mẫu; cần cung cấp ánh xạ xe cụ thể.");
  return {
    id: `SAMPLE-TRIP-${trip.id}`, plate: `50F-${suffix}`,
    type: trip.capacity === 22 ? "Limousine" : trip.capacity === 34 ? "Giường nằm" : "Xe ghế ngồi",
    capacity: trip.capacity, status: "Đang hoạt động",
    notes: `Xe mẫu được tạo theo yêu cầu cho chuyến ${trip.id}, giữ nguyên sức chứa ${trip.capacity} ghế. Biển số là dữ liệu minh họa; cần xác minh trước khi sử dụng thực tế.`,
  };
}

async function inspectTripBusSchema(prisma) {
  const columns = await prisma.$queryRawUnsafe("SELECT TABLE_NAME AS tableName, COLUMN_NAME AS name, DATA_TYPE AS type, COLUMN_TYPE AS columnType, CHARACTER_MAXIMUM_LENGTH AS length, COLLATION_NAME AS collation, IS_NULLABLE AS nullable FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('trip', 'bus')");
  const checks = await prisma.$queryRawUnsafe("SELECT tc.TABLE_NAME AS tableName, tc.CONSTRAINT_NAME AS name, cc.CHECK_CLAUSE AS clause FROM information_schema.TABLE_CONSTRAINTS tc JOIN information_schema.CHECK_CONSTRAINTS cc ON cc.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA AND cc.CONSTRAINT_NAME = tc.CONSTRAINT_NAME WHERE tc.CONSTRAINT_SCHEMA = DATABASE() AND tc.TABLE_NAME IN ('trip', 'bus') AND tc.CONSTRAINT_TYPE = 'CHECK'");
  const keys = await prisma.$queryRawUnsafe("SELECT k.TABLE_NAME AS tableName, k.CONSTRAINT_NAME AS name, k.COLUMN_NAME AS columnName, k.REFERENCED_TABLE_NAME AS referencedTable, k.REFERENCED_COLUMN_NAME AS referencedColumn, r.DELETE_RULE AS deleteRule, r.UPDATE_RULE AS updateRule FROM information_schema.KEY_COLUMN_USAGE k LEFT JOIN information_schema.REFERENTIAL_CONSTRAINTS r ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME AND r.TABLE_NAME = k.TABLE_NAME WHERE k.TABLE_SCHEMA = DATABASE() AND (k.TABLE_NAME IN ('trip', 'bus') OR (k.REFERENCED_TABLE_SCHEMA = DATABASE() AND k.REFERENCED_TABLE_NAME IN ('trip', 'bus')))");
  const indexes = await prisma.$queryRawUnsafe("SELECT TABLE_NAME AS tableName, INDEX_NAME AS name, COLUMN_NAME AS columnName, SEQ_IN_INDEX AS position FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('trip', 'bus')");
  return { columns, checks, keys, indexes };
}

function validateSchema(schema) {
  const column = (table, name) => schema.columns.find((item) => item.tableName === table && item.name === name);
  for (const [table, fields] of [["trip", ["id", "from", "to", "time", "price", "availableSeats", "createdAt"]], ["bus", ["id", "plate", "type", "status", "notes", "createdAt"]]]) {
    for (const name of fields) if (!column(table, name)) fail(`Bảng ${table} thiếu cột ${name}. Chưa thay đổi database.`);
  }
  for (const [table, name] of [["trip", "id"], ["trip", "availableSeats"]]) {
    const item = column(table, name);
    if (item.type !== "int" || item.nullable !== "NO" || /unsigned/i.test(item.columnType)) fail(`Cột ${table}.${name} chưa đúng cấu trúc hỗ trợ.`);
  }
  const seats = column("bus", "seats");
  const capacity = column("bus", "capacity");
  if (Boolean(seats) === Boolean(capacity)) fail("Bảng bus phải có đúng một cột seats cũ hoặc capacity mới. Dừng để kiểm tra schema.");
  for (const item of [seats || capacity, column("trip", "capacity")].filter(Boolean)) {
    if (item.type !== "int" || item.nullable !== "NO") fail("Kiểu cột sức chứa chưa khớp. Chưa tự chuyển đổi dữ liệu.");
  }
  const busId = column("bus", "id");
  if (busId.type !== "varchar" || Number(busId.length) !== 191 || busId.nullable !== "NO") fail("bus.id phải là VARCHAR(191) NOT NULL trước khi tạo quan hệ.");
  if (!/^[a-zA-Z0-9_]+$/.test(busId.collation)) fail("Không xác định được collation của bus.id.");
  const tripBusId = column("trip", "busId");
  if (tripBusId && (tripBusId.type !== "varchar" || Number(tripBusId.length) !== 191 || tripBusId.collation !== busId.collation)) fail("trip.busId chưa cùng kiểu/collation với bus.id. Chưa thay đổi schema.");
  if (!column("trip", "capacity") && !tripBusId) fail("Không có trip.capacity hoặc trip.busId để xác định sức chứa cũ.");
  const dependencies = schema.keys.filter((key) => (key.tableName === "trip" && key.columnName === "capacity") || (key.tableName === "bus" && key.columnName === "seats") || (key.referencedTable === "trip" && key.referencedColumn === "capacity") || (key.referencedTable === "bus" && key.referencedColumn === "seats"));
  if (dependencies.length) fail("Cột sức chứa cũ đang tham gia khóa/index cần kiểm tra trước khi đổi.");
  if (schema.indexes.some((index) => (index.tableName === "trip" && index.columnName === "capacity") || (index.tableName === "bus" && index.columnName === "seats"))) fail("Cột sức chứa cũ có index tùy chỉnh; cần kiểm tra trước khi chuyển đổi.");
  const busIndex = schema.indexes.filter((index) => index.tableName === "trip" && index.name === "trip_busId_idx");
  if (busIndex.length && (busIndex.length !== 1 || busIndex[0].columnName !== "busId" || Number(busIndex[0].position) !== 1)) fail("Index trip_busId_idx đã tồn tại với cấu trúc khác.");
  const foreign = schema.keys.filter((key) => key.tableName === "trip" && key.columnName === "busId" && key.referencedTable);
  if (foreign.length && (foreign.length !== 1 || ![busForeignKeyName, temporaryBusForeignKeyName].includes(foreign[0].name) || foreign[0].referencedTable !== "bus" || foreign[0].referencedColumn !== "id" || !["RESTRICT", "NO ACTION"].includes(foreign[0].deleteRule) || !["RESTRICT", "CASCADE"].includes(foreign[0].updateRule))) fail("Khóa ngoại trip.busId khác cấu trúc được hỗ trợ. Dừng để kiểm tra.");
  const unexpectedCheck = schema.checks.find((check) => check.tableName === "trip" && /\bcapacity\b/i.test(check.clause) && check.name !== "trip_seat_counts_check");
  if (unexpectedCheck) fail("Có CHECK tùy chỉnh tham chiếu trip.capacity; cần kiểm tra trước khi bỏ cột.");
  return { legacyTripCapacity: Boolean(column("trip", "capacity")), legacyBusSeats: Boolean(seats), tripBusId, foreignKey: foreign[0], busIndex: busIndex[0], collation: busId.collation };
}

async function readSnapshot(prisma) {
  return prisma.$transaction(async (tx) => {
    const tables = {};
    for (const table of ["bus", "trip", "booking", "SeatHold"]) {
      const columns = await tx.$queryRawUnsafe(`SHOW COLUMNS FROM \`${table}\``);
      if (!columns.length || columns.some((column) => typeof column.Field !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(column.Field))) fail(`Tên cột của bảng ${table} chưa được hỗ trợ; dừng trước khi thay đổi dữ liệu.`);
      // Prisma's prepared-statement metadata can retain the pre-DDL shape for
      // SELECT *. An explicit current projection changes the SQL after rename/
      // drop/add and prevents old column metadata from misreading the new rows.
      const projection = columns.map((column) => `\`${column.Field}\``).join(", ");
      const definitions = await tx.$queryRawUnsafe(`SHOW CREATE TABLE \`${table}\``);
      tables[table] = {
        // With lower_case_table_names=1, MySQL can return SeatHold on the first
        // prepared SHOW CREATE and seathold on later executions. Only the DDL
        // describes the schema; its display-name column must not trip the guard.
        schema: definitions.map((definition) => {
          const createTable = Object.values(definition).find((value) => typeof value === "string" && /^CREATE TABLE\s/i.test(value));
          if (!createTable) fail(`Không đọc được cấu trúc bảng ${table}. Chưa thay đổi dữ liệu.`);
          return { createTable };
        }),
        rows: await tx.$queryRawUnsafe(`SELECT ${projection} FROM \`${table}\` ORDER BY \`id\``),
      };
    }
    return tables;
  }, { isolationLevel: "RepeatableRead" });
}

function validateData(snapshot, state, options = {}) {
  const buses = snapshot.bus.rows;
  const trips = snapshot.trip.rows;
  for (const bus of buses) {
    const capacity = state.legacyBusSeats ? bus.seats : bus.capacity;
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 60) fail(`Xe ${bus.id} có sức chứa ngoài 1–60; chưa tự sửa dữ liệu.`);
  }
  const busById = new Map(buses.map((bus) => [bus.id, bus]));
  const tripById = new Map(trips.map((trip) => [trip.id, trip]));
  for (const trip of trips) {
    const assigned = trip.busId ? busById.get(trip.busId) : undefined;
    const capacity = state.legacyTripCapacity ? trip.capacity : (state.legacyBusSeats ? assigned?.seats : assigned?.capacity);
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 60 || !Number.isInteger(trip.availableSeats) || trip.availableSeats < 0 || trip.availableSeats > capacity) fail(`Chuyến ${trip.id} có sức chứa/ghế trống không hợp lệ.`);
    if (trip.busId && !assigned) fail(`Chuyến ${trip.id} tham chiếu xe không tồn tại.`);
    if (assigned && (state.legacyBusSeats ? assigned.seats : assigned.capacity) !== capacity) fail(`Sức chứa xe của chuyến ${trip.id} không khớp dữ liệu cũ; chưa tự đổi sức chứa.`);
    if (!trip.busId) {
      const proposed = createBackfillBus(trip, options);
      if (buses.some((bus) => bus.id === proposed.id || bus.plate === proposed.plate)) fail(`Mã hoặc biển số ${proposed.id} đã được sử dụng. Chưa gán nhầm xe cho chuyến.`);
    }
    const active = snapshot.booking.rows.filter((booking) => booking.tripId === trip.id && booking.status !== "CANCELLED");
    if (trip.availableSeats + active.length !== capacity) fail(`Bộ đếm ghế chuyến ${trip.id} không khớp vé hiệu lực; cần đối chiếu trước khi chuyển đổi.`);
    for (const record of [...active, ...snapshot.SeatHold.rows.filter((hold) => hold.tripId === trip.id)]) {
      const match = /^([ABC])(\d{2})$/.exec(record.seatNumber);
      const position = match ? (Number(match[2]) - 1) * 3 + "ABC".indexOf(match[1]) + 1 : 0;
      if (position < 1 || position > capacity) fail(`Chuyến ${trip.id} có ghế ngoài sơ đồ hiện tại; chưa tự chuyển đổi.`);
    }
  }
  if (snapshot.booking.rows.some((booking) => !tripById.has(booking.tripId)) || snapshot.SeatHold.rows.some((hold) => !tripById.has(hold.tripId))) fail("Có vé/giữ ghế không có chuyến tương ứng.");
}

function persistBackup(snapshot, schema, backupDirectory) {
  const directory = path.resolve(backupDirectory);
  fs.mkdirSync(directory, { recursive: true });
  const backupPath = path.join(directory, `before-trip-buses-${Date.now()}-${randomBytes(4).toString("hex")}.json`);
  const content = JSON.stringify({ version: 1, purpose: migrationName, createdAt: new Date().toISOString(), schema, tables: snapshot }, (_, value) => typeof value === "bigint" ? value.toString() : value, 2);
  const descriptor = fs.openSync(backupPath, "wx", 0o600);
  try { fs.writeFileSync(descriptor, content); fs.fsyncSync(descriptor); }
  finally { fs.closeSync(descriptor); }
  return backupPath;
}

function normalizedCheck(clause) { return clause.replaceAll("`", "").replaceAll(/[\s()]/g, "").toLowerCase(); }

async function ensureTripBusRelation(prisma, { backupDirectory = path.resolve(".local-backups"), checkOnly = false, sampleBuses = false } = {}) {
  const schema = await inspectTripBusSchema(prisma);
  const state = validateSchema(schema);
  const extra = await prisma.$queryRawUnsafe("SELECT TRIGGER_NAME AS name FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = DATABASE() AND EVENT_OBJECT_TABLE IN ('trip', 'bus') UNION ALL SELECT VIEW_NAME AS name FROM information_schema.VIEW_TABLE_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('trip', 'bus')");
  if (extra.length) fail("Bảng trip/bus có trigger hoặc view phụ thuộc; cần kiểm tra trước khi thay đổi schema.");
  const snapshot = await readSnapshot(prisma);
  validateData(snapshot, state, { sampleBuses });
  const tripCheck = schema.checks.find((item) => item.tableName === "trip" && item.name === "trip_seat_counts_check");
  const busCheck = schema.checks.find((item) => item.tableName === "bus" && item.name === "bus_capacity_check");
  if (busCheck && normalizedCheck(busCheck.clause) !== "capacitybetween1and60") fail("CHECK bus_capacity_check khác cấu trúc được hỗ trợ.");
  if (tripCheck && !["availableSeatsbetween0and60".toLowerCase(), "capacitybetween1and60andavailableseatsbetween0andcapacity"].includes(normalizedCheck(tripCheck.clause))) fail("CHECK trip_seat_counts_check khác cấu trúc được hỗ trợ.");
  const finished = !state.legacyTripCapacity && !state.legacyBusSeats && state.tripBusId?.nullable === "NO" && isTargetBusForeignKey(state.foreignKey) && state.busIndex && tripCheck && busCheck;
  const assignments = snapshot.trip.rows.filter((trip) => !trip.busId).map((trip) => ({ tripId: trip.id, ...createBackfillBus(trip, { sampleBuses }) }));
  const plan = { changed: !finished, migrationName, sampleBuses, tripCount: snapshot.trip.rows.length, createdBusCount: assignments.length, assignments };
  if (finished || checkOnly) return { ...plan, checkOnly };
  const backupPath = persistBackup(snapshot, schema, backupDirectory);
  // DDL auto-commits in MySQL. All checks above and the durable backup precede it.
  // Stop the application/worker while applying; do not allow concurrent writers.
  const current = await readSnapshot(prisma);
  if (createHash("sha256").update(stringify(snapshot)).digest("hex") !== createHash("sha256").update(stringify(current)).digest("hex")) fail(`Dữ liệu đã đổi sau kiểm tra. Chưa sửa schema; giữ bản sao lưu tại ${backupPath}.`);
  if (state.legacyBusSeats) await prisma.$executeRawUnsafe("ALTER TABLE `bus` RENAME COLUMN `seats` TO `capacity`");
  if (!state.tripBusId) {
    // Use the actual id collation; imported databases need not use one fixed collation.
    const collation = state.collation;
    const charset = collation.split("_")[0];
    await prisma.$executeRawUnsafe(`ALTER TABLE \`trip\` ADD COLUMN \`busId\` VARCHAR(191) CHARACTER SET ${charset} COLLATE ${collation} NULL`);
  }
  await prisma.$transaction(async (tx) => {
    for (const bus of assignments) {
      await tx.$executeRawUnsafe("INSERT INTO `bus` (`id`, `plate`, `type`, `capacity`, `status`, `notes`, `createdAt`) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP(3))", bus.id, bus.plate, bus.type, bus.capacity, bus.status, bus.notes);
      const count = await tx.$executeRawUnsafe("UPDATE `trip` SET `busId` = ? WHERE `id` = ? AND `busId` IS NULL", bus.id, bus.tripId);
      if (Number(count) !== 1) fail("Dữ liệu chuyến thay đổi trong lúc chuyển đổi. Transaction gán xe đã được hoàn tác.");
    }
  }, { isolationLevel: "Serializable", timeout: 30000 });
  if (tripCheck && state.legacyTripCapacity) await prisma.$executeRawUnsafe("ALTER TABLE `trip` DROP CHECK `trip_seat_counts_check`");
  if (state.legacyTripCapacity) await prisma.$executeRawUnsafe("ALTER TABLE `trip` DROP COLUMN `capacity`");
  const indexes = await prisma.$queryRawUnsafe("SHOW INDEX FROM `trip`");
  if (!indexes.some((index) => index.Key_name === "trip_busId_idx" && index.Column_name === "busId" && Number(index.Seq_in_index) === 1)) {
    if (indexes.some((index) => index.Key_name === "trip_busId_idx")) fail("Index trip_busId_idx đã tồn tại với cấu trúc khác.");
    await prisma.$executeRawUnsafe("ALTER TABLE `trip` ADD INDEX `trip_busId_idx` (`busId`)");
  }
  if (state.tripBusId?.nullable !== "NO" || !isTargetBusForeignKey(state.foreignKey)) {
    // Finance/dispatch imports already have a nullable FK with ON UPDATE CASCADE.
    // MySQL refuses dropping/recreating the same FK name in one ALTER (1826).
    // Use a temporary constraint name, then restore the original name, keeping
    // FK protection throughout both statements. A rerun recognizes either name.
    const changes = [];
    const nextName = state.foreignKey?.name === busForeignKeyName ? temporaryBusForeignKeyName : busForeignKeyName;
    if (state.foreignKey) changes.push(`DROP FOREIGN KEY \`${state.foreignKey.name}\``);
    if (state.tripBusId?.nullable !== "NO") changes.push(`MODIFY \`busId\` VARCHAR(191) CHARACTER SET ${state.collation.split("_")[0]} COLLATE ${state.collation} NOT NULL`);
    changes.push(`ADD CONSTRAINT \`${nextName}\` FOREIGN KEY (\`busId\`) REFERENCES \`bus\` (\`id\`) ON DELETE RESTRICT ON UPDATE RESTRICT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE \`trip\` ${changes.join(", ")}`);
    if (nextName === temporaryBusForeignKeyName) await prisma.$executeRawUnsafe(`ALTER TABLE \`trip\` DROP FOREIGN KEY \`${temporaryBusForeignKeyName}\`, ADD CONSTRAINT \`${busForeignKeyName}\` FOREIGN KEY (\`busId\`) REFERENCES \`bus\` (\`id\`) ON DELETE RESTRICT ON UPDATE RESTRICT`);
  }
  if (!busCheck) await prisma.$executeRawUnsafe("ALTER TABLE `bus` ADD CONSTRAINT `bus_capacity_check` CHECK (`capacity` BETWEEN 1 AND 60)");
  if (!tripCheck || state.legacyTripCapacity) await prisma.$executeRawUnsafe("ALTER TABLE `trip` ADD CONSTRAINT `trip_seat_counts_check` CHECK (`availableSeats` BETWEEN 0 AND 60)");
  const afterSchema = await inspectTripBusSchema(prisma);
  const afterState = validateSchema(afterSchema);
  if (afterState.legacyTripCapacity || afterState.legacyBusSeats || afterState.tripBusId?.nullable !== "NO" || !isTargetBusForeignKey(afterState.foreignKey) || !afterState.busIndex) fail(`Schema đích chưa đầy đủ. Giữ bản sao lưu ${backupPath}.`);
  const after = await readSnapshot(prisma);
  validateData(after, afterState);
  for (const table of ["booking", "SeatHold"]) if (stringify(snapshot[table].rows) !== stringify(after[table].rows)) fail(`Dữ liệu ${table} đã thay đổi; cần kiểm tra bản sao lưu ${backupPath}.`);
  const beforeTrips = snapshot.trip.rows.map(({ capacity, busId, ...trip }) => trip);
  const afterTrips = after.trip.rows.map(({ busId, ...trip }) => trip);
  if (stringify(beforeTrips) !== stringify(afterTrips)) fail(`Dữ liệu chuyến ngoài quan hệ xe đã thay đổi; kiểm tra ${backupPath}.`);
  for (const trip of snapshot.trip.rows.filter((trip) => trip.busId)) {
    if (after.trip.rows.find((row) => row.id === trip.id)?.busId !== trip.busId) fail(`Phân công xe chuyến ${trip.id} đã thay đổi; kiểm tra ${backupPath}.`);
  }
  return { ...plan, backupPath, checkOnly: false };
}

module.exports = { ensureTripBusRelation, inspectTripBusSchema, validateSchema, validateData, createBackfillBus, migrationName };

if (require.main === module) {
  require("dotenv/config");
  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient();
  const args = process.argv.slice(2);
  if (args.some((argument) => !["--check", "--sample-buses"].includes(argument))) {
    console.error("Dùng node scripts/setup-trip-buses.cjs [--check] [--sample-buses]. Dừng ứng dụng/worker trước khi áp dụng.");
    process.exitCode = 1;
    void prisma.$disconnect();
  } else ensureTripBusRelation(prisma, { checkOnly: args.includes("--check"), sampleBuses: args.includes("--sample-buses") }).then((result) => {
    console.log(JSON.stringify({ ...result, backupPath: result.backupPath ? path.relative(process.cwd(), result.backupPath) : undefined }, null, 2));
    if (result.changed && !result.checkOnly) console.log(result.sampleBuses ? "Đã tạo và gán xe mẫu, giữ nguyên vé, giữ ghế và số ghế trống. Thông tin xe/biển số là dữ liệu minh họa. Lịch sử Prisma chưa bị thay đổi." : "Đã giữ nguyên vé, giữ ghế và số ghế trống. Xe LEGACY-TRIP-* chưa phải phân công xe thực; chọn xe thật sau khi xác minh. Lịch sử Prisma chưa bị thay đổi.");
  }).catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
}
