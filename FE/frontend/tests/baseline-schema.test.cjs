const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createBaselineSchema } = require("../scripts/baseline-schema.cjs");

const schema = fs.readFileSync(path.resolve(__dirname, "../prisma/schema.prisma"), "utf8");
const migration = fs.readFileSync(path.resolve(__dirname, "../prisma/admin-migrations/20261009000000_baseline/migration.sql"), "utf8");

function model(source, name) {
  const match = source.match(new RegExp(`^model ${name} \\{[\\s\\S]*?^\\}`, "m"));
  assert.ok(match, `Expected model ${name}`);
  return match[0];
}

function scalarFields(source) {
  return Array.from(source.matchAll(/^\s*(\w+)\s+(?:Int|Float|String|DateTime|Boolean)\??\s/gm), (match) => match[1]);
}

function baselineColumns(name) {
  const table = migration.match(new RegExp("CREATE TABLE `" + name + "` \\(([\\s\\S]*?)\\) DEFAULT"));
  assert.ok(table, `Expected baseline table ${name}`);
  return Array.from(table[1].matchAll(/^\s*`(\w+)`\s/gm), (match) => match[1]);
}

test("the upgrade projection matches baseline booking and hold columns without removing hold expiry", () => {
  const projected = createBaselineSchema(schema);
  const booking = model(projected, "booking");
  const hold = model(projected, "SeatHold");
  assert.deepEqual(scalarFields(booking), baselineColumns("booking"));
  assert.deepEqual(scalarFields(hold), baselineColumns("SeatHold"));
  assert.doesNotMatch(booking, /@@index\([^\n]*expiresAt/);
  assert.match(hold, /^\s*expiresAt\s+DateTime\s*$/m);
  assert.match(booking, /^\s*totalPrice\s+Float\s*$/m);
  assert.match(model(projected, "trip"), /^\s*code\s+String\s+@unique/m);
});

test("booking expiry removal preserves expiry fields and composite indexes on other models", () => {
  const other = [
    "model ExpiryAudit {",
    "  id Int @id",
    "  status String",
    "  expiresAt DateTime?",
    "  @@index([status, expiresAt])",
    "}",
  ].join("\n");
  const projected = createBaselineSchema(`${schema}\n${other}\n`);
  assert.equal(model(projected, "ExpiryAudit"), other);
  assert.doesNotMatch(model(projected, "booking"), /expiresAt/);
});
