drop policy if exists "visible discovery jobs" on public.discovery_jobs;

create policy "visible discovery jobs"
on public.discovery_jobs
for select
to authenticated
using (
  private.is_active_user()
  and (
    private.is_admin()
    or created_by_user_id = (select auth.uid())
    or requested_by = (select auth.uid())
    or visibility = 'Organization'
    or (
      visibility = 'Territory'
      and private.user_has_territory_access(territory_id, 'View')
    )
    or (
      visibility = 'Private'
      and private.manager_can_view_user(created_by_user_id)
      and private.user_can_manage_territory(territory_id)
    )
  )
);

comment on policy "visible discovery jobs" on public.discovery_jobs is
  'Evaluates the current row directly so INSERT ... RETURNING works without a self-query visibility race.';
