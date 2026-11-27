const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { discoverRoutes, validateCoverage, buildSchemas, createSpecification, generate, checkArtifacts } = require("../scripts/generate-api-docs.cjs");
const { metadata } = require("../scripts/api-docs-metadata.cjs");
const ROOT = path.resolve(__dirname, "..");

test("API reference covers every real exported handler and rejects undocumented or stale metadata", () => {
  const routes = discoverRoutes();
  assert.ok(routes.length > 40);
  assert.doesNotThrow(() => validateCoverage(routes));
  assert.throws(() => validateCoverage([...routes, { key: "POST /api/new", queries: [] }]), /Missing metadata: POST \/api\/new/);
  assert.throws(() => validateCoverage(routes.slice(1)), /Stale metadata:/);
  const changedQueries = routes.map((route, index) => index === 0 ? { ...route, queries: ["undocumented"] } : route);
  assert.throws(() => validateCoverage(changedQueries), /Query metadata differs/);
  const missingRequest = { ...metadata, "POST /api/bookings": { ...metadata["POST /api/bookings"], request: undefined } };
  assert.throws(() => validateCoverage(routes, missingRequest), /Missing request schema: POST \/api\/bookings/);
});

test("route discovery uses AST and ignores commented-out handlers", () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "sgu-api-docs-"));
  try {
    const routeDirectory = path.join(temporary, "app/api/example/[id]");
    fs.mkdirSync(routeDirectory, { recursive: true });
    fs.writeFileSync(path.join(routeDirectory, "route.ts"), '// export function DELETE() {}\nexport async function GET(request: Request) { const { searchParams } = new URL(request.url); searchParams.get("q"); return Response.json({}); }\n');
    const routes = discoverRoutes(temporary);
    assert.deepEqual(routes.map(({ key, queries }) => ({ key, queries })), [{ key: "GET /api/example/{id}", queries: ["q"] }]);
  } finally {
    // Verified local test fixture under the system temp directory; no workspace data.
    const resolved = path.resolve(temporary);
    assert.ok(resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(resolved).startsWith("sgu-api-docs-"));
    fs.rmSync(resolved, { recursive: true, force: true });
  }
});

test("booking examples validate with actual Zod schemas and require the seats array", () => {
  const { schemas, validators } = buildSchemas();
  const example = metadata["POST /api/bookings"].example;
  assert.equal(validators.OnlineBookingInput.safeParse(example).success, true);
  assert.equal(validators.OnlineBookingInput.safeParse({ tripId: 1, seatNumber: "A01", fullName: "Nguyễn Văn An", phone: "0901234567" }).success, false);
  assert.ok(schemas.OnlineBookingInput.required.includes("seats"));
  assert.equal(schemas.OnlineBookingInput.properties.seats.type, "array");
  assert.equal(schemas.OnlineBookingInput.properties.seats.maxItems, 5);
  assert.equal(schemas.OnlineBookingInput.properties.tripId.type, "integer");
  assert.equal(schemas.OnlineBookingInput.properties.status, undefined);
  assert.equal(validators.LoginInput.safeParse(metadata["POST /api/auth/login"].example).success, true);
  assert.equal(validators.RegisterInput.safeParse(metadata["POST /api/auth/register"].example).success, true);
  assert.equal(validators.SeatHoldInput.safeParse(metadata["POST /api/seats/hold"].example).success, true);
});

test("OpenAPI preserves role protection, optional admin mode, SSE framing and unresolved response data", () => {
  const { schemas } = buildSchemas();
  const spec = createSpecification(discoverRoutes(), schemas);
  assert.equal(spec.openapi, "3.1.1");
  assert.equal(spec.components.securitySchemes.SessionCookie.name, "customer_session");
  assert.equal(spec.components.securitySchemes.AdminSessionCookie.name, "admin_session");
  assert.deepEqual(spec.paths["/api/users"].get.security, [{ AdminSessionCookie: [] }]);
  assert.equal(spec.paths["/api/users"].get["x-required-role"], "ADMIN");
  assert.equal(spec.paths["/api/customer/profile"].patch["x-required-role"], "CUSTOMER");
  assert.deepEqual(spec.paths["/api/trips"].get.security, [{}, { AdminSessionCookie: [] }]);
  assert.deepEqual(spec.paths["/api/trips/{id}/seat-events"].post.security, [{ SeatSessionCookie: [] }]);
  assert.deepEqual(spec.paths["/api/bookings"].post.security, []);
  assert.equal(spec.paths["/api/bookings"].post.responses[201].content["application/json"].schema.$ref, "#/components/schemas/BookingCreated");
  const stream = spec.paths["/api/trips/{id}/stream"].get.responses[200].content["text/event-stream"];
  assert.equal(stream.schema.type, "string");
  assert.equal(stream["x-event-schema"].$ref, "#/components/schemas/SeatRealtimeMessage");
  assert.equal(schemas.DataResult.properties.data.type, undefined);
  assert.match(schemas.DataResult.properties.data.description, /không được suy đoán/);
  assert.equal(schemas.CustomerUpdateInput.anyOf.length, 2);
});

test("generated artifacts are deterministic and checked-in versions match current source", () => {
  const first = generate();
  assert.deepEqual(generate(), first);
  for (const [relative, expected] of Object.entries(first)) {
    const actual = fs.readFileSync(path.join(ROOT, relative), "utf8").replaceAll("\r\n", "\n");
    assert.equal(actual, expected, `${relative} stale; run node scripts/generate-api-docs.cjs`);
  }
});

test("check mode rejects missing or changed artifacts and accepts normalized line endings", () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "sgu-api-docs-"));
  try {
    const expected = { "openapi.json": "{\n}\n" };
    assert.throws(() => checkArtifacts(expected, temporary), /API documentation is stale: openapi.json/);
    fs.writeFileSync(path.join(temporary, "openapi.json"), "old");
    assert.throws(() => checkArtifacts(expected, temporary), /API documentation is stale/);
    fs.writeFileSync(path.join(temporary, "openapi.json"), "{\r\n}\r\n");
    assert.doesNotThrow(() => checkArtifacts(expected, temporary));
  } finally {
    const resolved = path.resolve(temporary);
    assert.ok(resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(resolved).startsWith("sgu-api-docs-"));
    fs.rmSync(resolved, { recursive: true, force: true });
  }
});

test("documentation UI escapes API metadata and search input without executable HTML", async () => {
  const { renderToStaticMarkup } = require("react-dom/server");
  const { load } = require("./load-ts.cjs");
  const spec = JSON.parse(fs.readFileSync(path.join(ROOT, "documentation/api/openapi.json"), "utf8"));
  spec.paths["/api/openapi"].get.summary = '<script>alert("metadata")</script>';
  const Page = load("app/api-docs/page.tsx", { "@/documentation/api/openapi.json": { default: spec } }).default;
  const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ q: '<script>alert("metadata")</script>' }) }));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(!html.includes('<script>alert("metadata")</script>'));
  assert.ok(!html.includes("<iframe"));
});
