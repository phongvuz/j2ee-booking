const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const { PrismaClient } = require("@prisma/client");
const { load } = require("./load-ts.cjs");
require("dotenv/config");

// Chỉ đọc tài khoản admin; các API chuyến xe được giả lập, không sửa database.
test("trip forms validate, retry failures, reset on reopen and preserve departure seconds", { timeout: 120000 }, async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || path.join(process.env.TEMP, "nha-xe-sse-browser-tests", "node_modules", "playwright"));
  const prisma = new PrismaClient();
  const baseUrl = process.env.ADMIN_TRIPS_TEST_URL || "http://localhost:3000";
  let browser;
  try {
    const admin = await prisma.user.findFirst({ where: { role: "ADMIN", isActive: true }, select: { id: true, password: true } });
    assert.ok(admin, "Cần tài khoản admin đang hoạt động để kiểm tra giao diện.");
    const { createSessionToken, ADMIN_SESSION_COOKIE } = load("lib/session.ts", { "@/lib/prisma": { prisma } });
    const executablePath = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find((file) => fs.existsSync(file));
    browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.addCookies([{ name: ADMIN_SESSION_COOKIE, value: createSessionToken(admin.id, admin.password), url: baseUrl, httpOnly: true, sameSite: "Lax" }]);
    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    const trip = {
      id: 101, from: "Sài Gòn", to: "Đà Lạt", time: "2099-12-02T01:00:45.000Z",
      busId: "BUS-UI-30", bus: { id: "BUS-UI-30", plate: "51B-003.00", type: "Ghế ngồi", capacity: 30, status: "Đang hoạt động" },
      price: 300000, availableSeats: 28, totalSeats: 30, bookedSeatsCount: 2,
      occupancyRate: 7, createdAt: "2026-10-11T00:00:00.000Z",
      bookings: [
        { id: 1, seatNumber: "A01", status: "CONFIRMED", totalPrice: 300000, userName: "Khách đã trả tiền", userPhone: "0900000001" },
        { id: 2, seatNumber: "A02", status: "PENDING", totalPrice: 300000, userName: "Khách chờ trả tiền", userPhone: "0900000002" },
        { id: 3, seatNumber: "A03", status: "CANCELLED", totalPrice: 300000, userName: "Khách đã hủy", userPhone: "0900000003" },
      ],
    };
    const writes = [];
    let failedCreate = false;
    let failedDelete = false;
    await page.route("**/api/buses?selectable=true", (route) => route.fulfill({ json: { success: true, data: [trip.bus] } }));
    await page.route("**/api/trips**", async (route) => {
      const request = route.request();
      if (request.method() === "GET") {
        if (new URL(request.url()).pathname === "/api/trips/locations") {
          await route.fulfill({ json: { success: true, data: [trip.from, trip.to] } });
          return;
        }
        await route.fulfill({ json: {
          success: true, data: [trip], pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
          stats: { total: 1, departingToday: 0, totalBookings: 2, avgOccupancy: 7 },
        } });
        return;
      }
      writes.push({ method: request.method(), data: request.postDataJSON() });
      if (request.method() === "POST" && !failedCreate) {
        failedCreate = true;
        await route.fulfill({ status: 500, json: { success: false, message: "Lỗi lưu thử nghiệm" } });
      } else if (request.method() === "DELETE" && !failedDelete) {
        failedDelete = true;
        await route.fulfill({ status: 409, json: { success: false, message: "Lỗi xóa thử nghiệm" } });
      } else {
        await route.fulfill({ json: { success: true, data: trip } });
      }
    });

    await page.goto(`${baseUrl}/admin/trips`);
    const row = page.locator("tbody tr").first();
    await row.waitFor();
    await page.getByRole("button", { name: "Thêm chuyến xe mới" }).click();
    await page.locator("#trip-bus").selectOption(trip.busId);
    await page.getByRole("button", { name: "Tạo chuyến xe", exact: true }).click();
    await page.getByText("Điểm khởi hành không được để trống", { exact: true }).waitFor();
    assert.equal(writes.length, 0);
    await page.locator("#trip-from").selectOption("Sài Gòn");
    assert.equal(await page.locator('#trip-to option[value="Sài Gòn"]').isDisabled(), true);
    assert.equal(writes.length, 0);
    await page.locator("#trip-to").selectOption("Đà Lạt");
    assert.equal(await page.locator("#trip-capacity").textContent(), "30 chỗ");
    assert.equal(await page.locator('input[name="capacity"]').count(), 0);
    await page.getByRole("button", { name: "Tạo chuyến xe", exact: true }).click();
    await page.locator("form [role=alert]").filter({ hasText: "Lỗi lưu thử nghiệm" }).waitFor();
    await page.getByRole("button", { name: "Tạo chuyến xe", exact: true }).click();
    await page.locator("#trip-from").waitFor({ state: "detached" });
    assert.equal(writes[1].data.from, "Sài Gòn");
    assert.equal(writes[1].data.busId, trip.busId);
    assert.equal(Object.hasOwn(writes[1].data, "capacity"), false);
    assert.equal(typeof writes[1].data.price, "number");

    await page.getByRole("button", { name: "Thêm chuyến xe mới" }).click();
    assert.equal(await page.locator("#trip-from").inputValue(), "");
    assert.equal(await page.locator("form [role=alert]").count(), 0);
    await page.getByRole("button", { name: "Hủy", exact: true }).click();
    await row.getByRole("button", { name: "Chỉnh sửa chuyến xe", exact: true }).click();
    assert.equal(await page.locator("#trip-time").inputValue(), "2099-12-02T08:00");
    await page.locator("#trip-price").fill("400000");
    await page.getByRole("button", { name: "Cập nhật chuyến xe", exact: true }).click();
    await page.locator("#trip-from").waitFor({ state: "detached" });
    assert.equal(writes[2].data.time, trip.time);
    await row.getByRole("button", { name: "Chỉnh sửa chuyến xe", exact: true }).click();
    await page.locator("#trip-time").fill("2099-12-02T09:30");
    await page.getByRole("button", { name: "Cập nhật chuyến xe", exact: true }).click();
    await page.locator("#trip-from").waitFor({ state: "detached" });
    assert.equal(writes[3].data.time, "2099-12-02T09:30");

    await row.getByRole("button", { name: "Xem danh sách khách và ghế" }).click();
    await page.getByText("Khách đã trả tiền", { exact: true }).waitFor();
    assert.equal(await page.getByText("Khách đã hủy", { exact: true }).count(), 0);
    await page.getByRole("button", { name: "Chỉnh sửa chuyến xe", exact: true }).last().click();
    assert.equal(await page.locator("#trip-from").inputValue(), trip.from);
    await page.getByRole("button", { name: "Hủy", exact: true }).click();
    await row.getByRole("button", { name: "Xóa chuyến xe", exact: true }).click();
    await page.getByRole("button", { name: "Xác nhận xóa", exact: true }).click();
    await page.locator("[role=alert]").filter({ hasText: "Lỗi xóa thử nghiệm" }).waitFor();
    await page.getByRole("button", { name: "Xác nhận xóa", exact: true }).click();
    await page.getByRole("button", { name: "Xác nhận xóa", exact: true }).waitFor({ state: "detached" });
    assert.deepEqual(pageErrors, []);
  } finally {
    if (browser) await browser.close();
    await prisma.$disconnect();
  }
});
