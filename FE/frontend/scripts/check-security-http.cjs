const assert = require("node:assert/strict");
const { load } = require("../tests/load-ts.cjs");
const { securityHeaders } = load("lib/security-headers.ts");

// Read-only checks. None of these requests sends a session, creates an account,
// writes application data, or needs a database fixture.
async function main() {
  const base = new URL(process.argv[2] || process.env.SECURITY_CHECK_BASE_URL || "http://127.0.0.1:3000");
  if (!["http:", "https:"].includes(base.protocol) || base.username || base.password || base.pathname !== "/" || base.search || base.hash) {
    throw new Error("Use an HTTP(S) origin without credentials, path, query or fragment.");
  }
  const checks = [
    { name: "same-origin OpenAPI read", path: "/api/openapi", method: "GET", headers: { origin: base.origin }, status: 200, openapi: true },
    { name: "public cross-origin read grants no CORS access", path: "/api/openapi", method: "GET", headers: { origin: "https://untrusted.example" }, status: 200, openapi: true },
    { name: "untrusted preflight rejected", path: "/api/bookings", method: "OPTIONS", headers: { origin: "https://untrusted.example", "access-control-request-method": "POST" }, status: 403 },
    { name: "untrusted login mutation rejected", path: "/api/auth/login", method: "POST", headers: { origin: "https://untrusted.example" }, status: 403 },
    { name: "sibling-site mutation without Origin rejected", path: "/api/auth/login", method: "POST", headers: { "sec-fetch-site": "same-site" }, status: 403 },
    { name: "opaque-origin mutation rejected", path: "/api/auth/login", method: "POST", headers: { origin: "null" }, status: 403 },
    { name: "same-origin preflight reaches route", path: "/api/openapi", method: "OPTIONS", headers: { origin: base.origin, "access-control-request-method": "GET" }, status: 204 },
    { name: "missing-Origin nonbrowser read remains available", path: "/api/openapi", method: "GET", headers: {}, status: 200, openapi: true },
  ];
  const results = [];
  for (const check of checks) {
    try {
      const response = await fetch(new URL(check.path, base), {
        method: check.method, headers: check.headers, redirect: "manual", signal: AbortSignal.timeout(20_000),
      });
      assert.equal(response.status, check.status, "Unexpected HTTP status");
      for (const { key, value } of securityHeaders) assert.equal(response.headers.get(key), value, key);
      assert.equal(response.headers.get("access-control-allow-origin"), null);
      assert.equal(response.headers.get("access-control-allow-credentials"), null);
      assert.equal(response.headers.get("set-cookie"), null);
      if (check.openapi) {
        assert.match(response.headers.get("content-type"), /^application\/json/);
        assert.match((await response.json()).openapi, /^3\./);
      } else if (check.status === 403) {
        assert.equal(response.headers.get("cache-control"), "no-store");
        assert.equal((await response.json()).success, false);
      } else {
        await response.arrayBuffer();
      }
      results.push({ name: check.name, status: response.status, passed: true });
    } catch (error) {
      results.push({ name: check.name, passed: false, error: error.message });
    }
  }
  const passed = results.filter((result) => result.passed).length;
  process.stdout.write(JSON.stringify({
    recordedAt: new Date().toISOString(), baseOrigin: base.origin, node: process.version,
    scope: "Read-only HTTP header, origin and preflight checks; no security certification or database write coverage.",
    total: results.length, passed, failed: results.length - passed, results,
  }, null, 2) + "\n");
  if (passed !== results.length) process.exitCode = 1;
}

main().catch((error) => { process.stderr.write(error.message + "\n"); process.exitCode = 1; });
