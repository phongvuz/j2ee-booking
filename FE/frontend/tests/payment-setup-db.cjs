// Chỉ tạo và xóa database tạm, không thay đổi dữ liệu ứng dụng.
require("dotenv/config");
const assert = require("node:assert/strict");
const { PrismaClient } = require("@prisma/client");
const { ensurePaymentTable } = require("../scripts/setup-payments.cjs");

const database = `nha_xe_payment_setup_verify_${Date.now()}`;
const control = new PrismaClient();
const url = new URL(process.env.DATABASE_URL);
url.pathname = `/${database}`;
const prisma = new PrismaClient({ datasources: { db: { url: url.toString() } } });
let created = false;

async function main() {
  assert.match(database, /^nha_xe_payment_setup_verify_\d+$/);
  await control.$executeRawUnsafe(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  created = true;
  await prisma.$executeRawUnsafe("CREATE TABLE booking (id INTEGER PRIMARY KEY, pnr VARCHAR(191) NOT NULL)");
  await prisma.$executeRawUnsafe("INSERT INTO booking (id, pnr) VALUES (1, 'EXISTING-PNR')");

  assert.equal(await ensurePaymentTable(prisma), true);
  const payment = await prisma.payment.create({ data: {
    id: "setup-test", pnr: "EXISTING-PNR", amount: 100000,
    checkoutUrl: "https://example.test/qr", expiresAt: new Date(Date.now() + 86400000),
  } });
  assert.equal(await ensurePaymentTable(prisma), false);
  assert.deepEqual(await prisma.payment.findUnique({ where: { id: payment.id } }), payment);
  assert.deepEqual(await prisma.$queryRawUnsafe("SELECT id, pnr FROM booking"), [{ id: 1, pnr: "EXISTING-PNR" }]);
  console.log("PASS: imported database needs no migration history; setup preserves bookings and existing payments on rerun.");

  await prisma.$executeRawUnsafe("ALTER TABLE Payment DROP COLUMN paidAt");
  await assert.rejects(ensurePaymentTable(prisma), (error) => error.code === "P2022");
  assert.equal(await prisma.payment.count(), 1);
  console.log("PASS: incompatible existing payment schema is reported without replacing its records.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => {
  await prisma.$disconnect();
  if (created && /^nha_xe_payment_setup_verify_\d+$/.test(database)) {
    await control.$executeRawUnsafe(`DROP DATABASE \`${database}\``);
    console.log("Temporary verification database removed.");
  }
  await control.$disconnect();
});
