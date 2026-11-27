// Chrome DevTools Protocol smoke test. Uses only Node built-ins and existing
// Prisma dependencies; all records live in a disposable database.
require("dotenv/config");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const { spawn, spawnSync } = require("node:child_process");
const { PrismaClient } = require("@prisma/client");
const { load } = require("./load-ts.cjs");

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitUntil(check, message, timeout = 20000) {
  const deadline = Date.now() + timeout;
  let lastError;
  while (Date.now() < deadline) {
    try { const value = await check(); if (value) return value; }
    catch (error) { lastError = error; }
    await pause(100);
  }
  throw new Error(`${message}${lastError ? `: ${lastError.message}` : ""}`);
}

async function unusedPort() {
  const listener = net.createServer();
  await new Promise((resolve, reject) => listener.once("error", reject).listen(0, "127.0.0.1", resolve));
  const port = listener.address().port;
  await new Promise((resolve) => listener.close(resolve));
  return port;
}

class Cdp {
  constructor(socket) {
    this.socket = socket;
    this.sequence = 0;
    this.pending = new Map();
    socket.addEventListener("message", ({ data }) => {
      const message = JSON.parse(data);
      const request = this.pending.get(message.id);
      if (!request) return;
      this.pending.delete(message.id);
      clearTimeout(request.timer);
      if (message.error) request.reject(new Error(message.error.message));
      else request.resolve(message.result);
    });
    socket.addEventListener("close", () => {
      for (const request of this.pending.values()) { clearTimeout(request.timer); request.reject(new Error("Chrome connection closed")); }
      this.pending.clear();
    });
  }
  send(method, params = {}, sessionId) {
    return new Promise((resolve, reject) => {
      const id = ++this.sequence;
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`CDP timed out: ${method}`)); }, 20000);
      this.pending.set(id, { resolve, reject, timer });
      this.socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }
  async evaluate(sessionId, expression) {
    const result = await this.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, sessionId);
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  }
}

async function stopChild(child) {
  if (!child || child.exitCode !== null) return;
  child.kill();
  await waitUntil(() => child.exitCode !== null || child.signalCode !== null, "Child process did not stop", 5000).catch(() => child.kill("SIGKILL"));
}

