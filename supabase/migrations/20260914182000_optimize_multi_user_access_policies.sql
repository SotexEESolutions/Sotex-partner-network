create index discovery_jobs_territory_idx on public.discovery_jobs(territory_id) where territory_id is not null;
create index firm_candidates_territory_idx on public.firm_candidates(territory_id) where territory_id is not null;
create index firms_created_by_user_idx on public.firms(created_by_user_id) where created_by_user_id is not null;
create index firms_discovered_by_user_idx on public.firms(discovered_by_user_id) where discovered_by_user_id is not null;
create index import_batches_territory_idx on public.import_batches(territory_id) where territory_id is not null;

drop policy "admins manage profiles" on public.profiles;
create policy "admins create profiles" on public.profiles for insert to authenticated with check (private.is_admin());
create policy "admins update profiles" on public.profiles for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "admins delete profiles" on public.profiles for delete to authenticated using (private.is_admin());

drop policy "admins manage tags" on public.tags;
create policy "admins create tags" on public.tags for insert to authenticated with check (private.is_admin());
create policy "admins update tags" on public.tags for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "admins delete tags" on public.tags for delete to authenticated using (private.is_admin());
