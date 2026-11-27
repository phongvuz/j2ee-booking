const { test } = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./load-ts.cjs");
const { ApiError, buildQuery, requestJson } = load("lib/api-client.ts");

test("query keeps zero and escapes search text while omitting empty filters", () => {
  const query = new URLSearchParams(buildQuery({ page: 0, search: "A&B", role: "", missing: undefined, absent: null }));
  assert.deepEqual(Object.fromEntries(query), { page: "0", search: "A&B" });
});

test("requests preserve headers and cancellation while returning successful data", async (t) => {
  const controller = new AbortController();
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, "/api/example");
    assert.equal(options.cache, "no-store");
    assert.equal(options.signal, controller.signal);
    assert.equal(options.headers.get("x-example"), "value");
    assert.equal(options.headers.get("content-type"), "application/json");
    assert.equal(options.body, '{"name":"Test"}');
    return Response.json({ success: true, data: { id: 7 } });
  });
  assert.deepEqual(await requestJson("/api/example", {
    method: "POST", body: '{"name":"Test"}', signal: controller.signal,
    headers: new Headers({ "x-example": "value" }),
  }), { success: true, data: { id: 7 } });
});

test("HTTP and application failures retain useful messages and validation errors", async (t) => {
  for (const status of [200, 409]) {
    t.mock.method(globalThis, "fetch", async () => Response.json({
      success: false, message: "Duplicate record", errors: [{ path: ["phone"] }],
    }, { status }));
    await assert.rejects(requestJson("/api/example"), (error) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.status, status);
      assert.equal(error.message, "Duplicate record");
      assert.deepEqual(error.errors, [{ path: ["phone"] }]);
      return true;
    });
    t.mock.restoreAll();
  }
});

test("non-JSON and network failures reject instead of becoming empty successful results", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response("<html>Gateway failure</html>", { status: 502 }));
  await assert.rejects(requestJson("/api/example"), (error) => error instanceof ApiError && error.status === 502);
  t.mock.restoreAll();
  t.mock.method(globalThis, "fetch", async () => { throw new TypeError("Failed to fetch"); });
  await assert.rejects(requestJson("/api/example"), /Failed to fetch/);
});

test("an aborted request preserves AbortError for callers to ignore cancelled responses", async (t) => {
  const controller = new AbortController();
  controller.abort();
  t.mock.method(globalThis, "fetch", async (_url, { signal }) => { signal.throwIfAborted(); });
  await assert.rejects(requestJson("/api/example", { signal: controller.signal }), { name: "AbortError" });
});
