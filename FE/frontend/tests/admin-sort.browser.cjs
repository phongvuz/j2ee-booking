const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const { PrismaClient } = require("@prisma/client");
const { load } = require("./load-ts.cjs");
require("dotenv/config");

// Read-only browser check: reuse a local admin for the layout and mock list data.
test("admin sort controls reset pagination, preserve filters and refresh, and fit mobile screens", { timeout: 180000 }, async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || path.join(process.env.TEMP, "nha-xe-sse-browser-tests", "node_modules", "playwright"));
  const prisma = new PrismaClient();
  const baseUrl = process.env.ADMIN_SORT_TEST_URL || "http://localhost:3000";
  const errors = [];
  let browser;
  try {
    const admin = await prisma.user.findFirst({ where: { role: "ADMIN", isActive: true }, select: { id: true, password: true } });
    assert.ok(admin, "a local active admin is required for the read-only browser check");
    const { createSessionToken, ADMIN_SESSION_COOKIE } = load("lib/session.ts", { "@/lib/prisma": { prisma } });
    const executablePath = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find((candidate) => fs.existsSync(candidate));
    browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.addCookies([{ name: ADMIN_SESSION_COOKIE, value: createSessionToken(admin.id, admin.password), url: baseUrl, httpOnly: true, sameSite: "Lax" }]);
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    const cases = [
      ["trips", "/api/trips", "price"],
      ["buses", "/api/buses", "capacity"],
      ["employees", "/api/employees", "name"],
      ["orders", "/api/admin/orders", "totalPrice"],
      ["users", "/api/users", "fullName"],
    ];
    const paths = new Set(cases.map((item) => item[1]));
    const requests = [];
    await page.route("**/api/**", async (route) => {
      const url = new URL(route.request().url());
      if (!paths.has(url.pathname) || route.request().method() !== "GET") return route.continue();
      requests.push(url.pathname + url.search);
      const limit = Number(url.searchParams.get("limit") || 10);
      await route.fulfill({ json: {
        success: true, data: [],
        pagination: { page: Number(url.searchParams.get("page") || 1), limit, total: 20, totalPages: Math.ceil(20 / limit) },
        stats: { total: 20, active: 0, maintenance: 0, inactive: 0, onLeave: 0, drivers: 0, departingToday: 0, totalBookings: 0, avgOccupancy: 0, confirmed: 0, pending: 0, cancelled: 0, totalRevenue: 0, users: 0, admins: 0, newThisMonth: 0 },
      } });
    });

    for (const [section, apiPath, field] of cases) {
      await page.goto(`${baseUrl}/admin/${section}`);
      const sortBy = page.getByLabel("Sắp xếp theo", { exact: true });
      const sortOrder = page.getByLabel("Thứ tự sắp xếp", { exact: true });
      assert.equal(new URL(page.url()).pathname, `/admin/${section}`, "admin page must be served without an authentication redirect");
      await sortBy.waitFor();
      // Wait for the first client fetch so controls are hydrated before typing.
      await page.getByRole("button", { name: "2", exact: true }).waitFor();
      assert.equal(await sortBy.inputValue(), "createdAt");
      assert.equal(await sortOrder.inputValue(), "desc");
      async function requestAfter(action, expected) {
        const request = page.waitForRequest((entry) => {
          const url = new URL(entry.url());
          return url.pathname === apiPath && Object.entries(expected).every(([key, value]) => (url.searchParams.get(key) || "") === value);
        });
        await action();
        try { await request; } catch (error) {
          console.log({ section, expected, requests: requests.slice(-8), errors });
          throw error;
        }
        await page.getByRole("button", { name: "2", exact: true }).waitFor();
      }
      await requestAfter(() => page.getByPlaceholder(/^Tìm/).fill("SORT CHECK"), { search: "SORT CHECK", page: "1" });
      await requestAfter(() => page.getByRole("button", { name: "2", exact: true }).click(), { page: "2" });
      await requestAfter(() => sortBy.selectOption(field), { sortBy: field, sortOrder: "desc", page: "1", search: "SORT CHECK" });
      await requestAfter(() => sortOrder.selectOption("asc"), { sortBy: field, sortOrder: "asc", page: "1", search: "SORT CHECK" });
      await requestAfter(() => page.getByRole("button", { name: "2", exact: true }).click(), { sortBy: field, sortOrder: "asc", page: "2" });
      await requestAfter(() => page.getByRole("button", { name: /Làm mới/ }).first().click(), { sortBy: field, sortOrder: "asc", page: "2", search: "SORT CHECK" });
      await page.setViewportSize({ width: 390, height: 844 });
      for (const control of [sortBy, sortOrder]) {
        const bounds = await control.boundingBox();
        assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= 390, `${section} sort fits mobile width`);
      }
      if (process.env.ADMIN_SORT_SCREENSHOT_DIR) {
        fs.mkdirSync(process.env.ADMIN_SORT_SCREENSHOT_DIR, { recursive: true });
        await page.screenshot({ path: path.join(process.env.ADMIN_SORT_SCREENSHOT_DIR, `${section}-mobile.png`), fullPage: true });
      }
      await page.setViewportSize({ width: 1280, height: 900 });
      console.log(`PASS: ${section} sorting, pagination reset, filter retention, refresh and mobile layout`);
    }

    await page.goto(`${baseUrl}/admin/payments?review=1&page=2`);
    const paymentField = page.getByLabel("Sắp xếp theo", { exact: true });
    await paymentField.selectOption("amount");
    await page.waitForURL((url) => url.searchParams.get("sortBy") === "amount" && url.searchParams.get("page") === "1");
    assert.equal(new URL(page.url()).searchParams.get("review"), "1");
    await page.getByLabel("Thứ tự sắp xếp", { exact: true }).selectOption("asc");
    await page.waitForURL((url) => url.searchParams.get("sortOrder") === "asc");
    assert.equal(new URL(page.url()).searchParams.get("review"), "1");
    await page.getByRole("link", { name: "Tất cả", exact: true }).click();
    await page.waitForURL((url) => !url.searchParams.has("review") && url.searchParams.get("sortBy") === "amount" && url.searchParams.get("sortOrder") === "asc");
    console.log("PASS: payment URL sorting retains the review filter and filter links retain sorting");
    assert.deepEqual(errors, []);
  } finally {
    if (browser) await browser.close();
    await prisma.$disconnect();
  }
});
