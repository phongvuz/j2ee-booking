const { test } = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./load-ts.cjs");

test("employee statistics count the filtered set rather than the current page", async () => {
  const countQueries = [];
  let pageQuery;
  const counts = [25, 18, 4, 12];
  const prisma = { employee: {
    count: async (query) => { countQueries.push(query); return counts[countQueries.length - 1]; },
    findMany: async (query) => { pageQuery = query; return []; },
  } };
  const { queryEmployees } = load("services/employeeService.ts", { "@/lib/prisma": { prisma } });
  const result = await queryEmployees({ search: " an ", department: "Office", page: 2, limit: 8 });
  assert.deepEqual(result.stats, { total: 25, active: 18, onLeave: 4, drivers: 12 });
  assert.deepEqual(result.pagination, { page: 2, limit: 8, total: 25, totalPages: 4 });
  assert.equal(pageQuery.skip, 8);
  assert.equal(pageQuery.take, 8);
  assert.deepEqual(pageQuery.where, countQueries[0].where);
  assert.equal(pageQuery.where.department, "Office");
  assert.deepEqual(pageQuery.where.OR[0], { name: { contains: "an" } });
  for (const query of countQueries.slice(1)) {
    assert.deepEqual(query.where.AND[0], pageQuery.where);
    assert.equal(query.where.AND.length, 2);
  }
});

test("dashboard uses aggregates and displays only alerts supported by data", async () => {
  const revenue = [2000, 1000, 500];
  const aggregates = [];
  let recentQuery;
  const prisma = {
    bookingTransaction: {
      groupBy: async (query) => {
        aggregates.push(query);
        return [{ kind: "RECEIPT", _sum: { amount: revenue[aggregates.length - 1] }, _count: { _all: 5 } }];
      },
      count: async () => 10,
    },
    booking: {
      aggregate: async (query) => {
        aggregates.push(query);
        return { _sum: { totalPrice: revenue[aggregates.length - 1] }, _count: { _all: 5 } };
      },
      count: async () => 10,
      findMany: async (query) => { recentQuery = query; return []; },
    },
    bus: { groupBy: async () => [{ status: "Đang hoạt động", _count: { _all: 100 } }], findMany: async () => [] },
    employee: { groupBy: async () => [{ status: "Đang làm việc", _count: { _all: 30 } }], findMany: async () => [] },
    trip: { count: async () => 200 }, user: { count: async () => 500 },
  };
  const { getDashboardStats } = load("services/dashboardService.ts", { "@/lib/prisma": { prisma }, "@/services/bookingFinanceService": { getFinancePositions: async () => [] } });
  const result = await getDashboardStats();
  assert.equal(result.revenueThisMonth, 2000);
  assert.equal(result.revenueToday, 500);
  assert.equal(result.revenueGrowthPercent, 100);
  assert.equal(result.ticketsGrowthPercent, -50);
  assert.equal(result.totalBuses, 100);
  assert.equal(result.totalEmployees, 30);
  assert.deepEqual(result.systemAlerts, []);
  assert.equal(recentQuery.take, 6);
  assert.ok(aggregates.every((query) => query.where.method.not === "DEMO"));
  assert.ok(aggregates.every((query) => query.where.createdAt && !query.where.status));
});

test("featured routes exclude departed and full trips and use database prices", async () => {
  let query;
  const routes = [{ from: "A", to: "B", _min: { price: 123456 } }];
  const prisma = { trip: { groupBy: async (value) => { query = value; return routes; } } };
  const { getFeaturedRoutes } = load("services/tripService.ts", { "@/lib/prisma": { prisma } });
  const before = Date.now();
  assert.deepEqual(await getFeaturedRoutes(), routes);
  assert.ok(query.where.time.gte.getTime() >= before);
  assert.ok(query.where.time.gte.getTime() <= Date.now());
  assert.deepEqual(query.where.availableSeats, { gt: 0 });
  assert.deepEqual(query.by, ["from", "to"]);
  assert.deepEqual(query._min, { price: true });
});
