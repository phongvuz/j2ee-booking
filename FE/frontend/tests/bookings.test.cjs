const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const { renderToStaticMarkup } = require("react-dom/server");

function setup(customer, bookings = []) {
  const queries = [];
  const filename = path.resolve(__dirname, "../app/(client)/bookings/page.tsx");
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = mod.require.bind(mod);
  const mocks = {
    "@/lib/session": { getCurrentCustomer: async () => customer },
    "@/lib/prisma": { prisma: { booking: { findMany: async (args) => {
      queries.push(args);
      return bookings.filter((booking) => booking.userId === args.where.userId);
    } } } },
    "next/navigation": { redirect: (url) => { throw new Error(`redirect:${url}`); } },
    "next/link": { default: ({ children, ...props }) => require("react").createElement("a", props, children) },
  };
  mod.require = (id) => Object.hasOwn(mocks, id) ? mocks[id] : original(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  return { page: mod.exports.default, queries };
}

test("unauthenticated visitors are redirected before querying bookings", async () => {
  const { page, queries } = setup(null);
  await assert.rejects(page(), /redirect:\/login/);
  assert.equal(queries.length, 0);
});

test("history uses the session user ID and renders only their tickets", async () => {
  const booking = {
    id: 5, userId: 7, seatNumber: "A01", status: "CONFIRMED", totalPrice: 300000,
    createdAt: new Date("2026-09-21T08:31:45Z"),
    trip: { id: 12345, from: "Hồ Chí Minh", to: "Đà Lạt", time: new Date("2026-10-01T21:00:00Z") },
  };
  const { page, queries } = setup({ userId: 7, customerId: "CUS-001" }, [booking, { ...booking, id: 6, userId: 8, seatNumber: "B05" }]);
  const html = renderToStaticMarkup(await page());
  assert.deepEqual(queries[0].where, { userId: 7 });
  assert.deepEqual(queries[0].orderBy, [{ createdAt: "desc" }, { id: "desc" }]);
  for (const text of ["A01", "12345", "Đã xác nhận", "300.000", "Đà Lạt"]) assert.ok(html.includes(text));
  assert.ok(!html.includes("B05"));
});

test("customers with no bookings see an empty state and trip link", async () => {
  const { page } = setup({ userId: 9 });
  const html = renderToStaticMarkup(await page());
  assert.ok(html.includes("Bạn chưa có vé nào"));
  assert.ok(html.includes('href="/trips"'));
});
