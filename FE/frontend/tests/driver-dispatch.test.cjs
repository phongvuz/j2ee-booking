const { test } = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { load } = require("./load-ts.cjs");

function apiSetup(trips = []) {
  const state = { authorized: true, reads: 0, query: null };
  const drivers = Array.from({ length: 10 }, (_, index) => ({
    id: `EMP-${index + 1}`, name: "Driver", status: index === 8 ? "Nghỉ phép" : "Đang làm việc",
  }));
  const { GET } = load("app/api/admin/dispatch/route.ts", {
    "@/lib/admin-api": {
      requireAdmin: async () => { if (!state.authorized) throw Object.assign(new Error("Unauthorized"), { status: 401 }); },
      apiError: (error) => Response.json({ success: false, message: error.message }, { status: error.status ?? 500 }),
    },
    "@/lib/prisma": { prisma: {
      bus: { findMany: async () => { state.reads++; return []; } },
      employee: { findMany: async (query) => {
        state.reads++;
        assert.deepEqual(query.where, { role: "Tài xế" });
        return drivers;
      } },
      trip: { findMany: async (query) => {
        state.reads++;
        state.query = query;
        const where = query.where;
        return trips.filter((trip) => trip.id !== where.id?.not && where.driverId.in.includes(trip.driverId)
          && where.AND[0].OR.some((condition) => typeof condition.status === "string"
            ? trip.status === condition.status
            : condition.status.in.includes(trip.status) && trip.time < condition.time.lt && trip.endsAt > condition.endsAt.gt));
      } },
    } },
  });
  const get = (params = {}) => GET(new Request(`http://localhost/api/admin/dispatch?${new URLSearchParams(params)}`));
  return { get, state };
}

const windowParams = { time: "2099-12-02T08:00", endsAt: "2099-12-02T10:00", excludeTripId: "7" };

test("dispatch requires admin and rejects invalid intervals or IDs before database reads", async () => {
  const { get, state } = apiSetup();
  state.authorized = false;
  assert.equal((await get(windowParams)).status, 401);
  assert.equal(state.reads, 0);
  state.authorized = true;
  for (const params of [
    { time: windowParams.time }, { endsAt: windowParams.endsAt }, { time: "", endsAt: "" },
    { ...windowParams, time: "2099-02-30T08:00" }, { ...windowParams, time: "2099-12-02T25:00" },
    { ...windowParams, time: "not-a-date" }, { ...windowParams, time: "12/02/2099 08:00" },
    { ...windowParams, time: "2099-12-02T08:00:30" },
    { ...windowParams, endsAt: windowParams.time }, { ...windowParams, endsAt: "2099-12-02T07:00" },
    ...["", "0", "-1", "1.2", "7abc", "2147483648"].map((excludeTripId) => ({ ...windowParams, excludeTripId })),
  ]) {
    assert.equal((await get(params)).status, 400, JSON.stringify(params));
    assert.equal(state.reads, 0);
  }
});

test("dispatch without interval never calls a working driver available", async () => {
  const { get, state } = apiSetup();
  const response = await get();
  assert.equal(response.headers.get("cache-control"), "no-store");
  const { data } = await response.json();
  assert.ok(data.drivers.every((driver) => !driver.available && driver.conflictTripId === null));
  assert.match(data.drivers[0].reason, /Chọn giờ/);
  assert.equal(data.drivers[8].reason, "Nghỉ phép");
  assert.equal(state.query, null);
});

