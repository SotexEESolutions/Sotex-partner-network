import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(
  new URL("../supabase/migrations/20260914220725_fix_discovery_job_returning_rls.sql", import.meta.url),
  "utf8",
);

test("discovery job SELECT policy evaluates INSERT RETURNING rows without querying the table", () => {
  assert.match(migration, /create policy "visible discovery jobs"/);
  assert.match(migration, /created_by_user_id\s*=\s*\(select auth\.uid\(\)\)/);
  assert.match(migration, /requested_by\s*=\s*\(select auth\.uid\(\)\)/);
  assert.doesNotMatch(migration, /private\.can_view_discovery_job\(id\)/);
});

test("private discovery jobs retain the original manager-and-territory visibility requirement", () => {
  assert.match(
    migration,
    /visibility\s*=\s*'Private'[\s\S]*private\.manager_can_view_user\(created_by_user_id\)[\s\S]*and private\.user_can_manage_territory\(territory_id\)/,
  );
});
