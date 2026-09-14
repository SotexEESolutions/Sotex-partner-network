import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const jobsRoute = await readFile(new URL("../app/api/discovery/jobs/route.ts", import.meta.url), "utf8");
const tickRoute = await readFile(new URL("../app/api/discovery/jobs/[id]/tick/route.ts", import.meta.url), "utf8");

test("discovery job creation sets created_by_user_id, satisfying the 'users create private discovery jobs' RLS check", () => {
  assert.match(jobsRoute, /\.from\("discovery_jobs"\)\.insert\(\{/);
  assert.match(jobsRoute, /requested_by:user\.id,created_by_user_id:user\.id/);
});

test("discovery tick sets created_by_user_id on staged candidates, satisfying the 'users create private candidates' RLS check", () => {
  assert.match(tickRoute, /mapGooglePlace\([^)]*\),created_by_user_id:user\.id/);
});
