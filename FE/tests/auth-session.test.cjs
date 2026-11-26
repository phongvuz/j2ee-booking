const { test } = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./load-ts.cjs");

process.env.SESSION_SECRET = "test-secret-".repeat(4);
const session = load("lib/session.ts", { "@/lib/prisma": { prisma: {} } });

test("new logins have distinct tokens and session responses never expose the password hash", async () => {
  const password = "private-stored-password-hash";
  const token = session.createSessionToken(7, password);
  assert.notEqual(token, session.createSessionToken(7, password));
  assert.ok(!token.includes(password));
  const account = { id: 7, fullName: "Test", phone: "0901234567", role: "ADMIN", isActive: true, password };
  const current = load("lib/session.ts", {
    "next/headers": { cookies: async () => ({ get: () => ({ value: token }) }) },
    "@/lib/prisma": { prisma: { user: { findUnique: async () => account } } },
  });
  assert.equal((await current.getCurrentUser()).id, 7);
  assert.equal("password" in await current.getCurrentUser(), false);
  account.password = "new-stored-password-hash";
  assert.equal(await current.getCurrentUser(), null);
});

test("invalid tokens and legacy cookies are rejected before reading the database", async () => {
  for (const token of ["bad", "7.9999999999999." + "a".repeat(64), session.createSessionToken(7, "hash", 0), session.createSessionToken(7, "hash").replace(/^7/, "8")]) {
    const current = load("lib/session.ts", {
      "next/headers": { cookies: async () => ({ get: () => ({ value: token }) }) },
      "@/lib/prisma": { prisma: { user: { findUnique: async () => { throw new Error("Unexpected database access"); } } } },
    });
    assert.equal(await current.getCurrentUser(), null);
  }
  for (const id of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => session.createSessionToken(id, "hash"));
});

test("cross-site login, registration and logout are rejected before any changes", async () => {
  for (const route of ["login", "register", "logout"]) {
    const { POST } = load(`app/api/auth/${route}/route.ts`, {
      "@/lib/prisma": { prisma: {} }, "@/lib/session": session,
    });
    for (const headers of [{ origin: "https://other.example" }, { "sec-fetch-site": "cross-site" }]) {
      const response = await POST(new Request(`http://localhost/api/auth/${route}`, { method: "POST", headers, body: "{}" }));
      assert.equal(response.status, 403);
      assert.equal(response.headers.get("set-cookie"), null);
    }
  }
});

test("session endpoint returns only public account fields and rejects ineligible customers", async () => {
  const account = { id: 7, fullName: "Test", phone: "0901234567", role: "CUSTOMER", password: "private" };
  for (const [user, customer, allowed] of [[null, null, false], [account, null, false], [account, { name: "Customer" }, true], [{ ...account, role: "ADMIN" }, null, true], [{ ...account, role: "USER" }, null, false]]) {
    const { GET } = load("app/api/auth/session/route.ts", {
      "@/lib/session": { ...session, getCurrentUser: async () => user, getCurrentCustomer: async () => customer },
    });
    const response = await GET();
    const data = await response.json();
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(data.authenticated, allowed);
    assert.deepEqual(data.user, allowed ? { id: 7, name: customer?.name ?? "Test", role: user.role } : null);
    assert.equal(response.headers.get("set-cookie"), null);
    assert.ok(!JSON.stringify(data).includes("private"));
  }
});

test("registration checks session configuration before committing an account", async () => {
  const { POST } = load("app/api/auth/register/route.ts", {
    "@/lib/prisma": { prisma: {
      user: { findUnique: async () => null }, customer: { findFirst: async () => null },
      $transaction: async () => { throw new Error("Must not commit account"); },
    } },
    "@/lib/session": { ...session, ensureSessionConfigured: () => { throw new Error("Missing secret"); } },
  });
  const response = await POST(new Request("http://localhost/api/auth/register", { method: "POST", body: JSON.stringify({
    fullName: "Test", email: "test@example.test", phone: "0901234567", password: "secret123", confirmPassword: "secret123", agreeTerms: true,
  }) }));
  assert.equal(response.status, 500);
  assert.equal(response.headers.get("set-cookie"), null);
});

test("admin stats API returns HTTP auth errors rather than a page redirect", async () => {
  const { GET } = load("app/api/admin/stats/route.ts", {
    "@/lib/session": { getCurrentUser: async () => null },
    "@/services/dashboardService": { getDashboardStats: async () => { throw new Error("Must not read private stats"); } },
  });
  const response = await GET(new Request("http://localhost/api/admin/stats"));
  assert.equal(response.status, 401);
});
