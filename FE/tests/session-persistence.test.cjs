const { test } = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./load-ts.cjs");

process.env.SESSION_SECRET = "session-persistence-test-secret-".repeat(2);

async function setup() {
  const { hashPassword } = load("lib/password.ts");
  const password = await hashPassword("session-test-123");
  const accounts = [
    { id: 1, fullName: "Admin", phone: "0900000001", role: "ADMIN", isActive: true, password },
    { id: 2, fullName: "Customer", phone: "0900000002", role: "CUSTOMER", isActive: true, password },
  ];
  const jar = new Map();
  let unavailable = false;
  const prisma = {
    user: { findUnique: async ({ where }) => {
      if (unavailable) throw new Error("Temporary database outage");
      return accounts.find(account => where.id ? account.id === where.id : account.phone === where.phone) ?? null;
    } },
    customer: { findUnique: async ({ where }) => where.phone === accounts[1].phone
      ? { id: "CUS-002", phone: accounts[1].phone, name: "Customer", status: "Đang hoạt động" } : null },
  };
  const session = load("lib/session.ts", {
    "next/headers": { cookies: async () => ({ get: name => jar.has(name) ? { value: jar.get(name) } : undefined }) },
    "@/lib/prisma": { prisma },
  });
  const mocks = { "@/lib/session": session, "@/lib/prisma": { prisma } };
  const login = load("app/api/auth/login/route.ts", mocks);
  const logout = load("app/api/auth/logout/route.ts", mocks);
  const status = load("app/api/auth/session/route.ts", mocks);
  const guard = load("lib/admin-api.ts", mocks);
  function apply(response) {
    for (const cookie of response.cookies.getAll()) {
      if (cookie.maxAge === 0) jar.delete(cookie.name);
      else jar.set(cookie.name, cookie.value);
    }
  }
  async function signIn(audience) {
    const response = await login.POST(new Request("http://localhost/api/auth/login", {
      method: "POST", body: JSON.stringify({
        identifier: audience === "admin" ? accounts[0].phone : accounts[1].phone,
        password: "session-test-123", audience,
      }),
    }));
    assert.equal(response.status, 200);
    apply(response);
    return response;
  }
  async function signOut(audience) {
    const response = await logout.POST(new Request(`http://localhost/api/auth/logout?audience=${audience}`, {
      method: "POST",
    }));
    assert.equal(response.status, 200);
    apply(response);
  }
  return { jar, session, status, guard, logout, apply, signIn, signOut, setUnavailable: value => { unavailable = value; } };
}

test("admin and customer logins in the same browser keep both sessions across navigation", async () => {
  const fixture = await setup();
  const admin = await fixture.signIn("admin");
  const customer = await fixture.signIn("customer");
  assert.notEqual(admin.cookies.getAll()[0].name, customer.cookies.getAll()[0].name);
  assert.equal((await fixture.session.getCurrentAdmin()).id, 1);
  assert.equal((await fixture.session.getCurrentCustomer()).userId, 2);
  assert.equal((await fixture.guard.requireAdmin(new Request("http://localhost/api/admin/stats"))).id, 1);
  await fixture.signIn("admin");
  assert.equal((await fixture.session.getCurrentCustomer()).userId, 2);
});

test("a delayed anonymous session check cannot erase a newer login", async () => {
  const fixture = await setup();
  const staleResponse = await fixture.status.GET();
  await fixture.signIn("customer");
  fixture.apply(staleResponse);
  assert.equal(staleResponse.headers.get("set-cookie"), null);
  assert.equal((await fixture.session.getCurrentCustomer()).userId, 2);
});

test("logout affects only the selected audience in a shared browser", async () => {
  for (const audience of ["admin", "customer"]) {
    const fixture = await setup();
    await fixture.signIn("admin");
    await fixture.signIn("customer");
    await fixture.signOut(audience);
    assert.equal(Boolean(await fixture.session.getCurrentAdmin()), audience !== "admin");
    assert.equal(Boolean(await fixture.session.getCurrentCustomer()), audience !== "customer");
  }
});

test("sessions last the full 24 hours, including idle time, and then expire", async context => {
  const fixture = await setup();
  const started = Date.now();
  let now = started;
  context.mock.method(Date, "now", () => now);
  const admin = await fixture.signIn("admin");
  const customer = await fixture.signIn("customer");
  for (const response of [admin, customer]) assert.equal(response.cookies.getAll()[0].maxAge, 86400);
  for (const elapsed of [60_000, 30 * 60_000, 86_399_000]) {
    now = started + elapsed;
    assert.equal((await fixture.session.getCurrentAdmin()).id, 1);
    assert.equal((await fixture.session.getCurrentCustomer()).userId, 2);
  }
  now = started + 86_400_000;
  assert.equal(await fixture.session.getCurrentAdmin(), null);
  assert.equal(await fixture.session.getCurrentCustomer(), null);
});

test("temporary database errors preserve cookies and sessions recover on the next request", async () => {
  const fixture = await setup();
  await fixture.signIn("customer");
  const before = [...fixture.jar];
  fixture.setUnavailable(true);
  const response = await fixture.status.GET();
  assert.equal(response.status, 500);
  assert.equal(response.headers.get("set-cookie"), null);
  fixture.apply(response);
  assert.deepEqual([...fixture.jar], before);
  fixture.setUnavailable(false);
  assert.equal((await fixture.session.getCurrentCustomer()).userId, 2);
});

test("invalid or wrongly scoped cookies cannot hide a valid session or change its role", async () => {
  const fixture = await setup();
  await fixture.signIn("admin");
  const adminToken = fixture.jar.get(fixture.session.ADMIN_SESSION_COOKIE);
  fixture.jar.set(fixture.session.SESSION_COOKIE, adminToken);
  fixture.jar.delete(fixture.session.ADMIN_SESSION_COOKIE);
  assert.equal(await fixture.session.getCurrentAdmin(), null);
  await fixture.signIn("customer");
  fixture.jar.set(fixture.session.ADMIN_SESSION_COOKIE, "invalid-token");
  assert.equal((await fixture.session.getCurrentCustomer()).userId, 2);
  assert.equal(await fixture.session.getCurrentAdmin(), null);
  const before = [...fixture.jar];
  const response = await fixture.logout.POST(new Request("http://localhost/api/auth/logout?audience=invalid", { method: "POST" }));
  assert.equal(response.status, 400);
  assert.equal(response.headers.get("set-cookie"), null);
  assert.deepEqual([...fixture.jar], before);
});

test("demo authentication cookies cannot replace application authentication cookies", () => {
  const previous = process.env.SGU_DEMO;
  try {
    delete process.env.SGU_DEMO;
    const application = load("lib/session.ts", { "@/lib/prisma": { prisma: {} } });
    process.env.SGU_DEMO = "true";
    const demo = load("lib/session.ts", { "@/lib/prisma": { prisma: {} } });
    assert.notEqual(demo.SESSION_COOKIE, application.SESSION_COOKIE);
    assert.notEqual(demo.ADMIN_SESSION_COOKIE, application.ADMIN_SESSION_COOKIE);
  } finally {
    if (previous === undefined) delete process.env.SGU_DEMO;
    else process.env.SGU_DEMO = previous;
  }
});