test("real browsers isolate seat ownership, update booked/cancelled seats and recover offline choices", { timeout: 180000 }, async () => {
  const chromePath = "C:/Program Files/Google/Chrome/Application/chrome.exe";
  assert.ok(fs.existsSync(chromePath), "Google Chrome must be installed for this optional smoke test");
  assert.ok(fs.existsSync(path.resolve(process.env.SGU_DEMO === "true" ? ".next-demo/BUILD_ID" : ".next/BUILD_ID")), "Run npm run build before the smoke test");
  const database = `nha_xe_browser_fixes_verify_${Date.now()}`;
  assert.match(database, /^nha_xe_browser_fixes_verify_\d+$/);
  const temporaryUrl = new URL(process.env.DATABASE_URL);
  temporaryUrl.pathname = `/${database}`;
  const control = new PrismaClient();
  const prisma = new PrismaClient({ datasources: { db: { url: temporaryUrl.toString() } } });
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "sgu-booking-browser-smoke-"));
  const env = { ...process.env, DATABASE_URL: temporaryUrl.toString(), SESSION_SECRET: "browser-smoke-isolated-secret-".repeat(2),
    NEXT_TELEMETRY_DISABLED: "1", PAYMENT_DEMO_ENABLED: "false", VIETQR_BANK_ID: "970436", VIETQR_ACCOUNT_NO: "0123456789", VIETQR_ACCOUNT_NAME: "Browser Test" };
  let created = false;
  let server;
  let chrome;
  let cdp;
  let serverOutput = "";
  const pages = [];
  try {
    await control.$executeRawUnsafe(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    created = true;
    const pushed = spawnSync(process.execPath, [require.resolve("prisma/build/index.js"), "db", "push", "--skip-generate"], { env, encoding: "utf8", windowsHide: true });
    assert.equal(pushed.status, 0, pushed.error?.message || pushed.stderr || pushed.stdout);
    const bus = await prisma.bus.create({ data: { id: "browser-smoke-bus", plate: "51B-006.00", type: "Xe kiểm thử", capacity: 6, status: "Đang hoạt động" } });
    const trip = await prisma.trip.create({ data: { from: "Browser Smoke Origin", to: "Browser Smoke Destination", time: new Date(Date.now() + 2 * 86400000),
      price: 100000, busId: bus.id, availableSeats: bus.capacity } });
    const port = await unusedPort();
    const baseUrl = `http://127.0.0.1:${port}`;
    server = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "start", "-H", "127.0.0.1", "-p", String(port)], { env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    for (const stream of [server.stdout, server.stderr]) stream.on("data", (chunk) => { serverOutput = (serverOutput + chunk.toString()).slice(-20000); });
    await waitUntil(async () => {
      if (server.exitCode !== null) throw new Error("Production server exited before startup");
      const response = await fetch(`${baseUrl}/api/trips?limit=1`);
      return response.ok;
    }, "Production server did not start", 30000);

    chrome = spawn(chromePath, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"],
      { windowsHide: true, stdio: "ignore" });
    const activePortPath = path.join(profile, "DevToolsActivePort");
    const activePort = await waitUntil(() => fs.existsSync(activePortPath) && fs.readFileSync(activePortPath, "utf8").trim().split(/\r?\n/), "Chrome DevTools port was not created");
    const socket = new WebSocket(`ws://127.0.0.1:${activePort[0]}${activePort[1]}`);
    await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
    cdp = new Cdp(socket);

    async function openViewer() {
      const { browserContextId } = await cdp.send("Target.createBrowserContext");
      const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank", browserContextId });
      const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
      await cdp.send("Page.enable", {}, sessionId);
      await cdp.send("Runtime.enable", {}, sessionId);
      await cdp.send("Network.enable", {}, sessionId);
      await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: `
        window.seatSmoke = { errors: [], clientId: "", requests: [] };
        window.addEventListener("error", (event) => window.seatSmoke.errors.push(event.message));
        const originalFetch = window.fetch;
        window.fetch = async (...args) => {
          const response = await originalFetch(...args);
          window.seatSmoke.requests.push({ path: new URL(args[0], location.href).pathname, status: response.status });
          window.seatSmoke.requests = window.seatSmoke.requests.slice(-20);
          return response;
        };
        const OriginalEventSource = window.EventSource;
        window.EventSource = class extends OriginalEventSource {
          constructor(url, options) {
            super(url, options);
            window.seatSmoke.clientId = new URL(url, location.href).searchParams.get("clientId");
          }
        };
      ` }, sessionId);
      const page = { browserContextId, sessionId };
      pages.push(page);
      await navigateToTrip(page);
      return page;
    }
    async function navigateToTrip(page) {
      await cdp.send("Page.navigate", { url: `${baseUrl}/trips/${trip.id}` }, page.sessionId);
      await waitUntil(() => cdp.evaluate(page.sessionId, `document.querySelector('[data-realtime-connected="true"]') !== null`), "Seat viewer did not connect");
    }
    const seatExpression = (seat) => `Array.from(document.querySelectorAll('button[data-seat-state]')).find((button) => button.textContent.trim() === ${JSON.stringify(seat)})`;
    async function expectSeat(page, seat, state) {
      await waitUntil(() => cdp.evaluate(page.sessionId, `(() => { const button = ${seatExpression(seat)}; return button?.dataset.seatState === ${JSON.stringify(state)} && button.disabled === ${state === "booked" || state === "remote"}; })()`), `Seat ${seat} did not become ${state}`);
    }
    async function clickSeat(page, seat) {
      await cdp.evaluate(page.sessionId, `${seatExpression(seat)}.click()`);
      await expectSeat(page, seat, "selected");
    }
    async function bookSelected(page, phone) {
      await cdp.evaluate(page.sessionId, `(() => {
        const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
        const name = document.querySelector('input[type="text"][required]');
        const phone = document.querySelector('input[type="tel"]');
        set.call(name, "Browser Smoke Passenger"); name.dispatchEvent(new Event("input", { bubbles: true }));
        set.call(phone, ${JSON.stringify(phone)}); phone.dispatchEvent(new Event("input", { bubbles: true }));
      })()`);
      await cdp.evaluate(page.sessionId, `document.querySelector('input[type="tel"]').closest("form").requestSubmit()`);
      await waitUntil(() => cdp.evaluate(page.sessionId, `location.pathname === "/success" && new URL(location.href).searchParams.has("pnr")`), "Booking form did not navigate to success");
    }

    const viewerA = await openViewer();
    const viewerB = await openViewer();
    const { cookies } = await cdp.send("Storage.getCookies", { browserContextId: viewerA.browserContextId });
    const seatCookie = cookies.find((cookie) => cookie.name === "seat_session");
    assert.ok(seatCookie?.httpOnly);
    assert.equal(seatCookie.sameSite, "Lax");
    assert.equal(await cdp.evaluate(viewerA.sessionId, `document.cookie.includes("seat_session=")`), false);
    await clickSeat(viewerA, "A01");
    await expectSeat(viewerB, "A01", "remote");
    const victimId = await cdp.evaluate(viewerA.sessionId, "window.seatSmoke.clientId");
    const attackerId = await cdp.evaluate(viewerB.sessionId, "window.seatSmoke.clientId");
    assert.notEqual(victimId, attackerId);
    const spoofed = await cdp.evaluate(viewerB.sessionId, `(async () => {
      const result = await fetch('/api/trips/${trip.id}/seat-events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tripId: ${trip.id}, clientId: ${JSON.stringify(victimId)}, seatNumber: 'A01', type: 'SEAT_DESELECTED' }) });
      return result.status;
    })()`);
    assert.ok([403, 409].includes(spoofed));
    await expectSeat(viewerA, "A01", "selected");
    await expectSeat(viewerB, "A01", "remote");
    const takeover = await cdp.evaluate(viewerB.sessionId, `(async () => {
      const response = await fetch('/api/trips/${trip.id}/stream?clientId=' + encodeURIComponent(${JSON.stringify(victimId)}));
      await response.body?.cancel(); return response.status;
    })()`);
    assert.ok([403, 409].includes(takeover));
    console.log("PASS: two browser contexts bootstrap HttpOnly seat cookies, receive remote selection, and reject public-ID spoof/takeover.");

    await bookSelected(viewerA, "0999000011");
    await expectSeat(viewerB, "A01", "booked");
    const booked = await prisma.booking.findFirst({ where: { tripId: trip.id, seatNumber: "A01" } });
    assert.equal(booked.status, "PENDING");
    const { deleteOrder } = load("services/orderService.ts", { "@/lib/prisma": { prisma } });
    await deleteOrder(booked.id);
    await expectSeat(viewerB, "A01", "available");
    console.log("PASS: UI booking broadcasts a booked seat; cancellation from another process returns it through polling.");

    await clickSeat(viewerB, "B01");
    await cdp.evaluate(viewerB.sessionId, `window.dispatchEvent(new Event("offline"))`);
    await waitUntil(() => cdp.evaluate(viewerB.sessionId, `document.querySelector('[data-realtime-connected="false"]') !== null`), "Viewer did not enter offline state");
    await navigateToTrip(viewerA);
    await expectSeat(viewerA, "B01", "available");
    await clickSeat(viewerA, "B01");
    await bookSelected(viewerA, "0999000012");
    await cdp.evaluate(viewerB.sessionId, `window.dispatchEvent(new Event("online"))`);
    await waitUntil(() => cdp.evaluate(viewerB.sessionId, `document.querySelector('[data-realtime-connected="true"]') !== null`), "Viewer did not reconnect after its selected seat was sold");
    await expectSeat(viewerB, "B01", "booked");
    await clickSeat(viewerB, "C01");
    assert.deepEqual(await cdp.evaluate(viewerB.sessionId, "window.seatSmoke.errors"), []);
    console.log("PASS: offline viewer reconnects after another browser buys its old choice, sees booked state, and can select a different seat.");
  } catch (error) {
    // Do not print raw production logs: driver errors can contain credentials.
    if (/Error|error|failed/i.test(serverOutput)) console.error("Production server reported an error during the isolated browser smoke.");
    for (const page of pages) {
      const diagnostic = await cdp?.evaluate(page.sessionId, `({ path: location.pathname, text: document.body.innerText.slice(0, 1800), smoke: window.seatSmoke })`).catch(() => undefined);
      if (diagnostic) console.error(JSON.stringify(diagnostic));
      const cookies = await cdp?.send("Storage.getCookies", { browserContextId: page.browserContextId }).catch(() => undefined);
      if (cookies) console.error(JSON.stringify(cookies.cookies.map(({ name, secure, httpOnly, sameSite }) => ({ name, secure, httpOnly, sameSite }))));
    }
    throw error;
  } finally {
    if (cdp) {
      for (const page of pages) await cdp.send("Target.disposeBrowserContext", { browserContextId: page.browserContextId }).catch(() => {});
      await cdp.send("Browser.close").catch(() => {});
      cdp.socket.close();
    }
    await stopChild(chrome);
    await stopChild(server);
    await prisma.$disconnect();
    if (created && /^nha_xe_browser_fixes_verify_\d+$/.test(database)) await control.$executeRawUnsafe(`DROP DATABASE \`${database}\``);
    await control.$disconnect();
    const resolvedProfile = fs.realpathSync(profile);
    const resolvedTemporary = fs.realpathSync(os.tmpdir());
    assert.equal(path.dirname(resolvedProfile).toLowerCase(), resolvedTemporary.toLowerCase());
    assert.match(path.basename(resolvedProfile), /^sgu-booking-browser-smoke-/);
    fs.rmSync(resolvedProfile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    console.log("Temporary browser database and guarded Chrome profile removed.");
  }
});
