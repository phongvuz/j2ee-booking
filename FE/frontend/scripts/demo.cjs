// A local-only demo bootstrap. Existing application databases are never targets.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync, spawn } = require("node:child_process");
const { createHash, randomBytes, scryptSync } = require("node:crypto");

const root = path.resolve(__dirname, "..");
const purpose = "sgu-booking-isolated-demo-v1";
const demoPassword = "Demo@12345";
class DemoSetupError extends Error {}
const accounts = Object.freeze({ admin: "0911000001", customer: "0911000002", email: "customer@example.test" });
const constraints = [
  "ALTER TABLE `bus` ADD CONSTRAINT `bus_capacity_check` CHECK (`capacity` BETWEEN 1 AND 60)",
  "ALTER TABLE `trip` ADD CONSTRAINT `trip_seat_counts_check` CHECK (`availableSeats` BETWEEN 0 AND 60)",
  "ALTER TABLE `booking` ADD CONSTRAINT `booking_status_check` CHECK (`status` IN ('CONFIRMED', 'PENDING', 'CANCELLED') AND `totalPrice` >= 0)",
  "ALTER TABLE `booking` ADD CONSTRAINT `booking_active_seat_check` CHECK ((`status` = 'CANCELLED' AND `activeSeat` IS NULL) OR (`status` <> 'CANCELLED' AND `activeSeat` IS NOT NULL AND `activeSeat` = CONCAT(`tripId`, ':', `seatNumber`)))",
  "ALTER TABLE `trip` ADD CONSTRAINT `trip_integer_vnd_check` CHECK (`price` BETWEEN 0 AND 2147483647)",
  "ALTER TABLE `booking` ADD CONSTRAINT `booking_integer_vnd_check` CHECK (`totalPrice` BETWEEN 0 AND 2147483647)",
];

function parseArguments(args) {
  const options = { database: "sgu_booking_demo", noStart: false, help: false, port: 3001 };
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument === "--no-start") options.noStart = true;
    else if (argument === "--help") options.help = true;
    else if (argument === "--database" || argument === "--port") {
      const value = args[++index];
      if (!value || value.startsWith("--")) throw new DemoSetupError(`Missing value for ${argument}.`);
      if (argument === "--database") options.database = value;
      else options.port = Number(value);
    } else throw new DemoSetupError("Unknown demo option. Use --help to list supported flags.");
  }
  if (!/^sgu_booking_demo(?:_[a-z0-9_]+)?$/.test(options.database) || options.database.length > 64) {
    throw new DemoSetupError("Demo database must be sgu_booking_demo or sgu_booking_demo_<lowercase_suffix> (at most 64 characters).");
  }
  if (!Number.isInteger(options.port) || options.port < 1024 || options.port > 65535) throw new DemoSetupError("Demo port must be an integer from 1024 to 65535.");
  return options;
}

function createConfiguration(options, environment) {
  const value = environment.DEMO_SERVER_URL || environment.DATABASE_URL;
  if (!value) throw new DemoSetupError("Start local MySQL and set DEMO_SERVER_URL or DATABASE_URL (see documentation/reproducibility.md).");
  let server;
  try { server = new URL(value); } catch { throw new DemoSetupError("The database URL is invalid; its value has not been printed."); }
  if (server.protocol !== "mysql:" || !["localhost", "127.0.0.1", "[::1]", "::1"].includes(server.hostname)) {
    throw new DemoSetupError("The demo bootstrap only connects to a MySQL server on this computer.");
  }
  const sourceDatabase = decodeURIComponent(server.pathname.slice(1));
  if (sourceDatabase === options.database) throw new DemoSetupError("The requested demo name matches the configured source database. Use a different demo suffix.");
  const control = new URL(server);
  control.pathname = "/mysql";
  const target = new URL(server);
  target.pathname = `/${options.database}`;
  const password = environment.DEMO_PASSWORD || demoPassword;
  if (password.length < 6 || password.length > 128) throw new DemoSetupError("DEMO_PASSWORD must contain 6 to 128 characters.");
  const childEnvironment = {
    ...environment,
    DATABASE_URL: target.toString(),
    SESSION_SECRET: randomBytes(32).toString("hex"),
    SGU_DEMO: "true",
    NODE_ENV: "development",
    NEXT_TELEMETRY_DISABLED: "1",
    PAYMENT_DEMO_ENABLED: "true",
    VIETQR_BANK_ID: "970415",
    VIETQR_BANK_NAME: "DEMO - KHONG CHUYEN TIEN",
    VIETQR_ACCOUNT_NO: "000000000000",
    VIETQR_ACCOUNT_NAME: "DEMO KHONG CHUYEN TIEN",
  };
  return { ...options, controlUrl: control.toString(), targetUrl: target.toString(), password, childEnvironment };
}

