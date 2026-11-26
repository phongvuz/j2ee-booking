const { test } = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./load-ts.cjs");



process.env.SESSION_SECRET = "test-secret-".repeat(4);
const password = load("lib/password.ts");
const session = load("lib/session.ts", { "@/lib/prisma": { prisma: {} } });

test("password verification rejects incorrect passwords and malformed/legacy hashes", async () => {
  const hash = await password.hashPassword("secret123");
  assert.equal(await password.verifyPassword("secret123", hash), true);
  assert.equal(await password.verifyPassword("incorrect", hash), false);
  for (const value of ["secret123", "scrypt:bad:bad", ""]) assert.equal(await password.verifyPassword("secret123", value), false);
});

test("session signatures reject tampering, expiry and invalid identifiers", () => {
  const token = session.createSessionToken(7, "stored-hash", 1000);
  assert.equal(session.verifySessionToken(token, 1001), 7);
  assert.equal(session.verifySessionToken(token.replace(/^7/, "8"), 1001), null);
  assert.equal(session.verifySessionToken(token, 1000 + session.SESSION_AGE * 1000), null);
  assert.equal(session.verifySessionToken("bad"), null);
});

async function setup({ role = "CUSTOMER", status = "Đang hoạt động", missingCustomer = false, missingUser = false, fail = false, legacy = false } = {}) {
  let hash = legacy ? "secret123" : await password.hashPassword("secret123");
  const lookups = [];
  const prisma = {
    customer: { findUnique: async ({where}) => { lookups.push(where); if (fail) throw new Error("private database error"); return missingCustomer ? null : { phone: "0901234567", status }; } },
    user: {
      findUnique: async ({where}) => { assert.deepEqual(where, { phone: "0901234567" }); return missingUser ? null : { id: 7, role, password: hash }; },
      updateMany: async ({where, data}) => {
        assert.deepEqual(where, { id: 7, password: hash, role: "ADMIN" });
        assert.equal(await password.verifyPassword("secret123", data.password), true);
        hash = data.password;
        return { count: 1 };
      },
    },
  };
  const { POST } = load("app/api/auth/login/route.ts", { "@/lib/prisma": { prisma }, "@/lib/password": password, "@/lib/session": session });
  return { lookups, post: (body = { identifier: "0901234567", password: "secret123" }) => POST(new Request("http://localhost/api/auth/login", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) })) };
}

test("login by phone and normalized email creates an HttpOnly session without exposing credentials", async () => {
  const { post, lookups } = await setup();
  for (const identifier of ["0901234567", " TEST@Example.com "]) {
    const response = await post({ identifier, password: "secret123", role: "ADMIN" });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("set-cookie"), /HttpOnly/i);
    assert.match(response.headers.get("set-cookie"), /SameSite=lax/i);
    assert.deepEqual(await response.json(), { success: true, redirectTo: "/" });
  }
  assert.deepEqual(lookups, [{ phone: "0901234567" }, { email: "test@example.com" }]);
});

test("rejects wrong role, inactive or missing customer/user and wrong password without setting a cookie", async () => {
  for (const options of [{role: "USER"}, {status: "Ngừng hoạt động"}, {status: ""}, {missingCustomer: true}, {missingUser: true}, {}]) {
    const { post } = await setup(options);
    const response = await post({ identifier: "0901234567", password: Object.keys(options).length ? "secret123" : "wrong" });
    assert.equal(response.status, 401);
    assert.equal(response.headers.get("set-cookie"), null);
  }
});

test("rejects malformed input and hides database failures", async () => {
  const { post } = await setup();
  for (const body of ["{", {}, {identifier: 123, password: "abc"}, {identifier: "a", password: "x".repeat(129)}]) assert.equal((await post(body)).status, 400);
  const response = await (await setup({fail: true})).post();
  assert.equal(response.status, 500);
  assert.equal((await response.text()).includes("private"), false);
});

test("logout expires the session cookie", async () => {
  const { POST } = load("app/api/auth/logout/route.ts", { "@/lib/session": session });
  const response = await POST(new Request("http://localhost/api/auth/logout", { method: "POST" }));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("set-cookie"), /Max-Age=0/i);
});

test("admin logs in without a customer and upgrades legacy password for subsequent logins", async () => {
  for (const legacy of [true, false]) {
    const { post } = await setup({ role: "ADMIN", missingCustomer: true, legacy });
    const wrong = await post({ identifier: "0901234567", password: "wrong" });
    assert.equal(wrong.status, 401);
    assert.equal(wrong.headers.get("set-cookie"), null);
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await post();
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { success: true, redirectTo: "/admin" });
      assert.match(response.headers.get("set-cookie"), /HttpOnly/i);
    }
  }
  const customer = await setup({ legacy: true });
  assert.equal((await customer.post()).status, 401);
});

test("admin and customer forms reject accounts for the other audience without setting cookies", async () => {
  for (const [role, audience, status] of [["CUSTOMER", "admin", 401], ["ADMIN", "customer", 401], ["CUSTOMER", "customer", 200], ["ADMIN", "admin", 200]]) {
    const { post } = await setup({ role });
    const response = await post({ identifier: "0901234567", password: "secret123", audience });
    assert.equal(response.status, status);
    if (status === 401) assert.equal(response.headers.get("set-cookie"), null);
    else assert.match(response.headers.get("set-cookie"), /HttpOnly/i);
  }
});

test("admin session rechecks role and rejects missing, expired or tampered cookies", async () => {
  for (const [role, token, allowed] of [
    ["ADMIN", session.createSessionToken(7, "stored-hash"), true],
    ["CUSTOMER", session.createSessionToken(7, "stored-hash"), false],
    ["USER", session.createSessionToken(7, "stored-hash"), false],
    ["ADMIN", undefined, false],
    ["ADMIN", session.createSessionToken(7, "stored-hash", 0), false],
    ["ADMIN", session.createSessionToken(7, "stored-hash").replace(/^7/, "8"), false],
  ]) {
    const current = load("lib/session.ts", {
      "next/headers": { cookies: async () => ({ get: () => token ? { value: token } : undefined }) },
      "@/lib/prisma": { prisma: { user: { findUnique: async () => ({ id: 7, role, password: "stored-hash", isActive: true }) } } },
    });
    assert.equal(Boolean(await current.getCurrentAdmin()), allowed);
  }
});

test("session use rechecks current role and customer status", async () => {
  for (const [role, status, allowed] of [["CUSTOMER", "Đang hoạt động", true], ["ADMIN", "Đang hoạt động", false], ["CUSTOMER", "Ngừng hoạt động", false]]) {
    const current = load("lib/session.ts", {
      "next/headers": { cookies: async () => ({ get: () => ({ value: session.createSessionToken(7, "stored-hash") }) }) },
      "@/lib/prisma": { prisma: {
        user: { findUnique: async () => ({id: 7, phone: "0901234567", role, password: "stored-hash", isActive: true}) },
        customer: { findUnique: async () => ({id: "CUS-001", name: "Test", status}) },
      } },
    });
    assert.equal(Boolean(await current.getCurrentCustomer()), allowed);
  }
});
