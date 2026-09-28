import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration=await readFile(new URL("../supabase/migrations/20260914174106_add_multi_user_access_control.sql",import.meta.url),"utf8");
const network=await readFile(new URL("../components/partner-network.tsx",import.meta.url),"utf8");
const admin=await readFile(new URL("../components/admin-access.tsx",import.meta.url),"utf8");
const invite=await readFile(new URL("../app/api/admin/users/route.ts",import.meta.url),"utf8");
const adminGuard=await readFile(new URL("../supabase/migrations/20260914182500_protect_last_active_admin.sql",import.meta.url),"utf8");
const mergeMigration=await readFile(new URL("../supabase/migrations/20260914190000_merge_duplicate_firm_candidates.sql",import.meta.url),"utf8");
const adapters=await readFile(new URL("../lib/discovery/provider-adapters.ts",import.meta.url),"utf8");

test("multi-user schema defines roles, territories, ownership and audit history",()=>{
  for(const table of ["profiles","territories","user_territories","audit_log"])assert.match(migration,new RegExp(`create table public\\.${table}`));
  for(const role of ["Admin","Manager","Rep","Researcher"])assert.match(migration,new RegExp(`'${role}'`));
  for(const territory of ["San Antonio","New Braunfels / Seguin","Hill Country","Corpus Christi / Coastal Bend","Laredo","Rio Grande Valley","Midland / Odessa"])assert.match(migration,new RegExp(territory.replace("/","\\/")));
  assert.match(migration,/record_visibility/);assert.match(migration,/assigned_user_id/);assert.match(migration,/created_by_user_id/);
});

test("RLS is relationship based and approval is restricted to management",()=>{
  for(const helper of ["can_view_firm","can_edit_firm","can_view_candidate","user_has_territory_access"])assert.match(migration,new RegExp(helper));
  assert.doesNotMatch(migration,/create policy[^;]+auth\.uid\(\) is not null/is);
  assert.match(migration,/profile_role\(\(select auth\.uid\(\)\)\) not in \('Admin','Manager'\)/);
  assert.match(migration,/revoke all on function public\.approve_firm_candidate/);
});

test("Admin invitation authenticates and checks the database role before service access",()=>{
  assert.match(invite,/auth\.getUser/);assert.match(invite,/profile\?\.role!=="Admin"/);assert.match(invite,/inviteUserByEmail/);assert.doesNotMatch(invite,/NEXT_PUBLIC.*SERVICE|service.role/i);
});

test("the final active administrator cannot be demoted, disabled, or deleted",()=>{
  assert.match(adminGuard,/old\.role='Admin'/);assert.match(adminGuard,/tg_op='DELETE'/);assert.match(adminGuard,/At least one active administrator is required/);
});

test("UI exposes personal work, administration, territory filters and ownership warnings",()=>{
  for(const label of ["My Work","Admin","All territories","Assigned to me","Unassigned","Assigned to"])assert.match(network,new RegExp(label));
  for(const label of ["Invite a user","Territory access","Assign firms"])assert.match(admin,new RegExp(label));
});

test("duplicate merge preserves trusted fields and copies only accepted staged research",()=>{
  assert.match(mergeMigration,/coalesce\(nullif\(f\.website,''\),c\.website\)/);assert.match(mergeMigration,/review_status='Accepted'/);assert.match(mergeMigration,/selected_for_approval/);assert.match(mergeMigration,/candidate_merged/);assert.match(mergeMigration,/profile_role\(\(select auth\.uid\(\)\)\) not in \('Admin','Manager'\)/);
});

test("provider adapters expose Google, Firecrawl, Apollo, and future Lusha capabilities without browser keys",()=>{
  for(const provider of ["google-places","firecrawl","apollo","lusha"])assert.match(adapters,new RegExp(provider));
  assert.match(adapters,/GooglePlacesAdapter/);assert.match(adapters,/ApolloAdapter/);assert.doesNotMatch(adapters,/NEXT_PUBLIC_(?:GOOGLE|APOLLO|LUSHA|FIRECRAWL)/);
});
