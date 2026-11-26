const { test } = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./load-ts.cjs");
const { renderToStaticMarkup } = require("react-dom/server");

const { createGuestPhone, isGuestPhone } = load("lib/guest-account.ts");

test("guest identifiers never reserve a real passenger phone and differ between bookings", () => {
  const first = createGuestPhone();
  assert.equal(isGuestPhone(first), true);
  assert.notEqual(first, createGuestPhone());
  assert.equal(isGuestPhone("0901234567"), false);
  assert.equal(/^0[0-9]{9}$/.test(first), false);
});

test("admin account responses hide guest identifiers but allow searching passenger phones", async () => {
  let query;
  const record = {
    id: 7, fullName: "Guest passenger", phone: createGuestPhone(), role: "USER", isActive: true,
    createdAt: new Date(), booking: [], _count: { booking: 0 },
  };
  const { queryUsers, getUserById } = load("services/userService.ts", { "@/lib/prisma": { prisma: { user: {
    count: async () => 1,
    groupBy: async () => [{ role: "USER", _count: { _all: 1 } }],
    findMany: async (args) => { query = args; return [record]; },
    findUnique: async () => record,
  } } } });
  const listing = await queryUsers({ search: "0901234567" });
  assert.equal(listing.data[0].phone, "");
  assert.equal(listing.data[0].isGuest, true);
  assert.deepEqual(query.where.OR.at(-1), { booking: { some: { passengerPhone: { contains: "0901234567" } } } });
  const detail = await getUserById(7);
  assert.equal(detail.phone, "");
  assert.equal(detail.isGuest, true);
  assert.equal(JSON.stringify([listing, detail]).includes(record.phone), false);
});

test("guest identities cannot become login accounts or take a passenger phone through admin updates", async () => {
  const current = { id: 7, fullName: "Guest", phone: createGuestPhone(), role: "USER", isActive: true };
  const cache = new Map();
  let updates = 0;
  const tx = { user: {
    findUnique: async () => current,
    update: async ({ data }) => {
      updates++;
      return { ...current, ...Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)) };
    },
  } };
  const { updateUser } = load("services/userService.ts", {
    "@/lib/prisma": { prisma: { $transaction: async (work) => work(tx) } },
  }, cache);
  for (const data of [{ phone: "0901234567" }, { role: "ADMIN", password: "strong123" }, { password: "strong123" }]) {
    await assert.rejects(updateUser(7, data, 1), { status: 409 });
  }
  assert.equal(updates, 0);
  const updated = await updateUser(7, { isActive: false }, 1);
  assert.equal(updated.phone, "");
  assert.equal(updated.isActive, false);
  assert.equal(updated.isGuest, true);
});

test("admin guest rows identify guest history and disable account edits and role changes", () => {
  const { UserTable } = load("components/admin/users/UserTable.tsx");
  const html = renderToStaticMarkup(UserTable({
    users: [{ id: 7, fullName: "Guest", phone: "", role: "USER", isGuest: true, isActive: true, createdAt: new Date().toISOString() }],
    loading: false, onEdit() {}, onDelete() {}, onView() {}, onToggleRole() {},
  }));
  assert.match(html, /Khách vãng lai/);
  assert.match(html, /aria-label="Chỉnh sửa tài khoản" disabled=""/);
  assert.match(html, /button disabled=""[^>]*title="Khách đặt vé khi chưa đăng nhập"/);
  assert.doesNotMatch(html, /guest:/);
});
