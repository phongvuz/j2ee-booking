const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const { randomInt } = require("node:crypto");
const { PrismaClient } = require("@prisma/client");
const { load } = require("./load-ts.cjs");
require("dotenv/config");

test("real registration, cookie persistence, login, password rotation, logout and admin permissions", { timeout: 180000 }, async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || path.join(process.env.TEMP, "nha-xe-sse-browser-tests", "node_modules", "playwright"));
  const prisma = new PrismaClient();
  const baseUrl = process.env.AUTH_TEST_URL || "http://localhost:3000";
  const label = `AUTH TEST ${Date.now()}`;
  const email = `auth-${Date.now()}@example.test`;
  const oldPassword = "test-secret-123";
  const newPassword = "test-changed-123";
  const errors = [];
  let customerUser;
  let adminUser;
  let browser;

  async function unusedPhone() {
    for (;;) {
      const phone = `099${randomInt(0, 10000000).toString().padStart(7, "0")}`;
      if (!await prisma.user.findUnique({ where: { phone } }) && !await prisma.customer.findUnique({ where: { phone } })) return phone;
    }
  }
  async function cookie(context) {
    return (await context.cookies()).find(entry => entry.name === "customer_session");
  }
  function record(message) { console.log(`PASS: ${message}`); }

  try {
    const phone = await unusedPhone();
    const executablePath = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(candidate => fs.existsSync(candidate));
    browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
    const context = await browser.newContext();
    const page = await context.newPage();
    page.on("pageerror", error => errors.push(error.message));

    assert.equal((await context.request.get(`${baseUrl}/api/admin/stats`)).status(), 401);
    await page.goto(`${baseUrl}/admin`);
    await page.waitForURL(url => url.pathname === "/admin/login");
    await page.getByRole("heading", { name: "Đăng nhập quản trị", exact: true }).waitFor();
    assert.equal(await page.getByRole("dialog").count(), 0);
    assert.equal(await page.locator("header, footer").count(), 0);
    assert.equal(await page.getByRole("button", { name: "Đăng ký ngay" }).count(), 0);
    if (process.env.AUTH_SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.AUTH_SCREENSHOT_DIR, "admin-login-desktop.png"), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.getByLabel("Số điện thoại", { exact: true }).isVisible());
    if (process.env.AUTH_SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.AUTH_SCREENSHOT_DIR, "admin-login-mobile.png"), fullPage: true });
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`${baseUrl}/login?next=/admin`);
    await page.waitForURL(url => url.pathname === "/admin/login");
    await page.goto(`${baseUrl}/register?next=/profile`);
    const registration = page.getByRole("dialog", { name: "Đăng ký tài khoản", exact: true });
    await registration.waitFor();
    await registration.getByLabel("Họ và tên").fill(label);
    await registration.getByLabel("Số điện thoại").fill(phone);
    await registration.getByLabel("Email").fill(email);
    await registration.locator("#password").fill(oldPassword);
    await registration.getByLabel("Nhập lại mật khẩu").fill(oldPassword);
    await registration.getByRole("checkbox").check();
    await registration.getByRole("button", { name: "Đăng ký tài khoản", exact: true }).click();
    await page.waitForURL(url => url.pathname === "/profile");
    await page.getByRole("heading", { name: "Hồ sơ cá nhân" }).waitFor();
    customerUser = await prisma.user.findUniqueOrThrow({ where: { phone } });
    assert.equal(customerUser.role, "CUSTOMER");
    assert.ok(customerUser.password.startsWith("scrypt:"));
    const registeredCookie = await cookie(context);
    assert.ok(registeredCookie);
    assert.equal(registeredCookie.httpOnly, true);
    assert.equal(registeredCookie.sameSite, "Lax");
    assert.equal(registeredCookie.path, "/");
    assert.ok(registeredCookie.expires > Date.now() / 1000 + 86000);
    assert.equal(await page.evaluate(() => document.cookie.includes("customer_session")), false);
    assert.equal((await (await context.request.get(`${baseUrl}/api/auth/session`)).json()).user.id, customerUser.id);
    record("registration saves hashed account and customer, auto-login sets a 24-hour HttpOnly cookie and returns to profile");

    await page.reload();
    await page.getByRole("heading", { name: "Hồ sơ cá nhân" }).waitFor();
    const otherContext = await browser.newContext({ storageState: await context.storageState() });
    const otherPage = await otherContext.newPage();
    await otherPage.goto(`${baseUrl}/profile`);
    await otherPage.getByRole("heading", { name: "Hồ sơ cá nhân" }).waitFor();
    assert.equal((await context.request.get(`${baseUrl}/api/admin/stats`)).status(), 403);
    await page.goto(`${baseUrl}/admin`);
    await page.waitForURL(url => url.pathname === "/admin/login");
    await page.getByLabel("Số điện thoại", { exact: true }).fill(phone);
    await page.getByLabel("Mật khẩu", { exact: true }).fill(oldPassword);
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await page.getByRole("alert").waitFor();
    assert.equal(new URL(page.url()).pathname, "/admin/login");
    assert.equal((await (await context.request.get(`${baseUrl}/api/auth/session`)).json()).user.role, "CUSTOMER");
    await page.goto(`${baseUrl}/profile`);
    record("cookie persists on reload and restored browser session; customers cannot access administration");

    await page.getByLabel("Mật khẩu hiện tại").fill(oldPassword);
    await page.getByLabel("Mật khẩu mới", { exact: true }).fill(newPassword);
    await page.getByLabel("Xác nhận mật khẩu mới").fill(newPassword);
    await page.getByRole("button", { name: "Đổi mật khẩu", exact: true }).click();
    await page.getByRole("status").filter({ hasText: "Đổi mật khẩu thành công!" }).waitFor();
    assert.notEqual((await cookie(context)).value, registeredCookie.value);
    assert.equal((await (await context.request.get(`${baseUrl}/api/auth/session`)).json()).authenticated, true);
    assert.equal((await (await otherContext.request.get(`${baseUrl}/api/auth/session`)).json()).authenticated, false);
    await otherContext.close();
    record("password change keeps the current browser signed in and rejects the previous token in another browser");

    await page.getByRole("button", { name: "Các chức năng tài khoản" }).focus();
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
    await page.waitForURL(url => url.pathname === "/");
    await page.getByRole("link", { name: "Đăng nhập", exact: true }).waitFor();
    assert.equal(await cookie(context), undefined);
    await page.goto(`${baseUrl}/login?next=/bookings`);
    const login = page.getByRole("dialog", { name: "Đăng nhập", exact: true });
    await page.getByLabel("Email hoặc Số điện thoại").fill(` ${email.toUpperCase()} `);
    await page.getByLabel("Mật khẩu", { exact: true }).fill(oldPassword);
    await login.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await login.getByRole("alert").waitFor();
    assert.equal(await cookie(context), undefined);
    await page.getByLabel("Mật khẩu", { exact: true }).fill(newPassword);
    await login.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await page.waitForURL(url => url.pathname === "/bookings");
    await page.getByRole("heading", { name: "Lịch sử đặt vé" }).waitFor();
    await prisma.user.update({ where: { id: customerUser.id }, data: { isActive: false } });
    assert.equal((await (await context.request.get(`${baseUrl}/api/auth/session`)).json()).authenticated, false);
    await prisma.user.update({ where: { id: customerUser.id }, data: { isActive: true } });
    await page.goto(`${baseUrl}/login`);
    await page.getByLabel("Email hoặc Số điện thoại").fill(phone);
    await page.getByLabel("Mật khẩu", { exact: true }).fill(newPassword);
    await page.getByRole("dialog").getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    assert.equal((await (await context.request.get(`${baseUrl}/api/auth/session`)).json()).authenticated, true);
    assert.equal((await context.request.post(`${baseUrl}/api/auth/logout`, { headers: { origin: "https://other.example" } })).status(), 403);
    assert.ok(await cookie(context));
    record("logout deletes cookie, old password is rejected, email/phone login works, locked account and cross-site logout are rejected");

    const { hashPassword } = load("lib/password.ts");
    adminUser = await prisma.user.create({ data: { fullName: label + " ADMIN", phone: await unusedPhone(), password: await hashPassword(oldPassword), role: "ADMIN", isActive: true } });
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    adminPage.on("pageerror", error => errors.push(error.message));
    await adminPage.goto(`${baseUrl}/admin`);
    await adminPage.waitForURL(url => url.pathname === "/admin/login");
    await adminPage.getByLabel("Số điện thoại", { exact: true }).fill(adminUser.phone);
    await adminPage.getByLabel("Mật khẩu", { exact: true }).fill(oldPassword);
    await adminPage.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await adminPage.waitForURL(url => url.pathname === "/admin");
    await adminPage.getByRole("heading", { name: "Bảng điều khiển hệ thống" }).waitFor();
    assert.equal((await adminContext.request.get(`${baseUrl}/api/admin/stats`)).status(), 200);
    await adminPage.goto(`${baseUrl}/admin/login`);
    await adminPage.waitForURL(url => url.pathname === "/admin");
    await adminPage.goto(`${baseUrl}/lookup`);
    await adminPage.getByRole("link", { name: "Trang quản trị", exact: true }).waitFor();
    await adminPage.getByRole("link", { name: "Trang quản trị", exact: true }).click();
    await adminPage.waitForURL(url => url.pathname === "/admin");
    await adminPage.getByRole("button", { name: "Đăng xuất", exact: true }).click();
    await adminPage.waitForURL(url => url.pathname === "/admin/login");
    await adminPage.getByRole("heading", { name: "Đăng nhập quản trị", exact: true }).waitFor();
    assert.equal(await adminPage.getByRole("dialog").count(), 0);
    assert.equal((await adminContext.request.get(`${baseUrl}/api/admin/stats`)).status(), 401);
    assert.deepEqual(errors, []);
    record("administrator login reaches admin, public header shows admin account, logout removes admin access; no browser runtime errors");
  } finally {
    if (browser) await browser.close();
    // Delete only accounts uniquely created by this check, never application records.
    const createdCustomer = await prisma.customer.findUnique({ where: { email } });
    if (createdCustomer?.name === label) {
      const createdUser = await prisma.user.findUnique({ where: { phone: createdCustomer.phone } });
      await prisma.$transaction(async tx => {
        await tx.customer.delete({ where: { id: createdCustomer.id } });
        if (createdUser?.fullName === label) await tx.user.delete({ where: { id: createdUser.id } });
      });
    }
    if (adminUser) await prisma.user.deleteMany({ where: { id: adminUser.id, fullName: label + " ADMIN" } });
    await prisma.$disconnect();
  }
});