test("availability excludes own trip, inactive staff and overlaps but accepts adjacent and future schedules", async () => {
  const trip = (id, driver, status, start = "08:00", end = "10:00") => ({
    id, driverId: `EMP-${driver}`, status,
    time: new Date(`2099-12-02T${start}:00+07:00`), endsAt: new Date(`2099-12-02T${end}:00+07:00`),
  });
  const { get, state } = apiSetup([
    trip(7, 1, "OPEN"), trip(8, 2, "OPEN", "09:00", "11:00"), trip(9, 3, "OPEN", "07:00", "08:00"),
    trip(10, 4, "DRAFT"), trip(11, 5, "COMPLETED"), trip(12, 6, "CANCELLED"), trip(13, 7, "DEPARTED"),
    { ...trip(14, 8, "DEPARTED"), time: new Date(Date.now() - 7200000), endsAt: new Date(Date.now() - 3600000) },
    trip(15, 10, "OPEN", "10:00", "11:00"),
  ]);
  const { data } = await (await get(windowParams)).json();
  assert.deepEqual(data.drivers.map((driver) => driver.available), [true, false, true, true, true, true, false, true, false, true]);
  assert.equal(data.drivers[1].conflictTripId, 8);
  assert.match(data.drivers[1].reason, /#8/);
  assert.equal(data.drivers[6].conflictTripId, 13);
  assert.equal(state.query.where.AND[0].OR.length, 1);
  assert.equal(state.query.where.AND[0].OR[0].time.lt.toISOString(), "2099-12-02T03:00:00.000Z");
  assert.equal(state.query.where.AND[0].OR[0].endsAt.gt.toISOString(), "2099-12-02T01:00:00.000Z");
});

test("immediate dispatch keeps an overdue DEPARTED trip busy until completed", async () => {
  const previous = { id: 99, driverId: "EMP-1", status: "DEPARTED", time: new Date(Date.now() - 7200000), endsAt: new Date(Date.now() - 3600000) };
  const { get } = apiSetup([previous]);
  const params = { time: new Date(Date.now() - 60000).toISOString(), endsAt: new Date(Date.now() + 3600000).toISOString(), excludeTripId: "7" };
  const busy = (await (await get(params)).json()).data.drivers[0];
  assert.equal(busy.available, false);
  assert.equal(busy.conflictTripId, 99);
  previous.status = "COMPLETED";
  assert.equal((await (await get(params)).json()).data.drivers[0].available, true);
});

function formSetup(status = "OPEN") {
  const values = [];
  let index = 0;
  let loadDispatch;
  const requests = [];
  const remote = { loading: false, error: null, refresh: () => {}, data: { buses: [], drivers: [
    { id: "EMP-1", name: "Same name", available: true, reason: "Rảnh theo lịch" },
    { id: "EMP-2", name: "Same name", available: false, reason: "Bận chuyến #99" },
  ] } };
  const initialData = {
    id: 7, status, from: "Sai Gon", to: "Da Lat", time: "2099-12-02T01:00:37Z", endsAt: "2099-12-02T03:00:49Z",
    totalSeats: 3, price: 100000, busId: "BUS-1", driverId: "EMP-1",
  };
  const { TripModal } = load("components/admin/trips/TripModal.tsx", {
    react: { ...React, useCallback: (callback) => callback, useState: (initial) => {
      const position = index++;
      if (!(position in values)) values[position] = typeof initial === "function" ? initial() : initial;
      return [values[position], (value) => { values[position] = value; }];
    } },
    "@/hooks/useRemoteData": { useRemoteData: (callback, initial) => {
      if (Array.isArray(initial)) return { ...remote, data: [] };
      loadDispatch = callback;
      return remote;
    } },
    "@/lib/api-client": { requestJson: async (url, options) => { requests.push({ url, options }); return { data: remote.data }; } },
  });
  return {
    remote, requests,
    render: () => { index = 0; return TripModal({ isOpen: true, mode: "edit", initialData, onClose: () => {}, onSubmit: async () => ({ success: true }) }); },
    fetch: () => loadDispatch(new AbortController().signal),
  };
}

function elements(node) {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!node?.props) return [];
  return [node, ...elements(node.props.children)];
}

test("driver form refreshes interval query, preserves timestamp precision and identifies same-name drivers", async () => {
  const form = formSetup();
  let nodes = elements(form.render());
  await form.fetch();
  let params = new URL(form.requests[0].url, "http://localhost").searchParams;
  assert.equal(params.get("time"), "2099-12-02T01:00:37Z");
  assert.equal(params.get("endsAt"), "2099-12-02T03:00:49Z");
  assert.equal(params.get("excludeTripId"), "7");
  const busyOption = nodes.find((node) => node.type === "option" && node.props.value === "EMP-2");
  assert.equal(busyOption.props.disabled, true);
  assert.match(busyOption.props.children.join(""), /EMP-2.*Same name.*#99/);
  nodes.find((node) => node.props.id === "trip-time").props.onChange({ target: { value: "2099-12-03T08:00" } });
  nodes = elements(form.render());
  nodes.find((node) => node.props.id === "trip-ends-at").props.onChange({ target: { value: "2099-12-03T10:00" } });
  form.render();
  await form.fetch();
  params = new URL(form.requests[1].url, "http://localhost").searchParams;
  assert.equal(params.get("time"), "2099-12-03T08:00");
  assert.equal(params.get("endsAt"), "2099-12-03T10:00");
  assert.ok(form.requests[1].options.signal instanceof AbortSignal);
});

test("driver form blocks stale choices during reload or failure and locks departed assignments", () => {
  const form = formSetup();
  for (const state of [{ loading: true, error: null }, { loading: false, error: "Network error" }]) {
    Object.assign(form.remote, state);
    const nodes = elements(form.render());
    const driverSelect = nodes.find((node) => node.type === "select" && node.props.value === "EMP-1");
    assert.equal(driverSelect.props.disabled, true);
    const option = nodes.find((node) => node.type === "option" && node.props.value === "EMP-1");
    assert.doesNotMatch(option.props.children.join(""), /Rảnh theo lịch/);
  }
  for (const status of ["DEPARTED", "COMPLETED", "CANCELLED"]) {
    const nodes = elements(formSetup(status).render());
    assert.equal(nodes.find((node) => node.type === "select" && node.props.value === "EMP-1").props.disabled, true);
  }
});
