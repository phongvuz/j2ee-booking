// Explicit MySQL + real Next.js HTTP experiment; never part of the mock unit suite.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const { createHash, randomBytes } = require("node:crypto");
const { performance } = require("node:perf_hooks");
const { unusedPort, waitUntil } = require("./browser-cdp.cjs");
const { parseArguments, createConfiguration, ensureGeneratedClient, provisionDemo } = require("../scripts/demo.cjs");

const root = path.resolve(__dirname, "..");
const evidenceRoot = path.join(root, "documentation/evidence/booking-concurrency");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const json = (value) => JSON.stringify(value, (_, item) => typeof item === "bigint" ? item.toString() : item, 2);
const relative = (filename) => path.relative(root, filename).replaceAll(path.sep, "/");

function git(...args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8", windowsHide: true });
  assert.equal(result.status, 0, "Cannot record source revision.");
  return result.stdout.trim();
}

function sourceManifest() {
  const files = [
    "package.json", "package-lock.json", "next.config.ts", "proxy.ts", "instrumentation.ts",
    "prisma/schema.prisma", "app/api/bookings/route.ts", "services/bookingService.ts",
    "lib/transaction.ts", "lib/admin-api.ts", "lib/guest-account.ts", "lib/password.ts",
    "lib/session.ts", "lib/seat-session.ts", "lib/seats.ts", "lib/trip-id.ts", "lib/business-error.ts",
    "lib/request-origin.ts", "lib/validations/order.ts", "lib/validations/seat-realtime.ts",
    "lib/booking-expiry-worker.ts", "services/bookingExpiryService.ts",
    "scripts/demo.cjs", "tests/browser-cdp.cjs", "tests/booking-concurrency-http.cjs",
  ];
  return {
    commit: git("rev-parse", "HEAD"),
    workingTree: git("status", "--short"),
    sha256: Object.fromEntries(files.map((file) => [file, hash(fs.readFileSync(path.join(root, file)))])),
  };
}

function sanitize(text, configuration) {
  for (const value of [process.env.DATABASE_URL, process.env.DEMO_SERVER_URL,
    process.env.SESSION_SECRET, configuration?.targetUrl, configuration?.controlUrl,
    configuration?.childEnvironment.SESSION_SECRET]) {
    if (value) text = text.replaceAll(value, "[redacted]");
  }
  return text.replace(/mysql:\/\/[^\s"'<>]+/gi, "[redacted-mysql-url]");
}

async function stopServer(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === "win32") {
    const result = spawnSync("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], {
      windowsHide: true, encoding: "utf8",
    });
    if (result.status !== 0 && child.exitCode === null) child.kill();
  } else {
    try { process.kill(-child.pid, "SIGTERM"); } catch { child.kill(); }
  }
  await waitUntil(() => child.exitCode !== null || child.signalCode !== null, "Test server did not stop", 5000);
}

async function databaseSnapshot(prisma, tripId) {
  const [trip, bookings, userCount, holdCount] = await prisma.$transaction([
    prisma.trip.findUniqueOrThrow({ where: { id: tripId }, select: {
      id: true, busId: true, bus: { select: { id: true, capacity: true } }, availableSeats: true, price: true, time: true,
    } }),
    prisma.booking.findMany({ where: { tripId }, orderBy: { id: "asc" }, select: {
      id: true, pnr: true, tripId: true, seatNumber: true, status: true, activeSeat: true,
      passengerName: true, passengerPhone: true, userId: true, totalPrice: true,
      createdAt: true, expiresAt: true,
    } }),
    prisma.user.count(),
    prisma.seatHold.count({ where: { tripId } }),
  ]);
  return { observedAt: new Date().toISOString(), trip: { ...trip, capacity: trip.bus.capacity }, bookings, userCount, holdCount };
}

async function postBooking(baseUrl, payload, label) {
  const startedAt = new Date().toISOString();
  const startMs = performance.now();
  const response = await fetch(`${baseUrl}/api/bookings`, {
    method: "POST", headers: { "Content-Type": "application/json", Origin: baseUrl },
    body: JSON.stringify(payload), signal: AbortSignal.timeout(45000),
  });
  const body = await response.json();
  const endMs = performance.now();
  return {
    label, method: "POST", path: "/api/bookings", payload, startedAt,
    finishedAt: new Date().toISOString(), startMs, endMs,
    durationMs: Number((endMs - startMs).toFixed(3)), status: response.status, body,
  };
}

