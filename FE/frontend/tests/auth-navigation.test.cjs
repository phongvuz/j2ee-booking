const { test } = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./load-ts.cjs");
const { authModalUrl, safeAuthReturnTo } = load("lib/auth-navigation.ts");

test("opening, switching and closing auth keeps trip search filters", () => {
  const search = "from=SGN&to=DLT&date=2026-10-15";
  const opened = authModalUrl("/trips", search, "login");
  assert.equal(opened, `/trips?${search}&auth=login`);
  const switched = authModalUrl("/trips", opened.split("?")[1], "register");
  assert.equal(switched, `/trips?${search}&auth=register`);
  assert.equal(authModalUrl("/trips", switched.split("?")[1], null), `/trips?${search}`);
  assert.equal(authModalUrl("/", "auth=login&next=%2Fprofile", null), "/");
});

test("login return destinations are local and cannot reopen authentication", () => {
  for (const value of [undefined, null, "", "https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "/\nevil.example", "/login", "/register?next=/profile"]) {
    assert.equal(safeAuthReturnTo(value), null, String(value));
  }
  assert.equal(safeAuthReturnTo("/profile"), "/profile");
  assert.equal(safeAuthReturnTo("/bookings"), "/bookings");
  assert.equal(safeAuthReturnTo("/trips?to=DLT&auth=login&next=/profile#results"), "/trips?to=DLT#results");
});
