// Optional real-Chrome smoke. Only the disposable database is modified; the
// existing account database is never used to log in or create trips.
require("dotenv/config");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const { PrismaClient } = require("@prisma/client");
const { Cdp, waitUntil, unusedPort, stopChild } = require("./browser-cdp.cjs");
const { load } = require("./load-ts.cjs");
const { ensureNumericTripIds } = require("../scripts/setup-trips.cjs");

test("admin selects locations and creates/edits trips after a backed-up legacy-code repair", { timeout: 180000 }, async () => {
  const chromePath = "C:/Program Files/Google/Chrome/Application/chrome.exe";
  assert.ok(fs.existsSync(chromePath), "Google Chrome is required for the optional browser smoke");
  assert.ok(fs.existsSync(path.resolve(process.env.SGU_DEMO === "true" ? ".next-demo/BUILD_ID" : ".next/BUILD_ID")), "Build the app before this smoke test");
  const database = `nha_xe_admin_trip_browser_${Date.now()}`;
  assert.match(database, /^nha_xe_admin_trip_browser_\d+$/);
  const temporaryUrl = new URL(process.env.DATABASE_URL);
  temporaryUrl.pathname = `/${database}`;
  const control = new PrismaClient();
  const prisma = new PrismaClient({ datasources: { db: { url: temporaryUrl.toString() } } });
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "sgu-admin-trip-browser-"));
  const env = { ...process.env, DATABASE_URL: temporaryUrl.toString(), SESSION_SECRET: "isolated-admin-trip-browser-secret-".repeat(2), NEXT_TELEMETRY_DISABLED: "1" };
  let created = false;
  let chrome;
  let server;
  let cdp;
  let browserContextId;
  let sessionId;
  try {
    await control.$executeRawUnsafe(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    created = true;
    const pushed = spawnSync(process.execPath, [require.resolve("prisma/build/index.js"), "db", "push", "--skip-generate"], { env, encoding: "utf8", windowsHide: true });
    assert.equal(pushed.status, 0, pushed.error?.message || pushed.stderr || pushed.stdout);
    await prisma.$executeRawUnsafe("ALTER TABLE trip ADD COLUMN code VARCHAR(191) NOT NULL, ADD UNIQUE INDEX Trip_code_key (code)");
    const legacyFrom = "Bến xe Miền Đông cũ";
    const legacyTo = "Bến xe Miền Tây cũ";
    const legacyTime = new Date("2099-12-02T01:00:45.000Z");
    const legacyBus = await prisma.bus.create({ data: { id: "BROWSER-LEGACY", plate: "51B-006.00", type: "Xe kiểm thử", capacity: 6, status: "Đang hoạt động" } });
    const selectedBus = await prisma.bus.create({ data: { id: "BROWSER-SELECTED", plate: "51B-012.00", type: "Xe kiểm thử", capacity: 12, status: "Đang hoạt động" } });
    const selectedDriver = await prisma.employee.create({ data: { id: "BROWSER-DRIVER", name: "Test driver", email: "trip-driver@example.test", phone: "0999000072", role: "Tài xế", department: "Đội xe", startDate: "2026-01-01" } });
    await prisma.$executeRaw`INSERT INTO trip (code, \`from\`, \`to\`, time, price, busId, availableSeats, createdAt) VALUES (${"LEGACY-BROWSER"}, ${legacyFrom}, ${legacyTo}, ${legacyTime}, ${100000}, ${legacyBus.id}, ${legacyBus.capacity}, NOW())`;
    const legacy = await prisma.trip.findFirst();
    assert.ok(legacy);
    const repair = await ensureNumericTripIds(prisma, { backupDirectory: path.join(profile, "schema-backup") });
    assert.equal(repair.changed, true);
    assert.ok(repair.backupPath && fs.existsSync(repair.backupPath));
    assert.equal((await ensureNumericTripIds(prisma, { backupDirectory: path.join(profile, "schema-backup") })).changed, false);
    const columns = await prisma.$queryRawUnsafe("SHOW COLUMNS FROM trip");
    assert.equal(columns.some(({ Field }) => Field === "code"), false);
    assert.equal((await prisma.trip.findUnique({ where: { id: legacy.id } })).time.getTime(), legacyTime.getTime());
    console.log("PASS: legacy code column is repaired after backup; existing numeric trip ID and departure seconds are preserved.");

    const passwordHash = "isolated-browser-only-admin-hash";
    const admin = await prisma.user.create({ data: { fullName: "Browser Test Admin", phone: "0999000071", password: passwordHash, role: "ADMIN", isActive: true } });
    const oldSecret = process.env.SESSION_SECRET;
    process.env.SESSION_SECRET = env.SESSION_SECRET;
    const { createSessionToken, ADMIN_SESSION_COOKIE } = load("lib/session.ts", { "@/lib/prisma": { prisma } });
    const token = createSessionToken(admin.id, passwordHash);
    if (oldSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = oldSecret;
    const port = await unusedPort();
    const baseUrl = `http://127.0.0.1:${port}`;
    server = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "start", "-H", "127.0.0.1", "-p", String(port)], { env, windowsHide: true, stdio: "ignore" });
    await waitUntil(async () => {
      if (server.exitCode !== null) throw new Error("Production server exited");
      return (await fetch(`${baseUrl}/api/trips?limit=1`)).ok;
    }, "Production server did not start", 30000);
    chrome = spawn(chromePath, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { windowsHide: true, stdio: "ignore" });
    const portFile = path.join(profile, "DevToolsActivePort");
    const activePort = await waitUntil(() => fs.existsSync(portFile) && fs.readFileSync(portFile, "utf8").trim().split(/\r?\n/), "Chrome DevTools did not start");
    const socket = new WebSocket(`ws://127.0.0.1:${activePort[0]}${activePort[1]}`);
    await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
    cdp = new Cdp(socket);
    ({ browserContextId } = await cdp.send("Target.createBrowserContext"));
    const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank", browserContextId });
    ({ sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true }));
    await cdp.send("Page.enable", {}, sessionId);
    await cdp.send("Runtime.enable", {}, sessionId);
    await cdp.send("Network.enable", {}, sessionId);
    await cdp.send("Network.setCookie", { name: ADMIN_SESSION_COOKIE, value: token, url: baseUrl, httpOnly: true, sameSite: "Lax", secure: true }, sessionId);
    await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: `
      window.tripSmoke = { errors: [], writes: [] };
      window.addEventListener("error", (event) => window.tripSmoke.errors.push(event.message));
      const originalFetch = window.fetch;
      window.fetch = async (...args) => {
        const response = await originalFetch(...args);
        if (args[1]?.method && args[1].method !== 'GET') window.tripSmoke.writes.push({ path: new URL(args[0], location.href).pathname, method: args[1].method, status: response.status });
        return response;
      };
    ` }, sessionId);
    const evaluate = (expression) => cdp.evaluate(sessionId, expression);
    await cdp.send("Page.navigate", { url: `${baseUrl}/admin/trips` }, sessionId);
    await waitUntil(() => evaluate("document.querySelector('tbody tr') !== null"), "Admin trip list did not load");
    const locations = await evaluate("fetch('/api/trips/locations').then((response) => response.json())");
    assert.equal(locations.success, true);
    assert.ok(locations.data.includes(legacyFrom) && locations.data.includes(legacyTo));

    async function openCreate() {
      await evaluate(`Array.from(document.querySelectorAll('button')).find((button) => button.textContent.includes('Thêm chuyến xe mới')).click()`);
      await waitUntil(() => evaluate(`document.querySelector('#trip-from')?.tagName === 'SELECT' && Array.from(document.querySelector('#trip-from').options).some((option) => option.value === ${JSON.stringify(legacyFrom)})`), "Location select options did not load");
      assert.equal(await evaluate("document.querySelector('#trip-to').tagName"), "SELECT");
    }
    async function setField(id, value) {
      await evaluate(`(() => { const field = document.getElementById(${JSON.stringify(id)}); const proto = field.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(field, ${JSON.stringify(value)}); field.dispatchEvent(new Event(field.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); })()`);
    }
    async function saveModal() {
      await evaluate("document.querySelector('#trip-from').closest('form').requestSubmit()");
      await waitUntil(() => evaluate("document.querySelector('#trip-from') === null"), "Trip modal did not save");
    }
    async function openEdit(id) {
      await waitUntil(() => evaluate(`Array.from(document.querySelectorAll('tbody tr')).some((row) => row.cells[0]?.querySelector('span')?.textContent.trim() === ${JSON.stringify(String(id))})`), "Created trip did not appear in the table");
      await evaluate(`Array.from(document.querySelectorAll('tbody tr')).find((row) => row.cells[0]?.querySelector('span')?.textContent.trim() === ${JSON.stringify(String(id))}).querySelector('button[aria-label="Chỉnh sửa chuyến xe"]').click()`);
      await waitUntil(() => evaluate("document.querySelector('#trip-from')?.tagName === 'SELECT'"), "Edit modal did not open");
    }

    await openCreate();
    await evaluate("document.querySelector('#trip-from').closest('form').requestSubmit()");
    assert.equal(await evaluate("window.tripSmoke.writes.length"), 0);
    await setField("trip-from", legacyFrom);
    assert.equal(await evaluate(`Array.from(document.querySelector('#trip-to').options).find((option) => option.value === ${JSON.stringify(legacyFrom)})?.disabled`), true);
    await setField("trip-to", legacyTo);
    await setField("trip-time", "2099-12-04T08:30");
    await setField("trip-ends-at", "2099-12-04T12:30");
    await setField("trip-price", "250000");
    await waitUntil(() => evaluate("document.querySelector('#trip-bus')?.disabled === false"), "Bus choices did not load");
    await setField("trip-bus", selectedBus.id);
    assert.equal(await evaluate("document.querySelector('#trip-capacity').textContent"), "12 chỗ");
    await waitUntil(() => evaluate(`document.querySelector('option[value="${selectedDriver.id}"]')?.disabled === false && document.querySelector('option[value="${selectedDriver.id}"]').closest('select').disabled === false`), "Driver availability did not load");
    await evaluate(`(() => { const field = document.querySelector('option[value="${selectedDriver.id}"]').closest('select'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(field, ${JSON.stringify(selectedDriver.id)}); field.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await setField("trip-status", "OPEN");
    await saveModal();
    const newTrip = await prisma.trip.findFirst({ where: { price: 250000, busId: selectedBus.id } });
    assert.ok(newTrip);
    assert.equal(newTrip.from, legacyFrom);
    assert.equal(newTrip.to, legacyTo);
    assert.equal(newTrip.time.toISOString(), "2099-12-04T01:30:00.000Z");
    assert.equal(newTrip.status, "OPEN");
    assert.equal(newTrip.driverId, selectedDriver.id);
    assert.equal(newTrip.endsAt.toISOString(), "2099-12-04T05:30:00.000Z");
    assert.equal(newTrip.availableSeats, 12);
    assert.equal(await prisma.trip.count(), 2);
    assert.equal(await evaluate("window.tripSmoke.writes.at(-1).status"), 201);
    console.log("PASS: real admin creates a trip with status, driver and end time saved immediately, before opening its details or editing it.");

    await openEdit(legacy.id);
    assert.equal(await evaluate("document.querySelector('#trip-from').value"), legacyFrom);
    assert.equal(await evaluate("document.querySelector('#trip-to').value"), legacyTo);
    await setField("trip-price", "150000");
    await saveModal();
    const preserved = await prisma.trip.findUnique({ where: { id: legacy.id } });
    assert.equal(preserved.from, legacyFrom);
    assert.equal(preserved.to, legacyTo);
    assert.equal(preserved.time.getTime(), legacyTime.getTime());
    assert.equal(preserved.price, 150000);

    await openEdit(newTrip.id);
    await setField("trip-to", "");
    await setField("trip-from", legacyTo);
    await setField("trip-to", legacyFrom);
    await setField("trip-time", "2099-12-05T09:30");
    await setField("trip-ends-at", "2099-12-05T13:30");
    await waitUntil(() => evaluate(`document.querySelector('option[value="${selectedDriver.id}"]')?.closest('select').disabled === false`), "Updated driver availability did not load");
    await saveModal();
    const updated = await prisma.trip.findUnique({ where: { id: newTrip.id } });
    assert.equal(updated.from, legacyTo);
    assert.equal(updated.to, legacyFrom);
    assert.equal(updated.time.toISOString(), "2099-12-05T02:30:00.000Z");
    const invalid = await evaluate(`fetch('/api/trips', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ from: ${JSON.stringify(legacyFrom)}, to: ${JSON.stringify(legacyFrom)}, time: '2099-12-05T09:30', price: 250000, busId: ${JSON.stringify(selectedBus.id)} }) }).then((response) => response.status)`);
    assert.equal(invalid, 400);
    assert.equal(await prisma.trip.count(), 2);
    assert.deepEqual(await evaluate("window.tripSmoke.errors"), []);
    console.log("PASS: edit preserves legacy location values and unchanged departure seconds; route/time edits persist and same-origin/destination input is rejected.");
  } catch (error) {
    if (cdp && sessionId) {
      const diagnostic = await cdp.evaluate(sessionId, "({ path: location.pathname, alerts: Array.from(document.querySelectorAll('[role=alert]')).map((element) => element.textContent), smoke: window.tripSmoke })").catch(() => undefined);
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
    if (created && /^nha_xe_admin_trip_browser_\d+$/.test(database)) await control.$executeRawUnsafe(`DROP DATABASE \`${database}\``);
    await control.$disconnect();
    const resolvedProfile = fs.realpathSync(profile);
    assert.equal(path.dirname(resolvedProfile).toLowerCase(), fs.realpathSync(os.tmpdir()).toLowerCase());
    assert.match(path.basename(resolvedProfile), /^sgu-admin-trip-browser-/);
    fs.rmSync(resolvedProfile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    console.log("Temporary admin-trip database and guarded Chrome profile removed.");
  }
});
