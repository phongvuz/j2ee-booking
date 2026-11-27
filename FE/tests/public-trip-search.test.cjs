const { test } = require("node:test");
const assert = require("node:assert/strict");
const { renderToStaticMarkup } = require("react-dom/server");
const { load } = require("./load-ts.cjs");
const { parsePublicTripFilters, publicTripUrl, tripVehicleLabel } = load("lib/public-trip-search.ts");

test("public filter URLs preserve all selections across pages and accept repeated query keys", () => {
  const filters = parsePublicTripFilters({
    from: [" Hồ Chí Minh ", "ignored"], to: "Huế", date: "2099-10-02", page: "3",
    times: ["morning", "night,morning,invalid"], vehicles: "sleeper,other,invalid",
  });
  const url = new URL(publicTripUrl(filters, 4), "http://localhost");
  assert.equal(url.searchParams.get("from"), "Hồ Chí Minh");
  assert.equal(url.searchParams.get("to"), "Huế");
  assert.equal(url.searchParams.get("date"), "2099-10-02");
  assert.equal(url.searchParams.get("times"), "morning,night");
  assert.equal(url.searchParams.get("vehicles"), "sleeper,other");
  assert.equal(url.searchParams.get("page"), "4");
  assert.equal(new URL(publicTripUrl(filters, 1), "http://localhost").searchParams.has("page"), false);
  assert.equal(parsePublicTripFilters({ page: "-4", date: "2099-02-30" }).page, 1);
});

test("public queries exclude departed and sold out trips with bounded stable pages", async () => {
  let pageQuery;
  let countQuery;
  const { queryPublicTrips, getTrips } = load("services/tripService.ts", {
    "@/lib/prisma": { prisma: { trip: {
      count: async (query) => { countQuery = query; return 23; },
      findMany: async (query) => { pageQuery = query; return []; },
    } } },
  });
  const before = Date.now();
  const result = await queryPublicTrips({ fromCity: "Huế", page: 99, limit: 10, vehicles: ["sleeper", "other"] });
  assert.deepEqual(result.pagination, { total: 23, page: 3, limit: 10, totalPages: 3 });
  assert.deepEqual(pageQuery.where, countQuery.where);
  assert.deepEqual(pageQuery.where.availableSeats, { gt: 0 });
  assert.ok(pageQuery.where.time.gt.getTime() >= before);
  assert.ok(pageQuery.where.time.gt.getTime() <= Date.now());
  assert.deepEqual(pageQuery.where.from, { contains: "Huế" });
  assert.deepEqual(pageQuery.where.bus, { is: { OR: [
    { type: { contains: "Giường nằm" } },
    { AND: [{ NOT: { type: { contains: "Limousine" } } }, { NOT: { type: { contains: "Giường nằm" } } }] },
  ] } });
  assert.deepEqual(pageQuery.include.bus.select, { id: true, plate: true, type: true, capacity: true, status: true });
  assert.deepEqual(pageQuery.orderBy, [{ time: "asc" }, { id: "asc" }]);
  assert.equal(pageQuery.skip, 20);
  assert.equal(pageQuery.take, 10);
  await getTrips({ includeBookings: true });
  assert.deepEqual(pageQuery.where.availableSeats, { gt: 0 });
  assert.ok(pageQuery.where.time.gt instanceof Date);
  assert.ok(pageQuery.include.booking);
  assert.equal(pageQuery.take, 20);
  await assert.rejects(getTrips({ date: "2099-02-30" }), /Ngày lọc/);
});

