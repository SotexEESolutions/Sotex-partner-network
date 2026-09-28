import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(
  new URL("../supabase/migrations/20260914224031_fix_firm_candidate_returning_rls.sql", import.meta.url),
  "utf8",
);

test("firm candidate SELECT policy evaluates upsert RETURNING rows without querying the table", () => {
  assert.match(migration, /create policy "visible firm candidates"/);
  assert.match(migration, /created_by_user_id\s*=\s*\(select auth\.uid\(\)\)/);
  assert.doesNotMatch(migration, /private\.can_view_candidate\(id\)/);
});

test("private candidate visibility retains the original manager-and-territory requirement", () => {
  assert.match(
    migration,
    /visibility\s*=\s*'Private'[\s\S]*private\.manager_can_view_user\(created_by_user_id\)[\s\S]*and private\.user_can_manage_territory\(territory_id\)/,
  );
});