function createDemoSchema(source) {
  // MySQL rejects a CHECK referencing tripId when that FK has ON UPDATE CASCADE
  // (error 3823). Demo IDs never change, so use RESTRICT in this fresh snapshot.
  // The tracked schema and already-applied migration checksums remain untouched.
  const relation = /(@relation\(fields: \[tripId\], references: \[id\], onDelete: Restrict)(,)/g;
  const matches = [...source.matchAll(relation)];
  if (matches.length !== 1) throw new DemoSetupError("The booking trip relation changed. Review the demo schema before provisioning.");
  return source.replace(relation, "$1, onUpdate: Restrict$2");
}

function schemaFingerprint(schema) {
  return createHash("sha256").update(JSON.stringify({ purpose, schema, constraints })).digest("hex");
}

function createSeedData(now = new Date(), password = demoPassword) {
  const salt = randomBytes(16).toString("hex");
  const passwordHash = `scrypt:${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
  const departures = [
    ["Hồ Chí Minh", "Đà Lạt", 300000, 22],
    ["Hồ Chí Minh", "Nha Trang", 280000, 34],
    ["Đà Lạt", "Hồ Chí Minh", 300000, 22],
    ["Hồ Chí Minh", "Cần Thơ", 180000, 34],
    ["Hồ Chí Minh", "Đà Nẵng", 450000, 34],
    ["Hồ Chí Minh", "Vũng Tàu", 160000, 22],
  ];
  return {
    users: [
      { fullName: "Quản trị Demo", phone: accounts.admin, password: passwordHash, role: "ADMIN", isActive: true },
      { fullName: "Khách hàng Demo", phone: accounts.customer, password: passwordHash, role: "CUSTOMER", isActive: true },
    ],
    customer: { id: "CUS-DEMO-001", name: "Khách hàng Demo", email: accounts.email, phone: accounts.customer, status: "Đang hoạt động", address: "Địa chỉ minh họa" },
    trips: departures.map(([from, to, price, capacity], index) => ({
      from, to, price, busId: capacity === 22 ? "BUS-DEMO-001" : "BUS-DEMO-002", availableSeats: capacity,
      time: new Date(now.getTime() + (index + 1) * 86400000),
      endsAt: new Date(now.getTime() + (index + 1) * 86400000 + 12 * 3600000),
      status: "OPEN",
      driverId: "EMP-DEMO-001",
    })),
    buses: [
      { id: "BUS-DEMO-001", plate: "51B-111.11", type: "Limousine 22 phòng", capacity: 22, status: "Đang hoạt động", brand: "Xe minh họa", year: 2024 },
      { id: "BUS-DEMO-002", plate: "51B-222.22", type: "Giường nằm 34 chỗ", capacity: 34, status: "Đang hoạt động", brand: "Xe minh họa", year: 2024 },
    ],
    employee: { id: "EMP-DEMO-001", name: "Nhân viên Demo", email: "employee@example.test", phone: "0911000003", role: "Tài xế", department: "Đội xe", status: "Đang làm việc", startDate: "2024-01-01" },
  };
}

async function seedFreshDatabase(prisma, fingerprint, password) {
  const data = createSeedData(new Date(), password);
  await prisma.$transaction(async (tx) => {
    await tx.user.createMany({ data: data.users });
    await tx.customer.create({ data: data.customer });
    const customer = await tx.user.findUnique({ where: { phone: accounts.customer } });
    await tx.bus.createMany({ data: data.buses });
    const trips = [];
    await tx.employee.create({ data: data.employee });
    for (const trip of data.trips) trips.push(await tx.trip.create({ data: trip }));
    const booking = await tx.booking.create({ data: {
      pnr: "DEMO-HISTORY-001", passengerName: data.customer.name, passengerPhone: data.customer.phone,
      seatNumber: "A01", activeSeat: `${trips[0].id}:A01`, status: "CONFIRMED", totalPrice: trips[0].price,
      userId: customer.id, tripId: trips[0].id, confirmedAt: new Date(),
    } });
    await tx.bookingTransaction.create({ data: { bookingId: booking.id, kind: "RECEIPT", amount: booking.totalPrice, method: "DEMO", reference: "DEMO-HISTORY-001" } });
    await tx.trip.update({ where: { id: trips[0].id }, data: { availableSeats: { decrement: 1 } } });
    await tx.$executeRawUnsafe("INSERT INTO `_sgu_demo_meta` (`id`, `purpose`, `schemaHash`) VALUES (1, ?, ?)", purpose, fingerprint);
  }, { timeout: 30000 });
}

function ensureDependencies() {
  const required = ["prisma/build/index.js", "@prisma/client", "dotenv", "next/dist/bin/next"];
  const missing = required.some((name) => {
    try { require.resolve(name, { paths: [root] }); return false; } catch { return true; }
  });
  if (!missing) return;
  console.log("Installing the versions in package-lock.json (npm ci)...");
  // Windows npm.cmd is a batch file. Only fixed, non-user-supplied arguments
  // reach its shell; database URLs and passwords are passed through env instead.
  const result = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", ["ci", "--no-audit", "--no-fund"], {
    cwd: root, stdio: "inherit", shell: process.platform === "win32",
  });
  if (result.error || result.status !== 0) throw new DemoSetupError("npm ci failed. Install Node.js 22 and ensure npm can access the package registry.");
}

function runPrisma(args, environment) {
  const result = spawnSync(process.execPath, [require.resolve("prisma/build/index.js"), ...args], {
    cwd: root, env: environment, encoding: "utf8", maxBuffer: 4 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    // Do not log Prisma output: diagnostics may contain a connection string.
    const code = result.error?.code;
    const safeCode = typeof code === "string" && /^[A-Z0-9_]+$/.test(code) ? `, spawn ${code}` : "";
    const diagnostic = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.match(/\b(?:P\d{4}|3823|ER_[A-Z_]+|EPERM)\b/)?.[0];
    const safeDiagnostic = diagnostic ? `, ${diagnostic}` : "";
    const phase = args.slice(0, 2).filter((value) => !value.startsWith("--")).join(" ");
    const lockedEngine = diagnostic === "EPERM" ? " Windows may have locked the Prisma engine; generation requires an unlocked engine when the generated client is missing or stale." : "";
    throw new DemoSetupError(`Prisma ${phase} failed (exit ${result.status ?? "unknown"}${safeCode}${safeDiagnostic}). Check local process permissions and MySQL setup.${lockedEngine} No database was reset or deleted.`);
  }
}

function generatedClientMatches(source, generatedSchema, client) {
  const canonical = (value) => value.replaceAll("\r\n", "\n").trim();
  if (typeof generatedSchema !== "string" || canonical(source) !== canonical(generatedSchema) || typeof client?.PrismaClient !== "function") return false;
  const models = client.Prisma?.dmmf?.datamodel?.models;
  if (!Array.isArray(models)) return false;
  const expected = [...source.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)];
  if (!expected.length || models.length !== expected.length) return false;
  return expected.every(([, name, body]) => {
    const model = models.find((candidate) => candidate.name === name);
    const fields = [...body.matchAll(/^\s+(\w+)\s+(\w+)(\[\]|\?)?(?:\s|$)/gm)];
    return model && model.fields.length === fields.length && fields.every(([, fieldName, type, modifier]) => {
      const field = model.fields.find((candidate) => candidate.name === fieldName);
      return field && field.type === type && field.isList === (modifier === "[]") && field.isRequired === (modifier !== "?");
    });
  });
}

function ensureGeneratedClient(environment, dependencies = {}) {
  const source = dependencies.source ?? fs.readFileSync(path.join(root, "prisma/schema.prisma"), "utf8");
  const readGeneratedSchema = dependencies.readGeneratedSchema ?? (() => {
    try { return fs.readFileSync(path.join(root, "node_modules/.prisma/client/schema.prisma"), "utf8"); }
    catch { return null; }
  });
  const loadClient = dependencies.loadClient ?? (() => require("@prisma/client"));
  const tryLoadClient = () => { try { return loadClient(); } catch { return null; } };
  const generated = readGeneratedSchema();
  // Do not load a known-stale client before generation; this also avoids
  // unnecessarily locking a Windows query engine with an outdated module.
  const candidate = typeof generated === "string" && source.replaceAll("\r\n", "\n").trim() === generated.replaceAll("\r\n", "\n").trim() ? tryLoadClient() : null;
  if (generatedClientMatches(source, generated, candidate)) return candidate;
  const generate = dependencies.generate ?? (() => runPrisma(["generate"], environment));
  generate();
  for (const filename of Object.keys(require.cache)) {
    if (/[\\/]node_modules[\\/](?:\.prisma[\\/]client|@prisma[\\/]client)[\\/]/.test(filename)) delete require.cache[filename];
  }
  const refreshed = tryLoadClient();
  if (!generatedClientMatches(source, readGeneratedSchema(), refreshed)) {
    throw new DemoSetupError("The generated Prisma Client does not match the current schema after generation. No demo provisioning was attempted.");
  }
  return refreshed;
}

async function provisionDemo(configuration, { PrismaClient, applySchema = runPrisma } = {}) {
  // Validate at the mutation boundary as well as at the CLI boundary.
  parseArguments(["--database", configuration.database]);
  const targetAddress = new URL(configuration.targetUrl);
  const controlAddress = new URL(configuration.controlUrl);
  const targetName = decodeURIComponent(targetAddress.pathname.slice(1));
  const serverIdentity = (address) => `${address.protocol}//${address.username}:${address.password}@${address.host}`;
  if (targetName !== configuration.database || controlAddress.pathname !== "/mysql" ||
    targetAddress.protocol !== "mysql:" || !["localhost", "127.0.0.1", "[::1]", "::1"].includes(targetAddress.hostname) ||
    serverIdentity(targetAddress) !== serverIdentity(controlAddress) ||
    configuration.childEnvironment.DATABASE_URL !== configuration.targetUrl) {
    throw new DemoSetupError("Demo URLs do not match the isolated database/control schema.");
  }
  const schema = createDemoSchema(fs.readFileSync(path.join(root, "prisma/schema.prisma"), "utf8"));
  const fingerprint = schemaFingerprint(schema);
  const control = new PrismaClient({ datasources: { db: { url: configuration.controlUrl } }, log: [] });
  const target = new PrismaClient({ datasources: { db: { url: configuration.targetUrl } }, log: [] });
  let created = false;
  try {
    const existing = await control.$queryRawUnsafe("SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?", configuration.database);
    if (existing.length) {
      let marker;
      try { marker = await target.$queryRawUnsafe("SELECT `purpose`, `schemaHash` FROM `_sgu_demo_meta` WHERE `id` = 1"); }
      catch { throw new DemoSetupError("This database already exists and is not an owned demo. Nothing was changed. Choose a fresh --database suffix."); }
      if (marker.length !== 1 || marker[0].purpose !== purpose || marker[0].schemaHash !== fingerprint) {
        throw new DemoSetupError("The existing database has no matching demo/schema marker. Nothing was changed. Choose a fresh --database suffix.");
      }
      return { created: false, database: configuration.database };
    }
    // No IF NOT EXISTS: concurrent creation must fail instead of claiming data.
    await control.$executeRawUnsafe(`CREATE DATABASE \`${configuration.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    created = true;
    const temporary = path.join(os.tmpdir(), `sgu-demo-${process.pid}-${randomBytes(8).toString("hex")}.prisma`);
    fs.writeFileSync(temporary, schema, { flag: "wx", mode: 0o600 });
    try { applySchema(["db", "push", "--schema", temporary, "--skip-generate"], configuration.childEnvironment); }
    finally { fs.unlinkSync(temporary); }
    for (const statement of constraints) await target.$executeRawUnsafe(statement);
    await target.$executeRawUnsafe("CREATE TABLE `_sgu_demo_meta` (`id` INTEGER PRIMARY KEY, `purpose` VARCHAR(100) NOT NULL, `schemaHash` CHAR(64) NOT NULL)");
    await seedFreshDatabase(target, fingerprint, configuration.password);
    return { created: true, database: configuration.database };
  } catch (error) {
    if (created) console.error("The newly created demo database was kept for diagnosis. No database was reset or deleted.");
    throw error;
  } finally {
    await Promise.all([control.$disconnect(), target.$disconnect()]);
  }
}

async function startDemo(configuration) {
  console.log(`Demo: http://127.0.0.1:${configuration.port} (customer); /admin/login (administrator).`);
  console.log(`Demo accounts: ADMIN ${accounts.admin}; CUSTOMER ${accounts.customer}. Credentials: documentation/reproducibility.md.`);
  const child = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "--port", String(configuration.port)], {
    cwd: root, env: configuration.childEnvironment, stdio: "inherit",
  });
  const onSignal = (signal) => { if (!child.killed) child.kill(signal); };
  const interrupt = () => onSignal("SIGINT");
  const terminate = () => onSignal("SIGTERM");
  process.on("SIGINT", interrupt);
  process.on("SIGTERM", terminate);
  try {
    return await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", (code, signal) => resolve(signal ? 0 : code ?? 1));
    });
  } finally {
    process.off("SIGINT", interrupt);
    process.off("SIGTERM", terminate);
  }
}

