const { test } = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { NextRequest } = require("next/server");
const { load } = require("./load-ts.cjs");

const { proxy } = load("proxy.ts");
const origin = "https://booking.example.test";

test("API proxy denies hostile-origin preflights and every mutation method without granting CORS", async () => {
  for (const method of ["OPTIONS", "POST", "PUT", "PATCH", "DELETE"]) {
    for (const headers of [
      { origin: "https://evil.example", "access-control-request-method": "POST" },
      { origin: "null" },
      { "sec-fetch-site": "cross-site" },
      { "sec-fetch-site": "same-site" },
    ]) {
      const response = proxy(new NextRequest(`${origin}/api/bookings`, { method, headers }));
      assert.equal(response.status, 403, `${method} ${JSON.stringify(headers)}`);
      assert.equal(response.headers.get("access-control-allow-origin"), null);
      assert.equal(response.headers.get("access-control-allow-credentials"), null);
      assert.equal(response.headers.get("set-cookie"), null);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.match(response.headers.get("content-type"), /^application\/json/);
      assert.equal((await response.json()).success, false);
    }
  }
});

test("API proxy preserves same-origin operations, public/SSE reads and intentional nonbrowser clients", () => {
  for (const method of ["GET", "HEAD", "OPTIONS", "POST", "PUT", "PATCH", "DELETE"]) {
    for (const headers of [{ origin, "sec-fetch-site": "same-origin" }, {}]) {
      const response = proxy(new NextRequest(`${origin}/api/trips/1/stream`, { method, headers }));
      assert.equal(response.headers.get("x-middleware-next"), "1", method);
      assert.equal(response.headers.get("access-control-allow-origin"), null);
    }
  }
  const publicRead = proxy(new NextRequest(`${origin}/api/trips`, { headers: { origin: "https://evil.example" } }));
  assert.equal(publicRead.headers.get("x-middleware-next"), "1");
  assert.equal(publicRead.headers.get("access-control-allow-origin"), null);
});

test("baseline security headers restrict framing and active embeds without pretending to enforce script nonces", () => {
  const { securityHeaders } = load("lib/security-headers.ts");
  const headers = new Headers(securityHeaders.map(({ key, value }) => [key, value]));
  assert.equal(headers.get("x-content-type-options"), "nosniff");
  assert.equal(headers.get("x-frame-options"), "DENY");
  assert.equal(headers.get("referrer-policy"), "strict-origin-when-cross-origin");
  const csp = headers.get("content-security-policy");
  for (const directive of ["base-uri 'self'", "object-src 'none'", "frame-ancestors 'none'", "form-action 'self'"]) {
    assert.ok(csp.split("; ").includes(directive), directive);
  }
  assert.equal(headers.get("access-control-allow-origin"), null);
});

test("customer greeting renders stored script markup as text", async () => {
  const payload = '<img src=x onerror="alert(1)"><script>alert(2)</script>';
  const { default: CustomerMenu } = load("components/auth/CustomerMenu.tsx", {
    "@/lib/session": { getCurrentCustomer: async () => ({ name: payload }), getCurrentAdmin: async () => null },
    "./CustomerDropdown": { default: () => null },
    "./AuthLink": { default: () => null },
    "./LogoutButton": { default: () => null },
  });
  const html = renderToStaticMarkup(await CustomerMenu());
  assert.ok(html.includes("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"));
  assert.ok(html.includes("&lt;script&gt;alert(2)&lt;/script&gt;"));
  assert.doesNotMatch(html, /<img\b|<script\b/i);
});

test("ticket details escape hostile passenger and route data in their real UI component", () => {
  const payload = '<svg onload="alert(1)">';
  const { OrderDetailModal } = load("components/admin/orders/OrderDetailModal.tsx");
  const order = {
    pnr: payload, seatNumber: "A01", status: "PENDING", totalPrice: 100000,
    received: 0, refunded: 0, refundDue: 0, amountDue: 100000, transactions: [],
    createdAt: "2026-11-06T00:00:00Z", user: { fullName: payload, phone: "0901234567" },
    trip: { id: 1, from: payload, to: payload, time: "2026-12-01T00:00:00Z" },
  };
  const html = renderToStaticMarkup(React.createElement(OrderDetailModal, { isOpen: true, order, onClose() {} }));
  assert.ok(html.includes("&lt;svg onload=&quot;alert(1)&quot;&gt;"));
  assert.doesNotMatch(html, /<svg\s+onload/i);
});

test("search injection payload remains Prisma filter data and cannot choose an arbitrary sort field", async () => {
  const payload = "' OR 1=1; DROP TABLE user; --";
  let query;
  const prisma = { user: {
    count: async () => 0, groupBy: async () => [],
    findMany: async (args) => { query = args; return []; },
  } };
  const { queryUsers } = load("services/userService.ts", { "@/lib/prisma": { prisma } });
  await queryUsers({ search: payload, sortBy: payload, sortOrder: "asc" });
  assert.deepEqual(query.where.OR, [
    { fullName: { contains: payload } }, { phone: { contains: payload } },
    { booking: { some: { passengerPhone: { contains: payload } } } },
  ]);
  assert.deepEqual(query.orderBy, [{ id: "desc" }, { id: "desc" }]);
});

test("unexpected internal errors produce a generic JSON response without exposing error details", async () => {
  const { apiError } = load("lib/admin-api.ts", { "@/lib/session": { getCurrentUser: async () => null } });
  const internal = new Error("private connection details used only in this fixture");
  const original = console.error;
  let response;
  try {
    console.error = () => {};
    response = apiError(internal, "Không thể xử lý yêu cầu.");
  } finally {
    console.error = original;
  }
  assert.equal(response.status, 500);
  assert.match(response.headers.get("content-type"), /^application\/json/);
  assert.deepEqual(await response.json(), { success: false, message: "Không thể xử lý yêu cầu." });
});