async function createTrip(prisma, name) {
  const trip = await prisma.trip.create({ data: {
    from: `Concurrency ${name}`, to: "Isolated test destination",
    time: new Date(Date.now() + 86400000), price: 100000, busId: "BUS-DEMO-001", availableSeats: 22,
  }, include: { bus: true } });
  return { ...trip, capacity: trip.bus.capacity };
}

function passenger(tripId, seats, index, side) {
  return { tripId, seats, fullName: `Concurrent passenger ${index} ${side}`,
    phone: `090${String(index * 2 + (side === "A" ? 0 : 1)).padStart(7, "0")}` };
}

async function runPair(prisma, baseUrl, index, seatsA, seatsB) {
  const trip = await createTrip(prisma, String(index));
  const before = await databaseSnapshot(prisma, trip.id);
  assert.equal(before.bookings.length, 0);
  assert.equal(before.holdCount, 0);
  assert.equal(before.trip.availableSeats, before.trip.capacity);
  const payloads = [passenger(trip.id, seatsA, index, "A"), passenger(trip.id, seatsB, index, "B")];
  assert.notEqual(payloads[0].phone, payloads[1].phone);

  // Release both clients from the same barrier; no API/service/database mocks.
  let release;
  const barrier = new Promise((resolve) => { release = resolve; });
  const pending = payloads.map((payload, side) => barrier.then(() => postBooking(baseUrl, payload, side === 0 ? "A" : "B")));
  release();
  const settled = await Promise.allSettled(pending);
  const requests = settled.map((result, side) => result.status === "fulfilled" ? result.value : {
    label: side === 0 ? "A" : "B", payload: payloads[side], transportError: sanitize(result.reason.message),
  });
  const after = await databaseSnapshot(prisma, trip.id);
  const overlapMs = Math.min(...requests.map((request) => request.endMs)) - Math.max(...requests.map((request) => request.startMs));
  const record = { index, kind: seatsA.length === 1 ? "same-seat" : "overlapping-multiple-seats",
    before, requests, overlapMs: Number(overlapMs.toFixed(3)), after };

  // Keep the raw observations even when an assertion fails.
  const checks = () => {
    assert.ok(overlapMs > 0, "The two HTTP request intervals must overlap.");
    assert.deepEqual(requests.map((request) => request.status).sort(), [201, 409]);
    const winner = requests.find((request) => request.status === 201);
    const loser = requests.find((request) => request.status === 409);
    assert.equal(winner.body.success, true);
    assert.equal(loser.body.success, false);
    assert.equal(after.bookings.length, winner.payload.seats.length);
    assert.equal(after.userCount, before.userCount + 1, "Losing transaction must not leave a guest account.");
    assert.equal(after.trip.availableSeats, before.trip.availableSeats - winner.payload.seats.length);
    assert.equal(after.trip.availableSeats + after.bookings.length, after.trip.capacity);
    assert.equal(new Set(after.bookings.map((booking) => booking.activeSeat)).size, after.bookings.length);
    assert.deepEqual(after.bookings.map((booking) => booking.seatNumber).sort(), [...winner.payload.seats].sort());
    assert.deepEqual(winner.body.data.bookingIds, after.bookings.map((booking) => booking.id));
    assert.equal(winner.body.data.tripId, trip.id);
    assert.deepEqual(winner.body.data.seats, winner.payload.seats);
    assert.equal(winner.body.data.totalPrice, trip.price * winner.payload.seats.length);
    for (const booking of after.bookings) {
      assert.equal(booking.status, "PENDING");
      assert.equal(booking.activeSeat, `${trip.id}:${booking.seatNumber}`);
      assert.equal(booking.pnr, winner.body.data.pnr);
      assert.equal(booking.passengerName, winner.payload.fullName);
      assert.equal(booking.passengerPhone, winner.payload.phone);
      assert.equal(booking.totalPrice, trip.price);
      assert.ok(booking.expiresAt > new Date(), "Snapshot must precede online expiry.");
    }
  };
  try {
    checks();
    const loser = requests.find((request) => request.status === 409);
    record.replay = await postBooking(baseUrl, loser.payload, "loser-replay");
    record.afterReplay = await databaseSnapshot(prisma, trip.id);
    assert.equal(record.replay.status, 409);
    assert.deepEqual(record.afterReplay.bookings, after.bookings);
    assert.deepEqual(record.afterReplay.trip, after.trip);
    assert.equal(record.afterReplay.userCount, after.userCount);
    record.passed = true;
  } catch (error) {
    record.passed = false;
    error.observation = record;
    throw error;
  }
  return record;
}

