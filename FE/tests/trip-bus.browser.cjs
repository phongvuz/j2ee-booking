// Real Chrome + Next.js + MySQL. Only a freshly owned demo database and a
// temporary Chrome profile are used; no existing browser session is accessed.
require("dotenv").config({ quiet: true });
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { randomBytes } = require("node:crypto");
const { spawn, spawnSync } = require("node:child_process");
const { PrismaClient } = require("@prisma/client");
const { createConfiguration, parseArguments, accounts } = require("../scripts/demo.cjs");
const { Cdp, waitUntil, unusedPort, stopChild } = require("./browser-cdp.cjs");
const { load } = require("./load-ts.cjs");

test("trip forms derive seats from the selected bus and preserve booked seats when assigning buses", { timeout: 240000 }, async () => {
  const chromePath = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find((candidate) => fs.existsSync(candidate));
  assert.ok(chromePath, "Install Chrome or Edge to run this optional browser test");
  const demoBuild = process.env.SGU_DEMO !== "false";
  assert.ok(fs.existsSync(path.resolve(demoBuild ? ".next-demo/BUILD_ID" : ".next/BUILD_ID")), "Build first with the same SGU_DEMO setting (defaults to true for this isolated test)");
  const database = `sgu_booking_demo_browser_bus_${Date.now()}_${randomBytes(3).toString("hex")}`;
  const configuration = createConfiguration(parseArguments(["--database", database, "--no-start"]), process.env);
  const control = new PrismaClient({ datasources: { db: { url: configuration.controlUrl } } });
  const prisma = new PrismaClient({ datasources: { db: { url: configuration.targetUrl } } });
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "sgu-trip-bus-browser-"));
  const env = { ...configuration.childEnvironment, SGU_DEMO: demoBuild ? "true" : "false", NODE_ENV: "production" };
  let ownedDatabase = false;
  let server;
  let chrome;
  let cdp;
  let browserContextId;
  let sessionId;
  try {
    const existing = await control.$queryRaw`SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ${database}`;
    assert.equal(existing.length, 0, "The test must create a fresh database");
    const prepared = spawnSync(process.execPath, ["scripts/demo.cjs", "--database", database, "--no-start"], { env: process.env, cwd: path.resolve(__dirname, ".."), encoding: "utf8", windowsHide: true });
    assert.equal(prepared.status, 0, "Isolated demo setup failed; connection details are suppressed");
    ownedDatabase = true;
    const busA = { id: "BROWSER-BUS-A", plate: "51B-112.00", type: "Ghế ngồi kiểm thử", capacity: 12, status: "Đang hoạt động" };
    const busB = { id: "BROWSER-BUS-B", plate: "51B-118.00", type: "Ghế ngồi kiểm thử", capacity: 18, status: "Đang hoạt động" };
    const busC = { id: "BROWSER-BUS-C", plate: "51B-218.00", type: "Ghế ngồi kiểm thử", capacity: 18, status: "Đang hoạt động" };
    const inactiveBus = { id: "BROWSER-BUS-INACTIVE", plate: "51B-312.00", type: "Xe chưa xác minh", capacity: 12, status: "Ngừng hoạt động" };
    await prisma.bus.createMany({ data: [busA, busB, busC, inactiveBus] });
    const admin = await prisma.user.findUnique({ where: { phone: accounts.admin } });
    assert.ok(admin);
    const { createSessionToken, SESSION_COOKIE } = load("lib/session.ts", { "@/lib/prisma": { prisma } });
    const previousSecret = process.env.SESSION_SECRET;
    let token;
    try {
      process.env.SESSION_SECRET = env.SESSION_SECRET;
      token = createSessionToken(admin.id, admin.password);
    } finally {
      if (previousSecret === undefined) delete process.env.SESSION_SECRET;
      else process.env.SESSION_SECRET = previousSecret;
    }
    const port = await unusedPort();
    const baseUrl = `http://127.0.0.1:${port}`;
    server = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "start", "-H", "127.0.0.1", "-p", String(port)], { env, windowsHide: true, stdio: "ignore" });
    await waitUntil(async () => {
      if (server.exitCode !== null) throw new Error("The isolated Next server exited");
      return (await fetch(`${baseUrl}/api/trips?limit=1`)).ok;
    }, "The isolated Next server did not start", 30000);
    chrome = spawn(chromePath, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { windowsHide: true, stdio: "ignore" });
    const activePortPath = path.join(profile, "DevToolsActivePort");
    const activePort = await waitUntil(() => fs.existsSync(activePortPath) && fs.readFileSync(activePortPath, "utf8").trim().split(/\r?\n/), "Chrome DevTools did not start");
    const socket = new WebSocket(`ws://127.0.0.1:${activePort[0]}${activePort[1]}`);
    await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
    cdp = new Cdp(socket);
    ({ browserContextId } = await cdp.send("Target.createBrowserContext"));
    const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank", browserContextId });
    ({ sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true }));
    await cdp.send("Page.enable", {}, sessionId);
    await cdp.send("Network.enable", {}, sessionId);
    await cdp.send("Runtime.enable", {}, sessionId);
    await cdp.send("Network.setCookie", { name: SESSION_COOKIE, value: token, url: baseUrl, httpOnly: true, sameSite: "Lax", secure: true }, sessionId);
    await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: `
      window.busTripSmoke = { errors: [], writes: [] };
      window.addEventListener("error", (event) => window.busTripSmoke.errors.push(event.message));
      const originalFetch = window.fetch;
      window.fetch = async (...args) => {
        const response = await originalFetch(...args);
        if (args[1]?.method && args[1].method !== "GET") window.busTripSmoke.writes.push({ path: new URL(args[0], location.href).pathname, status: response.status, body: args[1].body ? JSON.parse(args[1].body) : null });
        return response;
      };
    ` }, sessionId);
    const evaluate = (expression) => cdp.evaluate(sessionId, expression);
    const api = (method, url, body) => evaluate(`fetch(${JSON.stringify(url)}, { method: ${JSON.stringify(method)}, headers: { "Content-Type": "application/json" }, body: JSON.stringify(${JSON.stringify(body)}) }).then(async response => ({ status: response.status, body: await response.json() }))`);
    async function setField(id, value) {
      await evaluate(`(() => { const field = document.getElementById(${JSON.stringify(id)}); const prototype = field.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(prototype, "value").set.call(field, ${JSON.stringify(value)}); field.dispatchEvent(new Event(field.tagName === "SELECT" ? "change" : "input", { bubbles: true })); })()`);
    }
    async function waitForBusOptions() {
      await waitUntil(() => evaluate(`document.querySelector("#trip-bus")?.disabled === false && Array.from(document.querySelector("#trip-bus").options).some(option => option.value === ${JSON.stringify(busA.id)})`), "Active bus options did not load");
    }
    async function saveModal() {
      await evaluate("document.querySelector('#trip-bus').closest('form').requestSubmit()");
      await waitUntil(() => evaluate("document.querySelector('#trip-bus') === null"), "Trip form did not save");
    }
    async function openEdit(id) {
      await waitUntil(() => evaluate(`Array.from(document.querySelectorAll("tbody tr")).some(row => row.cells[0]?.textContent.trim() === ${JSON.stringify(String(id))})`), "The saved trip did not appear in the refreshed list");
      await evaluate(`Array.from(document.querySelectorAll("tbody tr")).find(row => row.cells[0]?.textContent.trim() === ${JSON.stringify(String(id))}).querySelector('button[aria-label="Chỉnh sửa chuyến xe"]').click()`);
      await waitForBusOptions();
    }
    await cdp.send("Page.navigate", { url: `${baseUrl}/admin/trips` }, sessionId);
    await waitUntil(() => evaluate("document.querySelector('tbody tr') !== null"), "The admin list did not load");
    const locations = await evaluate("fetch('/api/trips/locations').then(response => response.json()).then(result => result.data)");
    assert.ok(locations.length >= 2);
    await evaluate("Array.from(document.querySelectorAll('button')).find(button => button.textContent.includes('Thêm chuyến xe mới')).click()");
    await waitForBusOptions();
    assert.equal(await evaluate(`Array.from(document.querySelector("#trip-bus").options).some(option => option.value === ${JSON.stringify(inactiveBus.id)})`), false);
    assert.equal(await evaluate("document.querySelector('input[name=capacity]') !== null"), false);
    assert.equal(await evaluate("document.querySelector('#trip-bus').closest('form').querySelector('button[type=submit]').disabled"), true);
    await setField("trip-from", locations[0]);
    await setField("trip-to", locations[1]);
    await setField("trip-time", "2099-12-04T08:30");
    await setField("trip-price", "123456");
    await setField("trip-bus", busA.id);
    assert.equal(await evaluate("document.querySelector('#trip-capacity').textContent"), "12 chỗ");
    await saveModal();
    const trip = await prisma.trip.findFirst({ where: { price: 123456, busId: busA.id } });
    assert.ok(trip);
    assert.equal(trip.availableSeats, busA.capacity);
    const createdRequest = await evaluate("window.busTripSmoke.writes.find(write => write.path === '/api/trips' && write.status === 201)");
    assert.equal(createdRequest.body.busId, busA.id);
    assert.equal(Object.hasOwn(createdRequest.body, "capacity"), false);
    console.log("PASS: active bus dropdown, read-only capacity and real form create derive 12 available seats from bus A.");

    await openEdit(trip.id);
    assert.equal(await evaluate("document.querySelector('#trip-bus').value"), busA.id);
    await setField("trip-bus", busB.id);
    assert.equal(await evaluate("document.querySelector('#trip-capacity').textContent"), "18 chỗ");
    await saveModal();
    const changed = await prisma.trip.findUnique({ where: { id: trip.id }, include: { bus: true } });
    assert.equal(changed.busId, busB.id);
    assert.equal(changed.availableSeats, 18);
    assert.equal(changed.bus.capacity, 18);
    console.log("PASS: editing an empty trip selects bus B and updates the seat count to its 18-seat layout.");

    const booked = await api("POST", "/api/bookings", { tripId: trip.id, seats: ["A01"], fullName: "Bus Browser Passenger", phone: "0999000081" });
    assert.equal(booked.status, 201);
    await openEdit(trip.id);
    await setField("trip-bus", busA.id);
    await evaluate("document.querySelector('#trip-bus').closest('form').requestSubmit()");
    await waitUntil(() => evaluate("Array.from(document.querySelectorAll('form [role=alert]')).some(element => element.textContent.includes('cùng sức chứa'))"), "Changing capacity with a booking was not rejected in the form");
    assert.equal((await prisma.trip.findUnique({ where: { id: trip.id } })).busId, busB.id);
    await setField("trip-bus", busC.id);
    await saveModal();
    const reassigned = await prisma.trip.findUnique({ where: { id: trip.id } });
    assert.equal(reassigned.busId, busC.id);
    assert.equal(reassigned.availableSeats, 17);
    assert.equal(await prisma.booking.count({ where: { tripId: trip.id, seatNumber: "A01", status: "PENDING" } }), 1);
    console.log("PASS: booked-trip capacity changes are rejected; assignment to another 18-seat bus preserves A01 and 17 remaining seats.");

    const payload = { from: locations[0], to: locations[1], time: "2099-12-06T08:30", price: 123456 };
    assert.equal((await api("POST", "/api/trips", { ...payload, busId: inactiveBus.id })).status, 409);
    assert.equal((await api("POST", "/api/trips", { ...payload, busId: "BUS-NOT-FOUND" })).status, 404);
    assert.equal((await api("POST", "/api/trips", payload)).status, 400);
    assert.equal((await api("PUT", `/api/trips/${trip.id}`, { ...payload, time: trip.time.toISOString(), busId: inactiveBus.id })).status, 409);
    const tampered = await api("POST", "/api/trips", { ...payload, busId: busA.id, capacity: 60 });
    assert.equal(tampered.status, 201);
    const tamperedTrip = await prisma.trip.findUnique({ where: { id: tampered.body.data.id } });
    assert.equal(tamperedTrip.availableSeats, busA.capacity);
    const tripColumns = await prisma.$queryRawUnsafe("SHOW COLUMNS FROM trip");
    assert.equal(tripColumns.some(({ Field }) => Field === "capacity"), false);
    assert.deepEqual(await evaluate("window.busTripSmoke.errors"), []);
    console.log("PASS: missing/inactive/nonexistent buses are rejected, client capacity is ignored, and trip stores only its bus relation.");

    await cdp.send("Page.navigate", { url: `${baseUrl}/trips/${trip.id}` }, sessionId);
    await waitUntil(() => evaluate("document.querySelector('[data-realtime-connected=\"true\"]') !== null"), "The public seat layout did not connect");
    assert.equal(await evaluate("document.querySelectorAll('button[data-seat-state]').length"), busC.capacity);
    assert.equal(await evaluate("document.querySelectorAll('button[data-seat-state=\"booked\"]').length"), 1);
    assert.equal(await evaluate("document.querySelectorAll('button[data-seat-state=\"available\"]').length"), 17);
    assert.deepEqual(await evaluate("window.busTripSmoke.errors"), []);
    console.log("PASS: the public trip page renders the assigned bus's 18 seats with the booked seat preserved.");
  } catch (error) {
    if (cdp && sessionId) {
      const diagnostic = await cdp.evaluate(sessionId, "({ path: location.pathname, alerts: Array.from(document.querySelectorAll('[role=alert]')).map(element => element.textContent), writes: window.busTripSmoke?.writes.map(({path,status}) => ({path,status})) })").catch(() => undefined);
      if (diagnostic) console.error(JSON.stringify(diagnostic));
    }
    throw error;
  } finally {
    if (cdp) {
      if (browserContextId) await cdp.send("Target.disposeBrowserContext", { browserContextId }).catch(() => {});
      await cdp.send("Browser.close").catch(() => {});
      cdp.socket.close();
    }
    await stopChild(chrome);
    await stopChild(server);
    await prisma.$disconnect();
    if (ownedDatabase && /^sgu_booking_demo_browser_bus_\d+_[a-f0-9]{6}$/.test(database)) await control.$executeRawUnsafe(`DROP DATABASE \`${database}\``);
    await control.$disconnect();
    const resolvedProfile = fs.realpathSync(profile);
    assert.equal(path.dirname(resolvedProfile).toLowerCase(), fs.realpathSync(os.tmpdir()).toLowerCase());
    assert.match(path.basename(resolvedProfile), /^sgu-trip-bus-browser-/);
    fs.rmSync(resolvedProfile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});
