const fs = require("node:fs");
const path = require("node:path");

// Database import có thể đã có bảng đặt vé nhưng chưa có Payment hoặc lịch sử migration.
// Chỉ bổ sung bảng thanh toán từ migration đã có, giữ nguyên các bảng và dữ liệu khác.
async function ensurePaymentTable(prisma) {
  const tables = await prisma.$queryRawUnsafe(
    "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) = 'payment'",
  );
  if (tables.length) {
    // Kiểm tra đủ các cột trước khi báo rằng bảng hiện có đã sẵn sàng.
    await prisma.payment.findFirst();
    return false;
  }

  const migration = path.join(__dirname, "../prisma/admin-migrations/20261011000000_online_payments/migration.sql");
  await prisma.$executeRawUnsafe(fs.readFileSync(migration, "utf8"));
  await prisma.payment.findFirst();
  return true;
}

if (require.main === module) {
  require("dotenv/config");
  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient();
  ensurePaymentTable(prisma)
    .then((created) => console.log(created ? "Đã tạo bảng Payment. Dữ liệu đặt vé được giữ nguyên." : "Bảng Payment đã sẵn sàng."))
    .catch((error) => { console.error(error.message); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
}

module.exports = { ensurePaymentTable };