function reportMarkdown(evidence, evidenceFile) {
  const localTime = new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Bangkok", dateStyle: "short", timeStyle: "medium", hour12: false,
  }).format(new Date(evidence.startedAt));
  const rows = evidence.scenarios.map((scenario) => {
    const [a, b] = scenario.requests;
    return `| ${scenario.index} | ${scenario.kind} | ${scenario.before.trip.id} | ${a.status} | ${b.status} | ${scenario.after.bookings.length} | ${scenario.before.trip.availableSeats} → ${scenario.after.trip.availableSeats} | ${scenario.passed ? "PASS" : "FAIL"} |`;
  }).join("\n");
  return `# 5.3.4. Kết quả kiểm thử hai yêu cầu đặt cùng một ghế\n\n` +
    `Thời điểm: ${localTime} (UTC+7, Asia/Bangkok). Database riêng: \`${evidence.database}\`. ` +
    `MySQL ${evidence.databaseMetadata.version}; Next.js ${evidence.runtime.next}; Node.js ${evidence.runtime.node}. ` +
    `Thực nghiệm dùng Next.js development server và HTTP thật, không mock handler/service/Prisma.\n\n` +
    `Mỗi lượt tạo chuyến mới có 22 ghế trống. Hai hành khách có họ tên và số điện thoại khác nhau gửi POST /api/bookings từ cùng một điểm xuất phát của bộ kiểm thử. ` +
    `Mười lượt yêu cầu cùng A01; một lượt yêu cầu hai tập ghế giao nhau tại A01. Trước và sau mỗi lượt, bộ kiểm thử đọc trực tiếp trip, booking, SeatHold và số tài khoản trên MySQL.\n\n` +
    `| Lượt | Kịch bản | tripId | HTTP A | HTTP B | Số vé sau | Ghế trống trước → sau | Kết quả |\n` +
    `|---|---|---:|---:|---:|---:|---|---|\n${rows}\n\n` +
    `Kết quả: ${evidence.scenarios.filter((scenario) => scenario.passed).length}/${evidence.scenarios.length} lượt đạt. ` +
    `Mỗi lượt có đúng một yêu cầu 201 và một yêu cầu 409; chỉ các ghế thuộc yêu cầu thành công được lưu. ` +
    `activeSeat, PNR, hành khách và ID vé khớp phản hồi 201. Số ghế trống giảm đúng số ghế của yêu cầu thành công; yêu cầu thất bại không để lại tài khoản/vé dở dang. ` +
    `Gửi lại yêu cầu thua vẫn trả 409 và không làm thay đổi dữ liệu. Đối chứng đặt lần lượt hai ghế khác nhau đạt ${evidence.control.passed ? "PASS" : "FAIL"}.\n\n` +
    `Giới hạn: khoảng thời gian HTTP chồng lấn không chứng minh hai transaction đọc cùng một thời điểm. ` +
    `Không quan sát thấy dữ liệu ghi dở dang; thực nghiệm không xác định yêu cầu thua đã ghi dữ liệu rồi rollback hay bị từ chối trước khi ghi. ` +
    `Thực nghiệm không cô lập tác dụng của từng cơ chế Serializable, retry hay unique index; không phải phép đo tải hoặc bằng chứng cho mọi lịch thực thi. ` +
    `Database dùng schema snapshot có các CHECK và unique activeSeat, đổi riêng FK booking.tripId sang ON UPDATE RESTRICT để tránh MySQL 3823; không xác minh chuỗi migration lịch sử. ` +
    `Không kiểm thử giữ ghế qua giao diện hoặc thanh toán ngân hàng.\n\n` +
    `Minh chứng gốc: [result.json](${path.basename(evidenceFile)}). Tệp này lưu request/response, thời điểm, dữ liệu trước–sau, metadata database và SHA-256 source.\n`;
}

