const { test } = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./load-ts.cjs");
const { renderToStaticMarkup } = require("react-dom/server");

const services = [
  ["services/tripService.ts", "queryTripsAdmin", "trip", ["createdAt", "time", "price", "availableSeats", "id"]],
  ["services/busService.ts", "queryBuses", "bus", ["createdAt", "plate", "capacity", "id"]],
  ["services/employeeService.ts", "queryEmployees", "employee", ["createdAt", "name", "id"]],
  ["services/userService.ts", "queryUsers", "user", ["createdAt", "fullName", "id"]],
];

function mockPrisma(onFindMany) {
  const prisma = {};
  for (const model of ["trip", "bus", "employee", "booking", "user"]) {
    prisma[model] = {
      count: async () => 20,
      groupBy: async () => [],
      findMany: async (query) => onFindMany(model, query),
    };
  }
  return prisma;
}

for (const [file, name, model, fields] of services) {
  test(`${name} supports both directions for every sortable field with pagination and filters`, async () => {
    const prisma = mockPrisma(() => []);
    const service = load(file, { "@/lib/prisma": { prisma } });
    for (const sortBy of fields) {
      for (const sortOrder of ["asc", "desc"]) {
        prisma[model].findMany = async (query) => {
          if (query.select?.bus) return [];
          const clauses = Array.isArray(query.orderBy) ? query.orderBy : [query.orderBy];
          assert.deepEqual(clauses[0], { [sortBy]: sortOrder });
          assert.deepEqual(clauses.slice(1), sortBy === "id" ? [] : [{ id: "desc" }]);
          assert.equal(query.skip, 8);
          assert.equal(query.take, 8);
          assert.ok(query.where.OR.length > 0);
          return [];
        };
        const result = await service[name]({ search: "Sài Gòn", page: 2, limit: 8, sortBy, sortOrder });
        assert.equal(result.pagination.page, 2);
        assert.equal(result.pagination.total, 20);
      }
    }
  });
}

test("new trips appear first by creation date, departure sorting is selectable, and tied rows have stable pages", async () => {
  const older = new Date("2026-10-10T01:00:00Z");
  const newer = new Date("2026-10-11T01:00:00Z");
  const rows = [
    { id: 1, createdAt: older, time: new Date("2026-10-12T01:00:00Z") },
    { id: 2, createdAt: newer, time: new Date("2026-10-14T01:00:00Z") },
    { id: 3, createdAt: newer, time: new Date("2026-10-15T01:00:00Z") },
  ].map((row) => ({ ...row, from: "Sài Gòn", to: "Đà Lạt", price: 300000, busId: "BUS-001", bus: { id: "BUS-001", plate: "51B-123.45", type: "Limousine", capacity: 22, status: "Đang hoạt động" }, availableSeats: 22, booking: [] }));
  const prisma = mockPrisma((model, query) => {
    if (query.select?.bus) return rows.map((row) => ({ bus: row.bus }));
    const clauses = Array.isArray(query.orderBy) ? query.orderBy : [query.orderBy];
    const sorted = [...rows].sort((a, b) => {
      for (const clause of clauses) {
        const [field, direction] = Object.entries(clause)[0];
        const comparison = a[field] < b[field] ? -1 : a[field] > b[field] ? 1 : 0;
        if (comparison) return direction === "asc" ? comparison : -comparison;
      }
      return 0;
    });
    return sorted.slice(query.skip, query.skip + query.take);
  });
  prisma.trip.count = async () => rows.length;
  const { queryTripsAdmin } = load("services/tripService.ts", { "@/lib/prisma": { prisma } });
  assert.deepEqual((await queryTripsAdmin({})).data.map((row) => row.id), [3, 2, 1]);
  assert.deepEqual((await queryTripsAdmin({ sortBy: "time", sortOrder: "asc" })).data.map((row) => row.id), [1, 2, 3]);
  const first = await queryTripsAdmin({ limit: 1 });
  const second = await queryTripsAdmin({ limit: 1, page: 2 });
  assert.deepEqual([...first.data, ...second.data].map((row) => row.id), [3, 2]);
});

test("payment sorting preserves review filters and sorting in pagination links", async () => {
  let pageQuery;
  let sortProps;
  const { default: PaymentsPage } = load("app/admin/payments/page.tsx", {
    "@/lib/admin-api": { requireAdmin: async () => ({ role: "ADMIN" }) },
    "@/lib/prisma": { prisma: { bookingTransaction: { count: async () => 0, findMany: async () => [] }, payment: {
      count: async () => 41,
      findMany: async (query) => { pageQuery = query; return []; },
    } } },
    "@/components/admin/TableSortNavigation": { TableSortNavigation: (props) => { sortProps = props; return null; } },
  });
  const html = renderToStaticMarkup(await PaymentsPage({ searchParams: Promise.resolve({
    review: "1", page: "2", sortBy: "amount", sortOrder: "asc",
  }) }));
  assert.deepEqual(pageQuery.where, { status: "REVIEW" });
  assert.deepEqual(pageQuery.orderBy, [{ amount: "asc" }, { id: "desc" }]);
  assert.equal(pageQuery.take, 10);
  assert.equal(pageQuery.skip, 10);
  assert.deepEqual(sortProps.value, { sortBy: "amount", sortOrder: "asc" });
  assert.equal(new URLSearchParams(sortProps.query).get("review"), "1");
  assert.ok(html.includes("/admin/payments?sortBy=amount&amp;sortOrder=asc&amp;review=1&amp;page=3"));
  assert.ok(html.includes("/admin/payments?sortBy=amount&amp;sortOrder=asc&amp;review=1"));
  renderToStaticMarkup(await PaymentsPage({ searchParams: Promise.resolve({ sortBy: "unknown", sortOrder: "invalid" }) }));
  assert.deepEqual(pageQuery.orderBy, [{ createdAt: "desc" }, { id: "desc" }]);
});
