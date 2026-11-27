require("dotenv/config");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawnSync } = require("node:child_process");
const { PrismaClient } = require("@prisma/client");
const { createBaselineSchema } = require("./baseline-schema.cjs");
const prisma = new PrismaClient();
const baseline = "20261009000000_baseline";
const migrationPath = path.resolve("prisma/admin-migrations", baseline, "migration.sql");

function runPrisma(args) {
  const result = spawnSync(process.execPath, [require.resolve("prisma/build/index.js"), ...args], { encoding: "utf8", env: process.env });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || "Prisma command failed");
  return result.stdout;
}

function normalizeSeat(value) {
  const match = value.trim().toUpperCase().match(/^(?:[12])?([ABC])0?([1-9]\d?)$/);
  if (!match) throw new Error("Có mã ghế cũ không hợp lệ. Cần kiểm tra dữ liệu trước khi nâng cấp.");
  return `${match[1]}${match[2].padStart(2, "0")}`;
}

async function preflight() {
  const duplicates = await prisma.$queryRawUnsafe("SELECT phone FROM user GROUP BY phone HAVING COUNT(*) > 1");
  if (duplicates.length) throw new Error("Có số điện thoại tài khoản bị trùng. Dừng nâng cấp để giữ dữ liệu.");
  const trips = await prisma.$queryRawUnsafe("SELECT id, availableSeats, price FROM trip");
  const bookings = await prisma.$queryRawUnsafe("SELECT id, tripId, userId, seatNumber, status, totalPrice FROM booking");
  const users = await prisma.$queryRawUnsafe("SELECT id FROM user");
  const userIds = new Set(users.map((user) => user.id));
  const activeSeats = new Set();
  for (const booking of bookings) {
    if (!trips.some((trip) => trip.id === booking.tripId) || !userIds.has(booking.userId)) throw new Error("Có vé thiếu chuyến hoặc tài khoản liên quan.");
    if (!["CONFIRMED", "PENDING", "CANCELLED"].includes(booking.status) || !Number.isSafeInteger(booking.totalPrice) || booking.totalPrice < 0 || booking.totalPrice > 2147483647) throw new Error("Có vé mang trạng thái hoặc giá không hợp lệ. Giá phải là số nguyên đồng; không tự làm tròn dữ liệu cũ.");
    const key = `${booking.tripId}:${normalizeSeat(booking.seatNumber)}`;
    if (booking.status !== "CANCELLED") {
      if (activeSeats.has(key)) throw new Error("Có vé hiệu lực trùng ghế sau chuẩn hóa. Dừng nâng cấp để giữ dữ liệu.");
      activeSeats.add(key);
    }
  }
  for (const trip of trips) {
    if (!Number.isSafeInteger(trip.price) || trip.price < 0 || trip.price > 2147483647) throw new Error("Có giá chuyến xe không phải số nguyên đồng hoặc ngoài giới hạn. Cần kiểm tra trước khi nâng cấp.");
    const active = bookings.filter((booking) => booking.tripId === trip.id && booking.status !== "CANCELLED");
    const highest = Math.max(0, ...active.map((booking) => {
      const seat = normalizeSeat(booking.seatNumber);
      return (Number(seat.slice(1)) - 1) * 3 + "ABC".indexOf(seat[0]) + 1;
    }));
    if (trip.availableSeats < 0 || Math.max(trip.availableSeats + active.length, highest) > 60) throw new Error("Có chuyến với sức chứa ngoài giới hạn 1–60 ghế.");
  }
  const holds = await prisma.$queryRawUnsafe("SELECT tripId, seatNumber FROM SeatHold");
  const holdKeys = new Set();
  for (const hold of holds) {
    const key = `${hold.tripId}:${normalizeSeat(hold.seatNumber)}`;
    if (!trips.some((trip) => trip.id === hold.tripId) || holdKeys.has(key)) throw new Error("Dữ liệu giữ ghế có xung đột hoặc thiếu chuyến.");
    holdKeys.add(key);
  }
}