test("Vietnam hour filters are bound in SQL before counting and pagination", async () => {
  const queries = [];
  let pageQuery;
  const maliciousCity = "Huế' OR 1=1 --";
  const { queryPublicTrips } = load("services/tripService.ts", {
    "@/lib/prisma": { prisma: {
      $queryRaw: async (query) => { queries.push(query); return queries.length === 1 ? [{ total: 12n }] : [{ id: 19 }, { id: 20 }]; },
      trip: { findMany: async (query) => { pageQuery = query; return [{ id: 19, bus: { capacity: 22 } }, { id: 20, bus: { capacity: 22 } }]; } },
    } },
  });
  const result = await queryPublicTrips({ fromCity: maliciousCity, date: "2099-10-02", page: 2, times: ["morning", "night"], vehicles: ["limousine"] });
  assert.deepEqual(result.pagination, { total: 12, page: 2, limit: 10, totalPages: 2 });
  assert.equal(queries.length, 2);
  for (const query of queries) {
    assert.match(query.sql, /HOUR\(DATE_ADD\(t\.time, INTERVAL 7 HOUR\)\)/);
    assert.match(query.sql, /INNER JOIN bus b ON b\.id = t\.busId/);
    assert.match(query.sql, /availableSeats > 0/);
    assert.equal(query.sql.includes(maliciousCity), false);
    assert.ok(query.values.includes(`%${maliciousCity}%`));
  }
  assert.deepEqual(queries[0].values.slice(-5), ["%Limousine%", 6, 12, 18, 24]);
  assert.deepEqual(queries[1].values.slice(0, -2), queries[0].values);
  assert.deepEqual(queries[1].values.slice(-2), [10, 10]);
  assert.match(queries[1].sql, /ORDER BY t\.time ASC, t\.id ASC LIMIT \? OFFSET \?/);
  assert.deepEqual(pageQuery.where.AND[1], { id: { in: [19, 20] } });
  assert.deepEqual(pageQuery.where.AND[0].availableSeats, { gt: 0 });
  assert.ok(pageQuery.where.AND[0].time.gt instanceof Date);
  assert.deepEqual(pageQuery.orderBy, [{ time: "asc" }, { id: "asc" }]);
  assert.equal(pageQuery.skip, undefined);
});

test("vehicle labels use the assigned bus type and page links keep active filters", () => {
  assert.equal(tripVehicleLabel(22), "Limousine 22 phòng");
  assert.equal(tripVehicleLabel(34), "Giường nằm 34 chỗ");
  assert.equal(tripVehicleLabel(36), "Xe 36 chỗ");
  assert.equal(tripVehicleLabel(34, "Limousine 34 chỗ"), "Limousine 34 chỗ");
  const { default: TripFilter } = load("components/trips/TripFilter.tsx", {
    "next/navigation": { useRouter: () => ({ push: () => {} }) },
  });
  const html = renderToStaticMarkup(require("react").createElement(TripFilter, {
    initialTrips: [
      { id: 1, from: "A", to: "B", time: "2099-10-02T00:00:00Z", price: 100000, availableSeats: 1, capacity: 34, busId: "BUS-A", bus: { id: "BUS-A", capacity: 34, type: "Giường nằm 34 chỗ", plate: "51B-10001" } },
      { id: 2, from: "A", to: "B", time: "2099-10-02T00:00:00Z", price: 100000, availableSeats: 20, capacity: 36, busId: "BUS-B", bus: { id: "BUS-B", capacity: 36, type: "Xe 36 chỗ", plate: "51B-10002" } },
    ],
    filters: parsePublicTripFilters({ from: "A", times: "morning", vehicles: "sleeper,other" }),
    pagination: { page: 1, limit: 10, total: 12, totalPages: 2 },
  }));
  assert.match(html, /Giường nằm 34 chỗ/);
  assert.match(html, /Xe 36 chỗ/);
  assert.equal(html.includes("Limousine 22 phòng"), false);
  assert.ok(html.includes("times=morning&amp;vehicles=sleeper%2Cother&amp;page=2"));
  assert.match(html, /Tìm thấy 12 chuyến xe/);
});

test("public trip API paginates without admin access while explicit admin mode stays protected", async () => {
  let adminChecks = 0;
  let publicQuery;
  const { GET } = load("app/api/trips/route.ts", {
    "@/lib/admin-api": {
      requireAdmin: async () => { adminChecks += 1; throw Object.assign(new Error("Unauthorized"), { status: 401 }); },
      apiError: (error) => Response.json({ success: false }, { status: error.status ?? 500 }),
    },
    "@/services/tripService": {
      queryPublicTrips: async (query) => {
        publicQuery = query;
        return { data: [{ id: 11, capacity: 34 }], pagination: { page: 2, limit: 10, total: 11, totalPages: 2 } };
      },
    },
  });
  const response = await GET(new Request("http://localhost/api/trips?from=SGN&to=Hu%E1%BA%BF&page=2&limit=10&times=morning&times=invalid&vehicles=sleeper"));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(adminChecks, 0);
  assert.deepEqual(publicQuery, {
    fromCity: "Hồ Chí Minh", toCity: "Huế", date: "", times: ["morning"], vehicles: ["sleeper"], page: 2, limit: 10,
  });
  assert.deepEqual(body.pagination, { page: 2, limit: 10, total: 11, totalPages: 2 });
  assert.equal(body.count, 1);
  const adminResponse = await GET(new Request("http://localhost/api/trips?admin=true&page=2"));
  assert.equal(adminResponse.status, 401);
  assert.equal(adminChecks, 1);
});
