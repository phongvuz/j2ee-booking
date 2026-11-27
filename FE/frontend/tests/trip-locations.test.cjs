const { test } = require("node:test");
const assert = require("node:assert/strict");
const { renderToStaticMarkup } = require("react-dom/server");
const { createElement } = require("react");
const { load } = require("./load-ts.cjs");
const { mergeTripLocations, sameTripLocation } = load("lib/trip-locations.ts");

test("location options combine defaults and exact legacy labels without canonicalizing", () => {
  const options = mergeTripLocations(["Sài Gòn", "Bến xe Miền Đông cũ", "Sài Gòn", "", "  "]);
  assert.ok(options.includes("Hồ Chí Minh"));
  assert.ok(options.includes("Huế"));
  assert.ok(options.includes("Sài Gòn"));
  assert.ok(options.includes("Bến xe Miền Đông cũ"));
  assert.equal(options.filter((value) => value === "Sài Gòn").length, 1);
  assert.equal(options.includes(""), false);
  assert.equal(sameTripLocation(" Huế ", "HUẾ"), true);
  assert.equal(sameTripLocation("Huế", "Đà Lạt"), false);
});

test("admin locations API reads all routes and rejects unauthorized access before querying", async () => {
  let query;
  let authorized = true;
  const { GET } = load("app/api/trips/locations/route.ts", {
    "@/lib/admin-api": {
      requireAdmin: async () => { if (!authorized) throw Object.assign(new Error("Unauthorized"), { status: 401 }); },
      apiError: (error) => Response.json({ success: false }, { status: error.status ?? 500 }),
    },
    "@/lib/prisma": { prisma: { trip: { findMany: async (value) => {
      query = value;
      return [{ from: "Bến xe Miền Đông cũ", to: "Bến xe Miền Tây cũ" }];
    } } } },
  });
  const response = await GET(new Request("http://localhost/api/trips/locations"));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const body = await response.json();
  assert.ok(body.data.includes("Bến xe Miền Đông cũ"));
  assert.ok(body.data.includes("Bến xe Miền Tây cũ"));
  assert.deepEqual(query, { select: { from: true, to: true }, distinct: ["from", "to"] });
  query = null;
  authorized = false;
  assert.equal((await GET(new Request("http://localhost/api/trips/locations"))).status, 401);
  assert.equal(query, null);
});

test("create and edit forms use native selects and retain legacy routes absent from fetched options", () => {
  const { TripModal } = load("components/admin/trips/TripModal.tsx");
  const base = { isOpen: true, onClose: () => {}, onSubmit: async () => ({ success: true }), locations: ["Huế"] };
  const createHtml = renderToStaticMarkup(createElement(TripModal, { ...base, mode: "create" }));
  assert.match(createHtml, /<select id="trip-from" name="from"/);
  assert.match(createHtml, /<select id="trip-to" name="to"/);
  const editHtml = renderToStaticMarkup(createElement(TripModal, {
    ...base, mode: "edit", initialData: {
      id: 42, from: "Bến xe Miền Đông cũ", to: "Bến xe Miền Tây cũ", time: "2099-12-02T00:00:37Z", price: 100000, totalSeats: 34,
    },
  }));
  const fromSelect = editHtml.match(/<select id="trip-from"[\s\S]*?<\/select>/)[0];
  const toSelect = editHtml.match(/<select id="trip-to"[\s\S]*?<\/select>/)[0];
  assert.ok(fromSelect.includes('<option value="Bến xe Miền Đông cũ" selected="">'));
  assert.ok(fromSelect.includes('<option value="Bến xe Miền Tây cũ" disabled="">'));
  assert.ok(toSelect.includes('<option value="Bến xe Miền Tây cũ" selected="">'));
  assert.ok(toSelect.includes('<option value="Bến xe Miền Đông cũ" disabled="">'));
});