async function backup(tables) {
  const directory = path.resolve(".local-backups");
  fs.mkdirSync(directory, { recursive: true });
  const data = await prisma.$transaction(async (tx) => {
    const records = {};
    for (const table of tables) {
      // Chỉ dùng tên bảng đã đọc từ metadata; không nhận tên từ request.
      const quoted = `\`${table.replaceAll("`", "``")}\``;
      records[table] = { schema: await tx.$queryRawUnsafe(`SHOW CREATE TABLE ${quoted}`), rows: await tx.$queryRawUnsafe(`SELECT * FROM ${quoted}`) };
    }
    return records;
  }, { isolationLevel: "RepeatableRead" });
  const filename = path.join(directory, `before-admin-upgrade-${new Date().toISOString().replaceAll(/[:.]/g, "-")}.json`);
  fs.writeFileSync(filename, JSON.stringify(data, (_, value) => typeof value === "bigint" ? value.toString() : value, 2), { mode: 0o600 });
  console.log(`Đã sao lưu ${tables.length} bảng vào .local-backups (không đưa file này lên Git).`);
}

async function main() {
  const rows = await prisma.$queryRawUnsafe("SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()");
  const tables = rows.map((row) => row.name);
  if (!tables.length) {
    console.log(runPrisma(["migrate", "deploy"]));
    return;
  }
  if (tables.includes("_prisma_migrations")) {
    const history = await prisma.$queryRawUnsafe("SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL");
    if (!history.some((row) => row.migration_name === baseline)) throw new Error("Database đang dùng lịch sử migration khác. Không tự thay đổi lịch sử đã áp dụng.");
    await backup(tables);
    console.log(runPrisma(["migrate", "deploy"]));
    return;
  }
  const names = tables.map((name) => name.toLowerCase());
  for (const table of ["user", "trip", "booking", "employee"]) {
    if (!names.includes(table)) throw new Error(`Database import thiếu bảng ${table}. Chưa thực hiện thay đổi.`);
  }
  await backup(tables);
  const sql = fs.readFileSync(migrationPath, "utf8");
  for (const table of ["bus", "customer", "SeatHold"]) {
    if (names.includes(table.toLowerCase())) continue;
    const statement = sql.split(";").find((part) => part.includes(`CREATE TABLE \`${table}\``));
    if (!statement) throw new Error(`Baseline thiếu định nghĩa ${table}`);
    await prisma.$executeRawUnsafe(statement);
  }
  await preflight();
  const indexes = await prisma.$queryRawUnsafe("SHOW INDEX FROM user");
  if (!indexes.some((index) => index.Column_name === "phone" && Number(index.Non_unique) === 0)) {
    await prisma.$executeRawUnsafe("CREATE UNIQUE INDEX user_phone_key ON user(phone)");
  }
  // Chỉ ghi nhận baseline khi cấu trúc thật khớp; không đánh dấu sai migration là đã chạy.
  const temporary = path.join(os.tmpdir(), `nha-xe-baseline-${process.pid}.prisma`);
  const schema = createBaselineSchema(fs.readFileSync("prisma/schema.prisma", "utf8"));
  fs.writeFileSync(temporary, schema);
  try {
    const difference = runPrisma(["migrate", "diff", "--from-schema-datasource", temporary, "--to-schema-datamodel", temporary, "--script"]);
    if (difference.replace(/--[^\n]*/g, "").trim()) throw new Error("Cấu trúc database chưa khớp baseline. Đã giữ bản sao lưu; cần xem phần khác biệt trước khi tiếp tục.");
    console.log(runPrisma(["migrate", "resolve", "--applied", baseline]));
    console.log(runPrisma(["migrate", "deploy"]));
  } finally {
    fs.unlinkSync(temporary);
  }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
