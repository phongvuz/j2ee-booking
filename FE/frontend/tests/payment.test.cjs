const { test } = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./load-ts.cjs");

process.env.VIETQR_BANK_ID = "970436";
process.env.VIETQR_BANK_NAME = "Vietcombank";
process.env.VIETQR_ACCOUNT_NO = "0123456789";
process.env.VIETQR_ACCOUNT_NAME = "Tên Chủ Tài Khoản";
process.env.PAYMENT_DEMO_ENABLED = "true";

function setup({ status = "PENDING", departed = false, payment = null } = {}) {
  const rows = [1, 2].map((id) => ({ id, status, totalPrice: 200000, transactions: [], trip: { status: "OPEN", time: new Date(Date.now() + (departed ? -1000 : 86400000)) } }));
  let creates = 0;
  const tx = {
    booking: {
      findMany: async () => rows,
      updateMany: async ({ where, data }) => {
        const selected = rows.filter((row) => where.id.in.includes(row.id));
        selected.forEach((row) => Object.assign(row, data));
        return { count: selected.length };
      },
    },
    payment: { findFirst: async () => payment, create: async ({ data }) => { creates++; payment = data; return data; } },
    bookingTransaction: { createMany: async ({ data }) => { for (const entry of data) rows.find((row) => row.id === entry.bookingId).transactions.push(entry); return { count: data.length }; } },
  };
  const mocks = { "@/lib/prisma": { prisma: tx }, "@/lib/transaction": { runTransaction: (work) => work(tx) } };
  return { rows, mocks, service: load("services/paymentService.ts", mocks), get creates() { return creates; }, get payment() { return payment; } };
}

test("QR preserves leading account zero and embeds database total and order code", async () => {
  const s = setup();
  const info = await s.service.getVietqrPaymentInfo("TEST-PNR");
  const url = new URL(info.qrUrl);
  assert.equal(url.hostname, "img.vietqr.io");
  assert.equal(url.pathname, "/image/970436-0123456789-compact2.png");
  assert.equal(url.searchParams.get("amount"), "400000");
  assert.equal(url.searchParams.get("addInfo"), "VE1");
  assert.equal(url.searchParams.get("accountName"), "TEN CHU TAI KHOAN");
  assert.equal(s.creates, 0); // Chưa bấm nút thì chưa tạo payment.
});

test("demo confirmation records payment, confirms all seats once and retains timestamp", async () => {
  const s = setup();
  assert.equal((await s.service.confirmDemoPayment("TEST-PNR")).bookingStatus, "CONFIRMED");
  assert.equal(s.payment.amount, 400000);
  assert.equal(s.payment.responseCode, "DEMO");
  assert.match(s.payment.providerTransactionId, /^DEMO-/);
  assert.ok(s.rows.every((r) => r.status === "CONFIRMED" && r.confirmedAt instanceof Date));
  assert.ok(s.rows.every((row) => row.transactions.length === 1 && row.transactions[0].method === "DEMO"));
  await s.service.confirmDemoPayment("TEST-PNR");
  assert.equal(s.creates, 1);
});

test("QR excludes canceled and already paid seats from the amount due", async () => {
  const context = setup();
  context.rows[0].status = "CANCELLED";
  context.rows[0].transactions.push({ kind: "RECEIPT", amount: 200000, method: "CASH", reference: "paid-1" });
  const info = await context.service.getVietqrPaymentInfo("TEST-PNR");
  assert.equal(info.total_amount, 200000);
  context.rows[1].status = "CONFIRMED";
  context.rows[1].transactions.push({ kind: "RECEIPT", amount: 200000, method: "CASH", reference: "paid-2" });
  await assert.rejects(context.service.getVietqrPaymentInfo("TEST-PNR"), { status: 409 });
});

test("mixed PNR demo settlement charges only remaining pending seats", async () => {
  const context = setup();
  context.rows[0].status = "CONFIRMED";
  context.rows[0].transactions.push({ kind: "RECEIPT", amount: 200000, method: "CASH", reference: "counter-1" });
  await context.service.confirmDemoPayment("TEST-PNR");
  assert.equal(context.payment.amount, 200000);
  assert.equal(context.rows[0].transactions.length, 1);
  assert.equal(context.rows[0].transactions[0].method, "CASH");
  assert.equal(context.rows[1].transactions.length, 1);
  assert.equal(context.rows[1].transactions[0].method, "DEMO");
  await context.service.confirmDemoPayment("TEST-PNR");
  assert.equal(context.creates, 1);
});

test("cancelled, departed, counter-confirmed and review orders cannot create a demo payment", async () => {
  for (const options of [{ status: "CANCELLED" }, { departed: true }, { status: "CONFIRMED" }, { payment: { status: "REVIEW" } }]) {
    const s = setup(options);
    await assert.rejects(s.service.confirmDemoPayment("TEST-PNR"), (error) => error.status === 409);
    assert.equal(s.creates, 0);
  }
});

test("backend rejects confirmation when demo is off even if frontend button is bypassed", async () => {
  process.env.PAYMENT_DEMO_ENABLED = "false";
  try {
    const s = setup();
    await assert.rejects(s.service.confirmDemoPayment("TEST-PNR"), (error) => error.status === 403);
    assert.equal(s.creates, 0);
  } finally { process.env.PAYMENT_DEMO_ENABLED = "true"; }
});

test("API rejects injected amount, cross-site confirmation and malformed JSON", async () => {
  const s = setup();
  const route = load("app/api/payments/demo/confirm/route.ts", s.mocks);
  const post = (body, headers = {}) => route.POST(new Request("http://localhost:3000/api/payments/demo/confirm", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body), headers }));
  assert.equal((await post({ pnr: "TEST-PNR", amount: 1 })).status, 400);
  assert.equal((await post({ pnr: "TEST-PNR" }, { origin: "https://other.example" })).status, 403);
  assert.equal((await post("{")).status, 400);
  assert.equal(s.creates, 0);
  assert.equal((await post({ pnr: "TEST-PNR" })).status, 200);
});
