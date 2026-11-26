const fs = require("node:fs");
const path = require("node:path");
const { randomBytes } = require("node:crypto");

const requiredColumns = ["id", "from", "to", "time", "price", "availableSeats", "createdAt"];

// Imported databases may have the current trip model plus the old required
// code column. Apply only that already-defined schema change, preserving history.
async function ensureNumericTripIds(prisma, { backupDirectory = path.resolve(".local-backups") } = {}) {
  const columns = await prisma.$queryRawUnsafe(
    "SELECT COLUMN_NAME AS name, DATA_TYPE AS type, IS_NULLABLE AS nullable, EXTRA AS extra FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'trip'"
  );
  const columnNames = new Set(columns.map((column) => column.name));
  if (requiredColumns.some((name) => !columnNames.has(name))) {
    throw new Error("Bảng trip chưa có đủ các cột của ứng dụng hiện tại. Dừng sửa để giữ nguyên dữ liệu.");
  }
  const hasLegacyCapacity = columnNames.has("capacity");
  const hasBusId = columnNames.has("busId");
  if (hasLegacyCapacity === hasBusId) {
    throw new Error("Bảng trip phải có capacity cũ hoặc busId mới. Cần hoàn tất chuyển đổi quan hệ xe trước khi sửa cột code.");
  }
  const idColumn = columns.find((column) => column.name === "id");
  if (idColumn.type !== "int" || !idColumn.extra.includes("auto_increment")) {
    throw new Error("ID chuyến xe chưa phải số nguyên tự tăng. Cần kiểm tra schema trước khi tiếp tục.");
  }
  const supportedTypes = {
    from: ["varchar", "char"], to: ["varchar", "char"],
    time: ["datetime"], createdAt: ["datetime"],
    price: ["int", "double", "float", "decimal"],
    ...(hasLegacyCapacity ? { capacity: ["int"] } : { busId: ["varchar"] }), availableSeats: ["int"],
  };
  for (const [name, types] of Object.entries(supportedTypes)) {
    const column = columns.find((item) => item.name === name);
    if (!types.includes(column.type) || column.nullable !== "NO") {
      throw new Error(`Cấu trúc cột ${name} chưa khớp ứng dụng. Chưa thay đổi database.`);
    }
  }
  const codeColumn = columns.find((column) => column.name === "code");
  if (!codeColumn) return { changed: false };
  if (!["varchar", "char"].includes(codeColumn.type)) {
    throw new Error("Cột code có kiểu dữ liệu không đúng cấu trúc cũ. Chưa thay đổi database.");
  }

  const foreignKeys = await prisma.$queryRawUnsafe(
    "SELECT CONSTRAINT_NAME AS name FROM information_schema.KEY_COLUMN_USAGE WHERE (TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'trip' AND COLUMN_NAME = 'code' AND REFERENCED_TABLE_NAME IS NOT NULL) OR (REFERENCED_TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME = 'trip' AND REFERENCED_COLUMN_NAME = 'code')"
  );
  if (foreignKeys.length) throw new Error("Cột code đang được khóa ngoại sử dụng. Cần kiểm tra quan hệ trước khi sửa.");
  const indexes = await prisma.$queryRawUnsafe("SHOW INDEX FROM `trip`");
  const codeIndexNames = new Set(indexes.filter((index) => index.Column_name === "code").map((index) => index.Key_name));
  for (const name of codeIndexNames) {
    const parts = indexes.filter((index) => index.Key_name === name);
    if (name === "PRIMARY" || parts.length !== 1 || parts[0].Column_name !== "code") {
      throw new Error("Cột code tham gia index ngoài cấu trúc cũ. Dừng sửa để giữ nguyên index hiện có.");
    }
  }
  const triggers = await prisma.$queryRawUnsafe(
    "SELECT TRIGGER_NAME AS name FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = DATABASE() AND EVENT_OBJECT_TABLE = 'trip'"
  );
  if (triggers.length) throw new Error("Bảng trip có trigger cần kiểm tra trước khi bỏ cột code.");
  const views = await prisma.$queryRawUnsafe(
    "SELECT VIEW_NAME AS name FROM information_schema.VIEW_TABLE_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'trip'"
  );
  if (views.length) throw new Error("Bảng trip đang được view sử dụng. Cần kiểm tra view trước khi bỏ cột code.");

  const snapshot = await prisma.$transaction(async (tx) => ({
    schema: await tx.$queryRawUnsafe("SHOW CREATE TABLE `trip`"),
    rows: await tx.$queryRawUnsafe("SELECT * FROM `trip` ORDER BY `id`"),
  }), { isolationLevel: "RepeatableRead" });
  const directory = path.resolve(backupDirectory);
  fs.mkdirSync(directory, { recursive: true });
  const backupPath = path.join(directory, `before-numeric-trips-${Date.now()}-${randomBytes(4).toString("hex")}.json`);
  const backup = JSON.stringify({
    version: 1, purpose: "numeric-trip-id", createdAt: new Date().toISOString(),
    ...snapshot, legacyCodes: snapshot.rows.map(({ id, code }) => ({ id, code })),
  }, (_, value) => typeof value === "bigint" ? value.toString() : value, 2);
  // DDL auto-commits in MySQL: persist the backup before changing the schema.
  const descriptor = fs.openSync(backupPath, "wx", 0o600);
  try {
    fs.writeFileSync(descriptor, backup);
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }

  // MySQL removes indexes consisting only of this column together with the column.
  // IDs, passenger snapshots, PNRs and foreign keys using trip.id remain unchanged.
  await prisma.$executeRawUnsafe("ALTER TABLE `trip` DROP COLUMN `code`");
  const remaining = await prisma.$queryRawUnsafe("SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'trip' AND COLUMN_NAME = 'code'");
  if (remaining.length) throw new Error("Cột code vẫn còn sau cập nhật. Cần kiểm tra database và bản sao lưu.");
  return { changed: true, backupPath };
}

module.exports = { ensureNumericTripIds };

if (require.main === module) {
  require("dotenv/config");
  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient();
  ensureNumericTripIds(prisma).then(({ changed, backupPath }) => {
    if (!changed) console.log("Schema chuyến xe đã dùng ID số; không có thay đổi.");
    else {
      console.log(`Đã sao lưu bảng trip vào ${path.relative(process.cwd(), backupPath)}.`);
      console.log("Đã bỏ cột code cũ; giữ nguyên ID chuyến xe và các quan hệ vé/giữ ghế.");
    }
  }).catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
}
