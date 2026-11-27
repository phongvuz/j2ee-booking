// Production HTTP, MySQL and Chrome cookie checks in an isolated temporary database.
require("dotenv/config");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const { PrismaClient } = require("@prisma/client");
const { load } = require("./load-ts.cjs");
const { Cdp, waitUntil, unusedPort, stopChild } = require("./browser-cdp.cjs");

test("shared-browser admin and customer sessions survive navigation, logout and server restart", { timeout: 120000 }, async () => {
  const chromePath = "C:/Program Files/Google/Chrome/Application/chrome.exe";
  assert.ok(fs.existsSync(chromePath), "Chrome must be installed");
  assert.ok(fs.existsSync(path.resolve(".next/BUILD_ID")), "Run npm run build first");
  const database = `nha_xe_session_verify_${Date.now()}`;
  assert.match(database, /^nha_xe_session_verify_\d+$/);
  const target = new URL(process.env.DATABASE_URL);
  target.pathname = `/${database}`;
  const control = new PrismaClient();
  const prisma = new PrismaClient({ datasources: { db: { url: target.toString() } } });
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "sgu-session-browser-"));
  const env = { ...process.env, DATABASE_URL: target.toString(), SESSION_SECRET: "isolated-session-browser-secret-".repeat(2),
    SGU_DEMO: "false", NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1" };
  const password = "session-browser-123";
  let created = false;
  let server;
  let chrome;
  let cdp;
  let serverOutput = "";
  try {
    await control.$executeRawUnsafe(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    created = true;
    const pushed = spawnSync(process.execPath, [require.resolve("prisma/build/index.js"), "db", "push", "--skip-generate"],
      { env, encoding: "utf8", windowsHide: true });
    assert.equal(pushed.status, 0, pushed.error?.message || pushed.stderr || pushed.stdout);
    const { hashPassword } = load("lib/password.ts");
    const hash = await hashPassword(password);
    await prisma.user.createMany({ data: [
      { fullName: "Session Browser Admin", phone: "0900000001", role: "ADMIN", isActive: true, password: hash },
      { fullName: "Session Browser Customer", phone: "0900000002", role: "CUSTOMER", isActive: true, password: hash },
    ] });
    await prisma.customer.create({ data: { id: "CUS-001", name: "Session Browser Customer", phone: "0900000002", email: "session@example.test" } });
    const port = await unusedPort();
    const baseUrl = `http://127.0.0.1:${port}`;
    async function startServer() {
      server = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "start", "-H", "127.0.0.1", "-p", String(port)],
        { env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
      for (const stream of [server.stdout, server.stderr]) stream.on("data", chunk => { serverOutput = (serverOutput + chunk).slice(-10000); });
      await waitUntil(async () => {
        if (server.exitCode !== null) throw new Error("Server exited");
        return (await fetch(`${baseUrl}/api/auth/session`)).ok;
      }, "Server did not start", 20000);
    }
    await startServer();
    chrome = spawn(chromePath, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
      "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { windowsHide: true, stdio: "ignore" });
    const portFile = path.join(profile, "DevToolsActivePort");
    const activePort = await waitUntil(() => fs.existsSync(portFile) && fs.readFileSync(portFile, "utf8").trim().split(/\r?\n/), "Chrome did not start");
    const socket = new WebSocket(`ws://127.0.0.1:${activePort[0]}${activePort[1]}`);
    await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
    cdp = new Cdp(socket);
    const { browserContextId } = await cdp.send("Target.createBrowserContext");
    async function page() {
      const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank", browserContextId });
      const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
      await cdp.send("Page.enable", {}, sessionId);
      await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: `
        window.authRequests = [];
        const originalFetch = window.fetch;
        window.fetch = (...args) => {
          const pathname = new URL(args[0] instanceof Request ? args[0].url : args[0], location.href).pathname;
          if (pathname === '/api/auth/login' || pathname === '/api/auth/logout') window.authRequests.push(pathname);
          return originalFetch(...args);
        };
        window.addEventListener('beforeunload', () => {
          sessionStorage.setItem('authNavigationState', JSON.stringify({
            loginPending: Boolean(document.querySelector('form[aria-busy="true"] button[type="submit"]:disabled')),
            logoutPending: Array.from(document.querySelectorAll('button')).some(button => button.disabled && button.innerText === 'Đang đăng xuất...'),
            requests: window.authRequests,
          }));
        });
      ` }, sessionId);
      return sessionId;
    }
    async function holdNavigation(sessionId, pathname) {
      const paused = [];
      const listener = ({ data }) => {
        const message = JSON.parse(data);
        if (message.method === "Fetch.requestPaused" && message.sessionId === sessionId) paused.push(message.params.requestId);
      };
      cdp.socket.addEventListener("message", listener);
      await cdp.send("Fetch.enable", { patterns: [
        { urlPattern: `${baseUrl}${pathname}`, requestStage: "Request" },
        { urlPattern: `${baseUrl}${pathname}?*`, requestStage: "Request" },
      ] }, sessionId);
      return {
        wait: () => waitUntil(() => paused.length > 0, `Navigation to ${pathname} did not start`),
        async release() {
          for (const requestId of paused) await cdp.send("Fetch.continueRequest", { requestId }, sessionId);
          await cdp.send("Fetch.disable", {}, sessionId);
          cdp.socket.removeEventListener("message", listener);
        },
      };
    }
    async function navigate(sessionId, pathname, expectedText) {
      const destination = new URL(baseUrl + pathname);
      await cdp.send("Page.navigate", { url: baseUrl + pathname }, sessionId);
      await waitUntil(() => cdp.evaluate(sessionId, `location.pathname === ${JSON.stringify(destination.pathname)} && location.search === ${JSON.stringify(destination.search)} && location.hash === ${JSON.stringify(destination.hash)} && document.readyState === 'complete' && document.body?.innerText.includes(${JSON.stringify(expectedText)})`),
        `Navigation failed: ${pathname}`);
    }
    async function request(sessionId, pathname, body) {
      return cdp.evaluate(sessionId, `(async () => {
        const response = await fetch(${JSON.stringify(pathname)}, ${JSON.stringify(body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {})});
        return { status: response.status, body: await response.json() };
      })()`);
    }
    async function signIn(sessionId, audience) {
      const result = await request(sessionId, "/api/auth/login", {
        identifier: audience === "admin" ? "0900000001" : "0900000002", password, audience,
      });
      assert.equal(result.status, 200);
    }
    async function cookies() { return (await cdp.send("Storage.getCookies", { browserContextId })).cookies; }
    async function fill(sessionId, selector, value) {
      await cdp.evaluate(sessionId, `document.querySelector(${JSON.stringify(selector)}).focus(); document.querySelector(${JSON.stringify(selector)}).select()`);
      await cdp.send("Input.insertText", { text: value }, sessionId);
    }
    async function loginFromModal(sessionId) {
      await waitUntil(() => cdp.evaluate(sessionId, `Boolean(document.querySelector('dialog[open] #login-identifier'))`), "Login dialog did not open");
      await fill(sessionId, "#login-identifier", "0900000002");
      await fill(sessionId, "#login-password", password);
      await cdp.evaluate(sessionId, `document.querySelector('dialog form button[type="submit"]').click()`);
    }
    async function assertProfile(sessionId, name, email, phone) {
      await waitUntil(() => cdp.evaluate(sessionId, `location.pathname === '/profile' && document.querySelector('#fullName')?.value === ${JSON.stringify(name)} && document.querySelector('header')?.innerText.includes(${JSON.stringify(`Xin chào, ${name}`)})`),
        "Profile data did not appear after authentication without a reload");
      assert.equal(await cdp.evaluate(sessionId, "document.querySelector('#email').value"), email);
      assert.equal(await cdp.evaluate(sessionId, "document.querySelector('#phone').value"), phone);
    }
    const uiTab = await page();
    await navigate(uiTab, "/lookup?source=login-test#tickets", "Tra cứu");
    await cdp.evaluate(uiTab, `document.querySelector('header a[href*="auth=login"]').click()`);
    await loginFromModal(uiTab);
    await waitUntil(() => cdp.evaluate(uiTab, `!document.querySelector('dialog[open]') && document.querySelector('header')?.innerText.includes('Xin chào, Session Browser Customer')`),
      "Customer greeting did not update immediately after modal login", 8000);
    assert.equal(await cdp.evaluate(uiTab, "location.pathname + location.search + location.hash"), "/lookup?source=login-test#tickets");
    await cdp.evaluate(uiTab, `document.querySelector('button[aria-label="Các chức năng tài khoản"]').click()`);
    await cdp.evaluate(uiTab, `document.querySelector('header a[href="/profile"]').click()`);
    await assertProfile(uiTab, "Session Browser Customer", "session@example.test", "0900000002");
    console.log("PASS: customer modal login immediately updates the header and profile without a manual reload");

    await request(uiTab, "/api/auth/logout?audience=customer", {});
    await cdp.send("Page.navigate", { url: `${baseUrl}/login?next=/profile` }, uiTab);
    await loginFromModal(uiTab);
    await assertProfile(uiTab, "Session Browser Customer", "session@example.test", "0900000002");
    assert.equal(await cdp.evaluate(uiTab, "document.querySelector('header').innerText.includes('Xin chào, Session Browser Customer')"), true);
    console.log("PASS: login return destination shows the customer's profile and greeting on arrival");

    await request(uiTab, "/api/auth/logout?audience=customer", {});
    await cdp.send("Page.navigate", { url: `${baseUrl}/register?next=/profile` }, uiTab);
    await waitUntil(() => cdp.evaluate(uiTab, `Boolean(document.querySelector('dialog[open] #fullName'))`), "Registration dialog did not open");
    for (const [selector, value] of [["#fullName", "New Session Customer"], ["#phone", "0900000003"], ["#email", "new-session@example.test"], ["#password", password], ["#confirmPassword", password]]) {
      await fill(uiTab, selector, value);
    }
    await cdp.evaluate(uiTab, `document.querySelector('#terms').click(); document.querySelector('dialog form button[type="submit"]').click()`);
    await assertProfile(uiTab, "New Session Customer", "new-session@example.test", "0900000003");
    assert.equal(await cdp.evaluate(uiTab, "document.querySelector('header').innerText.includes('Xin chào, New Session Customer')"), true);
    await request(uiTab, "/api/auth/logout?audience=customer", {});
    console.log("PASS: registration auto-login immediately displays the new customer's name and profile");

    const adminTab = await page();
    const customerTab = await page();
    await navigate(adminTab, "/admin/login", "Đăng nhập quản trị");
    await fill(adminTab, "#login-identifier", "0900000001");
    await fill(adminTab, "#login-password", "incorrect-password");
    await cdp.evaluate(adminTab, `document.querySelector('form button[type="submit"]').click()`);
    await waitUntil(() => cdp.evaluate(adminTab, `Boolean(document.querySelector('[role="alert"]')) && !document.querySelector('form button[type="submit"]').disabled`),
      "Failed admin login must show an error and allow retry");
    await fill(adminTab, "#login-password", password);
    const loginNavigation = await holdNavigation(adminTab, "/admin");
    try {
      await cdp.evaluate(adminTab, `document.querySelector('form button[type="submit"]').click(); document.querySelector('form button[type="submit"]').click(); document.querySelector('form').requestSubmit()`);
      await loginNavigation.wait();
      await new Promise(resolve => setTimeout(resolve, 300));
    } finally { await loginNavigation.release(); }
    await waitUntil(() => cdp.evaluate(adminTab, `location.pathname === '/admin' && document.body?.innerText.includes('Session Browser Admin')`),
      "One successful admin login click must reach the dashboard");
    const loginState = await cdp.evaluate(adminTab, `JSON.parse(sessionStorage.getItem('authNavigationState'))`);
    assert.equal(loginState?.loginPending, true, "Login must remain disabled until the old page unloads");
    assert.equal(loginState.requests.filter(path => path === "/api/auth/login").length, 2,
      "One failed attempt and one successful attempt must not create duplicate login requests");
    console.log("PASS: admin login allows retry after failure and one successful click stays locked until navigation completes");
    await navigate(customerTab, "/lookup", "Tra cứu");
    await signIn(customerTab, "customer");
    for (const name of ["admin_session", "customer_session"]) {
      const cookie = (await cookies()).find(value => value.name === name);
      assert.ok(cookie, `${name} must be stored by Chrome`);
      assert.equal(cookie.httpOnly, true);
      assert.equal(cookie.sameSite, "Lax");
      assert.ok(cookie.expires > Date.now() / 1000 + 86000);
    }
    await navigate(adminTab, "/admin", "Session Browser Admin");
    await navigate(customerTab, "/profile", "Hồ sơ cá nhân");
    assert.equal((await request(adminTab, "/api/admin/stats")).status, 200);
    assert.equal((await request(customerTab, "/api/auth/session")).body.user.role, "CUSTOMER");
    console.log("PASS: both roles retain separate 24-hour HttpOnly cookies in the same browser");

    await stopChild(server);
    await startServer();
    await navigate(adminTab, "/admin", "Session Browser Admin");
    await navigate(customerTab, "/profile", "Hồ sơ cá nhân");
    console.log("PASS: both sessions survive navigation, reload and a server restart with the same secret");

    await cdp.evaluate(customerTab, `document.querySelector('button[aria-label="Các chức năng tài khoản"]').click()`);
    await cdp.evaluate(customerTab, `Array.from(document.querySelectorAll('button')).find(button => button.innerText === 'Đăng xuất').click()`);
    await waitUntil(async () => !(await cookies()).some(value => value.name === "customer_session"), "Customer logout did not clear its cookie");
    assert.ok((await cookies()).some(value => value.name === "admin_session"));
    assert.equal((await request(adminTab, "/api/admin/stats")).status, 200);
    await signIn(adminTab, "customer");
    await navigate(adminTab, "/admin", "Session Browser Admin");
    await cdp.evaluate(adminTab, `(() => {
      const originalFetch = window.fetch;
      window.fetch = (...args) => {
        if (new URL(args[0], location.href).pathname === '/api/auth/logout') {
          window.fetch = originalFetch;
          return Promise.resolve(new Response('', { status: 503 }));
        }
        return originalFetch(...args);
      };
      Array.from(document.querySelectorAll('button')).find(button => button.innerText === 'Đăng xuất').click();
    })()`);
    await waitUntil(() => cdp.evaluate(adminTab, `document.querySelector('[role="alert"]')?.innerText.includes('Không thể đăng xuất') && Array.from(document.querySelectorAll('button')).some(button => !button.disabled && button.innerText === 'Đăng xuất')`),
      "Failed logout must show an error and allow retry");
    assert.ok((await cookies()).some(value => value.name === "admin_session"));
    const logoutNavigation = await holdNavigation(adminTab, "/admin/login");
    try {
      await cdp.evaluate(adminTab, `(() => { const button = Array.from(document.querySelectorAll('button')).find(button => button.innerText === 'Đăng xuất'); button.click(); button.click(); })()`);
      await logoutNavigation.wait();
      await new Promise(resolve => setTimeout(resolve, 300));
    } finally { await logoutNavigation.release(); }
    await waitUntil(() => cdp.evaluate(adminTab, `location.pathname === '/admin/login' && document.querySelector('#login-identifier') !== null`),
      "One logout click must return to the admin login page");
    const logoutState = await cdp.evaluate(adminTab, `JSON.parse(sessionStorage.getItem('authNavigationState'))`);
    assert.equal(logoutState?.logoutPending, true, "Logout must remain disabled until the old page unloads");
    assert.equal(logoutState.requests.filter(path => path === "/api/auth/logout").length, 1);
    await waitUntil(async () => !(await cookies()).some(value => value.name === "admin_session"), "Admin logout did not clear its cookie");
    assert.ok((await cookies()).some(value => value.name === "customer_session"));
    await navigate(customerTab, "/profile", "Hồ sơ cá nhân");
    assert.equal((await request(customerTab, "/api/admin/stats")).status, 403);
    console.log("PASS: logout buttons clear only their own session and role guards still reject customers");
  } catch (error) {
    error.message += `\nServer output:\n${serverOutput}`;
    throw error;
  } finally {
    cdp?.socket.close();
    await stopChild(chrome);
    await stopChild(server);
    await prisma.$disconnect();
    if (created && /^nha_xe_session_verify_\d+$/.test(database)) await control.$executeRawUnsafe(`DROP DATABASE \`${database}\``);
    await control.$disconnect();
    const resolvedProfile = path.resolve(profile);
    assert.equal(path.dirname(resolvedProfile), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolvedProfile).startsWith("sgu-session-browser-"));
    fs.rmSync(resolvedProfile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
});
