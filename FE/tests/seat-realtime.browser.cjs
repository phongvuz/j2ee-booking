// Kiểm thử trên Chromium thật, trong các phiên trình duyệt độc lập.
// Playwright chỉ cài vào thư mục tạm, không thêm dependency vào ứng dụng.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
require("dotenv").config({ quiet: true });

function loadPlaywright() {
  if (process.env.PLAYWRIGHT_MODULE_PATH) return require(process.env.PLAYWRIGHT_MODULE_PATH);
  return require(path.join(process.env.TEMP, "nha-xe-sse-browser-tests", "node_modules", "playwright"));
}

test("browser sessions disable remote seats, count viewers, isolate trips and recover network errors", { timeout: 180000 }, async () => {
  const { chromium } = loadPlaywright();
  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient();
  const baseUrl = process.env.REALTIME_TEST_URL || "http://localhost:3000";
  const testLabel = "SSE TEST " + Date.now();
  const createdTripIds = [];
  const busId = `sse-browser-${Date.now()}`;
  let browser;
  const results = [];
  const executablePath = [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  ].find((candidate) => fs.existsSync(candidate));

  function record(result) {
    results.push(result);
    console.log("PASS: " + result);
  }

  try {
    await prisma.bus.create({ data: { id: busId, plate: `SSE-${Date.now()}`, type: "Xe kiểm thử", capacity: 9, status: "Đang hoạt động" } });
    for (let index = 0; index < 2; index += 1) {
      const trip = await prisma.trip.create({ data: {
        from: testLabel, to: "Điểm thử " + index,
        time: new Date(Date.now() + 2 * 86400000),
        price: 100000, busId, availableSeats: 9,
      } });
      createdTripIds.push(trip.id);
    }
    browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
    async function waitForConnection(page) {
      await page.locator('[data-realtime-connected="true"]').waitFor();
    }
    async function assertViewerCount(page, expectedCount) {
      await page.locator('[data-viewer-count="' + expectedCount + '"]').waitFor();
    }
    async function newViewer(tripId) {
      const browserContext = await browser.newContext();
      await browserContext.addInitScript(() => {
        const OriginalEventSource = window.EventSource;
        window.realtimeTest = { activeConnections: 0, messages: [], openedConnections: 0 };
        window.EventSource = class extends OriginalEventSource {
          constructor(url, options) {
            super(url, options);
            window.realtimeTest.activeConnections += 1;
            window.realtimeTest.clientId = new URL(url, window.location.href).searchParams.get("clientId");
            this.isTestClosed = false;
            this.addEventListener("open", () => { window.realtimeTest.openedConnections += 1; });
            this.addEventListener("message", (message) => {
              try { window.realtimeTest.messages.push(JSON.parse(message.data)); } catch {}
            });
          }
          close() {
            if (!this.isTestClosed) {
              this.isTestClosed = true;
              window.realtimeTest.activeConnections -= 1;
            }
            super.close();
          }
        };
      });
      const page = await browserContext.newPage();
      const runtimeErrors = [];
      page.on("pageerror", (error) => runtimeErrors.push(error.message));
      await page.goto(baseUrl + "/trips/" + tripId);
      await waitForConnection(page);
      assert.equal(await page.evaluate(() => window.realtimeTest.activeConnections), 1);
      return { page, browserContext, runtimeErrors };
    }
    async function assertSeat(page, seatNumber, expectedState) {
      const locator = page.getByRole("button", { name: "Ghế " + seatNumber, exact: true });
      await page.waitForFunction(({ seatNumber, expectedState }) => {
        const button = document.querySelector('[aria-label="Ghế ' + seatNumber + '"]');
        return button?.getAttribute("data-seat-state") === expectedState
          && button.disabled === (expectedState === "remote" || expectedState === "booked");
      }, { seatNumber, expectedState });
      assert.equal(await locator.getAttribute("data-seat-state"), expectedState);
    }
    async function clickSeat(page, seatNumber) {
      await page.getByRole("button", { name: "Ghế " + seatNumber, exact: true }).click();
    }

    const viewerA = await newViewer(createdTripIds[0]);
    const viewerB = await newViewer(createdTripIds[0]);
    const otherTripViewer = await newViewer(createdTripIds[1]);
    await assertViewerCount(viewerA.page, 2);
    await assertViewerCount(viewerB.page, 2);
    await assertViewerCount(otherTripViewer.page, 1);
    assert.equal(await viewerA.page.getByText("Realtime đã kết nối", { exact: true }).count(), 0);
    record("Three viewers connect; one active SSE connection per component");

    await clickSeat(viewerA.page, "A01");
    await assertSeat(viewerA.page, "A01", "selected");
    await assertSeat(viewerB.page, "A01", "remote");
    await assertSeat(otherTripViewer.page, "A01", "available");
    assert.equal(await otherTripViewer.page.evaluate(() => window.realtimeTest.messages.some((message) => message.type === "SEAT_SELECTED")), false);
    record("A selects A01; B receives it; other trip receives no selection event");

    assert.equal(await viewerB.page.getByRole("button", { name: "Ghế A01", exact: true }).isDisabled(), true);
    assert.equal(await viewerA.page.getByRole("button", { name: "Ghế A01", exact: true }).isDisabled(), false);
    assert.equal(await viewerB.page.getByRole("button", { name: "Ghế A01", exact: true }).getAttribute("title"), null);
    const firstClientId = await viewerA.page.evaluate(() => window.realtimeTest.clientId);
    const actualSecondClientId = await viewerB.page.evaluate(() => window.realtimeTest.clientId);
    assert.notEqual(firstClientId, actualSecondClientId);
    const rejectedSelection = await viewerB.browserContext.request.post(
      baseUrl + "/api/trips/" + createdTripIds[0] + "/seat-events",
      { data: { tripId: createdTripIds[0], clientId: actualSecondClientId, seatNumber: "A01", type: "SEAT_SELECTED" } },
    );
    assert.equal(rejectedSelection.status(), 409);
    await assertSeat(viewerB.page, "A01", "remote");
    await clickSeat(viewerA.page, "A01");
    await assertSeat(viewerB.page, "A01", "available");
    await clickSeat(viewerB.page, "A01");
    await assertSeat(viewerA.page, "A01", "remote");
    await assertSeat(viewerB.page, "A01", "selected");
    await clickSeat(viewerB.page, "A01");
    await assertSeat(viewerA.page, "A01", "available");
    await assertSeat(viewerB.page, "A01", "available");
    record("Remote seat is disabled; owner can deselect; server rejects simultaneous selection");

    await clickSeat(viewerA.page, "A01");
    const lateViewer = await newViewer(createdTripIds[0]);
    await assertSeat(lateViewer.page, "A01", "remote");
    await assertViewerCount(viewerA.page, 3);
    await assertViewerCount(viewerB.page, 3);
    await assertViewerCount(lateViewer.page, 3);
    await assertViewerCount(otherTripViewer.page, 1);
    await lateViewer.browserContext.close();
    await assertViewerCount(viewerA.page, 2);
    await assertViewerCount(viewerB.page, 2);
    record("Late viewer receives existing selections in the initial snapshot");

    await viewerB.page.reload();
    await waitForConnection(viewerB.page);
    await assertSeat(viewerB.page, "A01", "remote");
    await assertViewerCount(viewerA.page, 2);
    await assertViewerCount(viewerB.page, 2);
    record("Reload establishes a new SSE stream and restores remote state");

    // Mô phỏng mất mạng bằng Chromium; online phải tự mở lại kết nối.
    await viewerA.browserContext.setOffline(true);
    await viewerA.page.getByText("Mất kết nối Realtime.", { exact: false }).waitFor({ timeout: 25000 });
    assert.equal(await viewerA.page.getByRole("button", { name: "Ghế B01", exact: true }).isDisabled(), true);
    assert.equal(await viewerA.page.getByRole("button", { name: "Kết nối lại", exact: true }).isVisible(), true);
    await viewerA.page.getByRole("button", { name: "Kết nối lại", exact: true }).click();
    await viewerA.browserContext.setOffline(false);
    await waitForConnection(viewerA.page);
    await assertSeat(viewerA.page, "A01", "selected");
    await assertSeat(viewerB.page, "A01", "remote");
    assert.equal(await viewerA.page.evaluate(() => window.realtimeTest.activeConnections), 1);
    record("Offline shows an error and disables seats; reconnect republishes own selection");

    await viewerA.browserContext.setOffline(true);
    await viewerA.page.getByText("Thiết bị đang ngoại tuyến.", { exact: false }).waitFor();
    await assertSeat(viewerB.page, "A01", "available");
    await assertViewerCount(viewerB.page, 1);
    await clickSeat(viewerB.page, "A01");
    await assertSeat(viewerB.page, "A01", "selected");
    await viewerA.browserContext.setOffline(false);
    await waitForConnection(viewerA.page);
    await assertSeat(viewerA.page, "A01", "remote");
    await assertViewerCount(viewerA.page, 2);
    await assertViewerCount(viewerB.page, 2);
    await clickSeat(viewerB.page, "A01");
    await assertSeat(viewerA.page, "A01", "available");
    await clickSeat(viewerA.page, "A01");
    await assertSeat(viewerA.page, "A01", "selected");
    record("Reconnect removes stale own selection when another viewer selected it while offline");

    await viewerA.page.route("**/seat-events", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ success: false, message: "Lỗi HTTP thử nghiệm" }) });
      } else await route.continue();
    });
    await clickSeat(viewerA.page, "B01");
    await viewerA.page.getByText("Lỗi HTTP thử nghiệm", { exact: true }).waitFor();
    await waitForConnection(viewerA.page);
    await assertSeat(viewerA.page, "B01", "available");
    await assertSeat(viewerB.page, "B01", "available");
    await viewerA.page.unroute("**/seat-events");
    record("HTTP failure rolls back selection and displays the server error");

    // Response bị mất sau khi server đã nhận POST: reconnect phải hoàn tác cả server.
    await viewerA.page.route("**/seat-events", async (route) => {
      if (route.request().method() === "POST") {
        await route.fetch();
        await route.abort("failed");
      } else await route.continue();
    });
    await clickSeat(viewerA.page, "B01");
    await waitForConnection(viewerA.page);
    await assertSeat(viewerA.page, "B01", "available");
    await assertSeat(viewerB.page, "B01", "available");
    await viewerA.page.unroute("**/seat-events");
    record("Lost HTTP acknowledgement is repaired by reconnect and full synchronization");

    let notifyRequestReceived;
    let releaseResponse;
    const requestReceived = new Promise((resolve) => { notifyRequestReceived = resolve; });
    const responseReleased = new Promise((resolve) => { releaseResponse = resolve; });
    await viewerA.page.route("**/seat-events", async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }
      const response = await route.fetch();
      notifyRequestReceived();
      await responseReleased;
      try {
        await route.fulfill({ response });
      } catch {
        // Request đã bị hủy khi trình duyệt đổi kết nối.
      }
    });
    await clickSeat(viewerA.page, "B01");
    await requestReceived;
    assert.equal(await viewerA.page.getByRole("button", { name: "Ghế C01", exact: true }).isDisabled(), true);
    await viewerA.browserContext.setOffline(true);
    await viewerA.page.getByText("Thiết bị đang ngoại tuyến.", { exact: false }).waitFor();
    await viewerA.browserContext.setOffline(false);
    releaseResponse();
    await waitForConnection(viewerA.page);
    await assertSeat(viewerA.page, "B01", "available");
    await assertSeat(viewerB.page, "B01", "available");
    await viewerA.page.unroute("**/seat-events");
    record("Network loss during a pending POST rolls back and does not leave seats disabled");

    for (const seatNumber of ["B01", "C01", "A02", "B02"]) {
      await clickSeat(viewerA.page, seatNumber);
      await assertSeat(viewerA.page, seatNumber, "selected");
    }
    await clickSeat(viewerA.page, "C02");
    await viewerA.page.getByText("Bạn chỉ được chọn tối đa 5 ghế trong một lượt đặt.", { exact: true }).waitFor();
    await assertSeat(viewerA.page, "C02", "available");
    record("Client enforces the existing five-seat selection limit");

    for (const body of [
      { tripId: String(createdTripIds[0]), clientId: "invalid", seatNumber: "A01", type: "SEAT_SELECTED" },
      { tripId: createdTripIds[1], clientId: "invalid", seatNumber: "A01", type: "SEAT_SELECTED" },
      { tripId: createdTripIds[0], clientId: "invalid", seatNumber: "C99", type: "SEAT_SELECTED" },
      { tripId: createdTripIds[0], clientId: "invalid", seatNumber: "A01", type: "SEAT_SELECTED", phone: "private" },
    ]) {
      const response = await viewerB.browserContext.request.post(baseUrl + "/api/trips/" + createdTripIds[0] + "/seat-events", { data: body });
      assert.equal(response.status(), 400);
    }
    const invalidStream = await viewerB.browserContext.request.get(baseUrl + "/api/trips/invalid/stream");
    assert.equal(invalidStream.status(), 400);
    const missingStream = await viewerB.browserContext.request.get(baseUrl + "/api/trips/2147483647/stream");
    assert.equal(missingStream.status(), 404);
    record("Live HTTP rejects malformed input, wrong trip, unknown seat and missing trip");

    await viewerA.page.goto(baseUrl + "/trips");
    await assertSeat(viewerB.page, "A01", "available");
    await assertViewerCount(viewerB.page, 1);
    await assertViewerCount(otherTripViewer.page, 1);
    record("Leaving the component removes its selections from other viewers");
    for (const viewer of [viewerA, viewerB, otherTripViewer]) assert.deepEqual(viewer.runtimeErrors, []);
    record("No browser runtime errors");
  } finally {
    if (browser) await browser.close();
    // Chỉ xóa fixture do lần kiểm thử này tạo, kiểm tra cả ID và nhãn riêng.
    await prisma.trip.deleteMany({ where: { id: { in: createdTripIds }, from: testLabel } });
    await prisma.bus.deleteMany({ where: { id: busId, type: "Xe kiểm thử" } });
    await prisma.$disconnect();
    console.log("Temporary trip fixtures cleaned up. Passed checks: " + results.length);
  }
});