async function main() {
  assert.equal(process.argv.length, 2, "Use npm run test:booking-concurrency without arguments.");
  assert.equal(fs.existsSync(path.join(root, ".next-demo/dev/lock")), false,
    "A demo development server is already using .next-demo/dev. Stop that demo before running this test.");
  require("dotenv").config({ path: path.join(root, ".env"), quiet: true });
  const envPath = path.join(root, ".env");
  const envBefore = fs.existsSync(envPath) ? hash(fs.readFileSync(envPath)) : null;
  const runId = `${new Date().toISOString().replace(/[-:.]/g, "")}_${randomBytes(3).toString("hex")}`;
  const output = path.join(evidenceRoot, runId);
  fs.mkdirSync(output, { recursive: true });
  const evidenceFile = path.join(output, "result.json");
  const port = await unusedPort();
  const configuration = createConfiguration(parseArguments([
    "--database", `sgu_booking_demo_race_${Date.now()}_${randomBytes(3).toString("hex")}`,
    "--port", String(port), "--no-start",
  ]), process.env);
  const baseUrl = `http://127.0.0.1:${port}`;
  const evidence = {
    runId, startedAt: new Date().toISOString(), timeZone: "Asia/Bangkok", passed: false,
    database: configuration.database, databaseRetained: true, baseUrl,
    runtime: { node: process.version, next: require("next/package.json").version, serverMode: "development" },
    source: sourceManifest(), scenarios: [],
    isolation: { applicationDatabaseTargeted: false, historicalMigrationsExecuted: false,
      schema: "isolated demo snapshot with five CHECK constraints", bookingTripForeignKeyUpdateRule: "RESTRICT" },
  };
  const persist = () => fs.writeFileSync(evidenceFile, `${json(evidence)}\n`);
  let child;
  let prisma;
  let serverOutput = "";
  const interrupt = () => {
    evidence.passed = false;
    evidence.interrupted = true;
    evidence.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(output, "server.log"), serverOutput);
    persist();
    void stopServer(child).catch(() => {}).finally(() => process.exit(130));
  };
  process.once("SIGINT", interrupt);
  process.once("SIGTERM", interrupt);
  try {
    console.log("Preparing a fresh, isolated local MySQL database...");
    const { PrismaClient } = ensureGeneratedClient(configuration.childEnvironment);
    const provisioned = await provisionDemo(configuration, { PrismaClient });
    assert.equal(provisioned.created, true, "Each experiment must create a fresh database.");
    prisma = new PrismaClient({ datasources: { db: { url: configuration.targetUrl } }, log: [] });
    const version = await prisma.$queryRawUnsafe("SELECT VERSION() AS version, @@transaction_isolation AS defaultIsolation");
    const tables = await prisma.$queryRawUnsafe("SELECT TABLE_NAME AS tableName, ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('booking', 'trip', 'user', 'SeatHold') ORDER BY TABLE_NAME");
    assert.ok(tables.length >= 3 && tables.every((table) => table.engine === "InnoDB"));
    const uniqueSeat = await prisma.$queryRawUnsafe("SELECT INDEX_NAME AS indexName, NON_UNIQUE AS nonUnique, COLUMN_NAME AS columnName FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'booking' AND COLUMN_NAME = 'activeSeat'");
    assert.ok(uniqueSeat.some((index) => Number(index.nonUnique) === 0));
    const checks = await prisma.$queryRawUnsafe("SELECT CONSTRAINT_NAME AS name FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND CONSTRAINT_TYPE = 'CHECK' ORDER BY CONSTRAINT_NAME");
    assert.equal(checks.length, 5);
    const foreignKey = await prisma.$queryRawUnsafe("SELECT UPDATE_RULE AS updateRule FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'booking' AND REFERENCED_TABLE_NAME = 'trip'");
    assert.equal(foreignKey[0].updateRule, "RESTRICT");
    evidence.databaseMetadata = { ...version[0], tables, uniqueSeat, checks, foreignKey };
    persist();

    console.log(`Starting real Next.js HTTP server on loopback port ${port}...`);
    child = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "--port", String(port)], {
      cwd: root, env: configuration.childEnvironment, stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true, detached: process.platform !== "win32",
    });
    let spawnError;
    child.on("error", (error) => { spawnError = error; });
    for (const stream of [child.stdout, child.stderr]) stream.on("data", (data) => {
      serverOutput = (serverOutput + sanitize(data.toString(), configuration)).slice(-2_000_000);
    });
    await waitUntil(async () => {
      if (spawnError || child.exitCode !== null) throw new Error("The isolated Next.js server failed to start.");
      try {
        const response = await fetch(`${baseUrl}/api/bookings`, { signal: AbortSignal.timeout(3000) });
        const body = await response.json();
        return response.status === 400 && body.success === false;
      } catch { return false; }
    }, "Next.js bookings route did not become ready", 120000);

    // Warm the POST route without writing any booking.
    const warm = await postBooking(baseUrl, {}, "invalid-warmup");
    assert.equal(warm.status, 400);

    const controlTrip = await createTrip(prisma, "sequential-control");
    const controlBefore = await databaseSnapshot(prisma, controlTrip.id);
    const controlRequests = [];
    for (const [index, seat] of ["A01", "A02"].entries()) {
      controlRequests.push(await postBooking(baseUrl, passenger(controlTrip.id, [seat], 100 + index, "A"), `control-${index + 1}`));
    }
    const controlAfter = await databaseSnapshot(prisma, controlTrip.id);
    evidence.control = { before: controlBefore, requests: controlRequests, after: controlAfter, passed: false };
    assert.deepEqual(controlRequests.map((request) => request.status), [201, 201]);
    assert.equal(controlAfter.bookings.length, 2);
    assert.equal(controlAfter.trip.availableSeats, controlTrip.capacity - 2);
    evidence.control.passed = true;
    console.log("PASS: valid independent passengers can book different seats (sequential control).");
    for (let index = 1; index <= 11; index++) {
      const multi = index === 11;
      const result = await runPair(prisma, baseUrl, index, multi ? ["A01", "A02"] : ["A01"], multi ? ["A01", "A03"] : ["A01"]);
      evidence.scenarios.push(result);
      persist();
      console.log(`PASS ${index}/11: HTTP ${result.requests.map((request) => request.status).join(" + ")}; ${result.after.bookings.length} booking(s); seats ${result.before.trip.availableSeats} -> ${result.after.trip.availableSeats}; replay 409.`);
    }
    evidence.passed = true;
  } catch (error) {
    if (error.observation) evidence.scenarios.push(error.observation);
    evidence.error = { name: error.name, message: sanitize(error.message, configuration) };
    throw error;
  } finally {
    evidence.cleanupErrors = [];
    try { await stopServer(child); evidence.serverStopped = true; }
    catch (error) { evidence.cleanupErrors.push(sanitize(error.message, configuration)); }
    try { await prisma?.$disconnect(); }
    catch (error) { evidence.cleanupErrors.push(sanitize(error.message, configuration)); }
    if (evidence.cleanupErrors.length) evidence.passed = false;
    process.off("SIGINT", interrupt);
    process.off("SIGTERM", interrupt);
    evidence.finishedAt = new Date().toISOString();
    evidence.environmentFileUnchanged = (fs.existsSync(envPath) ? hash(fs.readFileSync(envPath)) : null) === envBefore;
    if (!evidence.environmentFileUnchanged) evidence.passed = false;
    fs.writeFileSync(path.join(output, "server.log"), serverOutput);
    persist();
    if (evidence.passed) fs.writeFileSync(path.join(output, "report-5.3.4.md"), reportMarkdown(evidence, evidenceFile));
    console.log(`Evidence: ${relative(evidenceFile)}`);
    console.log(`Retained isolated database: ${configuration.database}`);
  }
  assert.equal(evidence.passed, true);
  console.log("PASS: 10 same-seat rounds, 1 overlapping multi-seat round, replay checks and sequential control. Application database and .env were not modified.");
}

if (require.main === module) main().catch((error) => {
  console.error(`Booking concurrency experiment failed: ${sanitize(error.message)}. Inspect result.json/server.log in documentation/evidence/booking-concurrency. No application database was targeted.`);
  process.exitCode = 1;
});