async function main(args = process.argv.slice(2)) {
  const options = parseArguments(args);
  if (options.help) {
    console.log("node scripts/demo.cjs [--database sgu_booking_demo_<suffix>] [--port 3001] [--no-start]");
    return;
  }
  ensureDependencies();
  require("dotenv").config({ path: path.join(root, ".env"), quiet: true });
  const configuration = createConfiguration(options, process.env);
  const { PrismaClient } = ensureGeneratedClient(configuration.childEnvironment);
  const result = await provisionDemo(configuration, { PrismaClient });
  console.log(result.created ? `Created and seeded isolated database ${result.database}.` : `Reusing owned database ${result.database}; existing records were not changed.`);
  if (!options.noStart) process.exitCode = await startDemo(configuration);
}

module.exports = { parseArguments, createConfiguration, createDemoSchema, schemaFingerprint, createSeedData, generatedClientMatches, ensureGeneratedClient, provisionDemo, main, accounts, purpose, constraints };

if (require.main === module) main().catch((error) => {
  // Keep credentials out of unexpected connector/engine exceptions, too.
  console.error(error instanceof DemoSetupError ? error.message : "Demo setup failed. Check local MySQL permissions/version; credentials were not printed.");
  console.error("See documentation/reproducibility.md. Existing application databases and .env were preserved.");
  process.exitCode = 1;
});
