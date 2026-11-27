const { test } = require("node:test");
const assert = require("node:assert/strict");
const { assertLocalDatabase, buildDriverTestData, seedDriverData } = require("../scripts/seed-drivers.cjs");
const { load } = require("./load-ts.cjs");

const now = new Date("2026-11-06T23:00:00Z");

test("driver seed rejects remote, production and system databases without exposing credentials", () => {
  for (const environment of [
    {}, { DATABASE_URL: "private-connection" },
    { DATABASE_URL: "mysql://secret:password@remote.example.test/application" },
    { DATABASE_URL: "mysql://localhost/application", NODE_ENV: "production" },
    { DATABASE_URL: "postgres://localhost/application" },
    ...["", "mysql", "sys", "information_schema", "performance_schema"].map((database) => ({ DATABASE_URL: `mysql://localhost/${database}` })),
  ]) {
    assert.throws(() => assertLocalDatabase(environment), (error) => !/password|private-connection/.test(error.message));
  }
  assert.equal(assertLocalDatabase({ DATABASE_URL: "mysql://localhost/application" }), "application");
  assert.equal(assertLocalDatabase({ DATABASE_URL: "mysql://[::1]/application" }), "application");
});

test("driver fixtures match employee and bus validation and contain no bookings or payments", () => {
  const { employeeSchema } = load("lib/validations/employee.ts");
  const { busSchema } = load("lib/validations/bus.ts");
  const data = buildDriverTestData(now);
  assert.deepEqual(Object.keys(data), ["employees", "buses", "trips"]);
  assert.equal(data.employees.length, 9);
  assert.equal(data.buses.length, 5);
  assert.equal(data.trips.length, 9);
  for (const employee of data.employees) assert.equal(employeeSchema.safeParse(employee).success, true, employee.id);
  for (const bus of data.buses) assert.equal(busSchema.safeParse(bus).success, true, bus.id);
  assert.equal(new Set(data.employees.map((employee) => employee.email)).size, 9);
  assert.equal(new Set(data.employees.map((employee) => employee.phone)).size, 9);
  for (const { data: trip } of data.trips) {
    assert.ok(trip.endsAt > trip.time);
    assert.equal(Object.hasOwn(trip, "capacity"), false);
    assert.equal(trip.availableSeats, data.buses.find((bus) => bus.id === trip.busId).capacity);
    if (trip.driverId) {
      const driver = data.employees.find((employee) => employee.id === trip.driverId);
      assert.equal(driver.role, "Tài xế");
      assert.equal(driver.status, "Đang làm việc");
    }
  }
});

test("driver fixtures cover overlap, adjacent hours, late replacement, overdue departure and completion", () => {
  const { employees, trips } = buildDriverTestData(now);
  const [busy, adjacent, running, delayed, driverConflict, busConflict, completed, ready, draft] = trips.map((entry) => entry.data);
  assert.equal(busy.time.toISOString(), "2026-11-08T01:00:00.000Z");
  assert.equal(adjacent.endsAt.getTime(), busy.time.getTime());
  assert.equal(running.status, "DEPARTED");
  assert.ok(running.endsAt < now);
  assert.equal(driverConflict.driverId, running.driverId);
  assert.equal(busConflict.busId, running.busId);
  assert.ok(driverConflict.time >= running.endsAt);
  assert.ok(delayed.time < now && delayed.endsAt > now && delayed.status === "OPEN");
  assert.equal(ready.driverId, completed.driverId);
  assert.equal(ready.busId, completed.busId);
  assert.equal(completed.status, "COMPLETED");
  assert.equal(draft.status, "DRAFT");
  assert.equal(draft.driverId, null);
  assert.equal(employees[0].name, employees[5].name);
  assert.notEqual(employees[0].id, employees[5].id);
  assert.equal(trips.some((entry) => entry.data.driverId === employees[5].id), false);
  assert.equal(employees[2].status, "Nghỉ phép");
  assert.equal(employees[3].status, "Đã nghỉ việc");
  assert.equal(employees[8].role, "Phụ xe");
});

test("driver seed is additive, transactional and refuses duplicate fixture data", async () => {
  const writes = [];
  let occupied = false;
  const prisma = { $transaction: async (work, options) => {
    assert.equal(options.isolationLevel, "Serializable");
    const tx = {};
    for (const model of ["employee", "bus", "trip"]) tx[model] = {
      count: async ({ where }) => { assert.match(where.id.startsWith, /DISPATCH-TEST-/); return occupied ? 1 : 0; },
      create: async ({ data }) => { writes.push({ model, data }); return { id: writes.length, ...data }; },
    };
    return work(tx);
  } };
  const result = await seedDriverData(prisma, now);
  assert.equal(writes.length, 23);
  assert.equal(result.trips.length, 9);
  assert.deepEqual([...new Set(writes.map((write) => write.model))], ["employee", "bus", "trip"]);
  occupied = true;
  await assert.rejects(seedDriverData(prisma, now), /Không tạo trùng/);
  assert.equal(writes.length, 23);
});
