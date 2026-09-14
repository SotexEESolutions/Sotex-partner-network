import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DISCOVERY_DAILY_REQUEST_LIMIT_DEFAULT, parseDiscoveryDailyLimit } from "../lib/discovery/core.mjs";

const jobsRoute = await readFile(new URL("../app/api/discovery/jobs/route.ts", import.meta.url), "utf8");
const tickRoute = await readFile(new URL("../app/api/discovery/jobs/[id]/tick/route.ts", import.meta.url), "utf8");

test("missing DISCOVERY_DAILY_REQUEST_LIMIT falls back to the safe default", () => {
  assert.equal(parseDiscoveryDailyLimit(undefined), DISCOVERY_DAILY_REQUEST_LIMIT_DEFAULT);
});

test("blank DISCOVERY_DAILY_REQUEST_LIMIT falls back instead of becoming zero", () => {
  assert.equal(parseDiscoveryDailyLimit(""), DISCOVERY_DAILY_REQUEST_LIMIT_DEFAULT);
  assert.equal(parseDiscoveryDailyLimit("   "), DISCOVERY_DAILY_REQUEST_LIMIT_DEFAULT);
});

test("non-numeric DISCOVERY_DAILY_REQUEST_LIMIT falls back to the safe default", () => {
  assert.equal(parseDiscoveryDailyLimit("not-a-number"), DISCOVERY_DAILY_REQUEST_LIMIT_DEFAULT);
});

test("zero or negative DISCOVERY_DAILY_REQUEST_LIMIT falls back to the safe default", () => {
  assert.equal(parseDiscoveryDailyLimit("0"), DISCOVERY_DAILY_REQUEST_LIMIT_DEFAULT);
  assert.equal(parseDiscoveryDailyLimit("-5"), DISCOVERY_DAILY_REQUEST_LIMIT_DEFAULT);
});

test("a valid positive DISCOVERY_DAILY_REQUEST_LIMIT is used as-is", () => {
  assert.equal(parseDiscoveryDailyLimit("45"), 45);
  assert.equal(parseDiscoveryDailyLimit("2"), 2);
});

test("discovery job creation and tick routes parse the limit through the shared safe helper, not a raw Number() coercion", () => {
  for (const source of [jobsRoute, tickRoute]) {
    assert.match(source, /import\s*\{[^}]*parseDiscoveryDailyLimit[^}]*\}\s*from\s*"@\/lib\/discovery\/core\.mjs"/);
    assert.match(source, /parseDiscoveryDailyLimit\(process\.env\.DISCOVERY_DAILY_REQUEST_LIMIT\)/);
    assert.doesNotMatch(source, /Number\(process\.env\.DISCOVERY_DAILY_REQUEST_LIMIT/);
  }
});
