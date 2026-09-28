drop policy if exists "visible firm candidates" on public.firm_candidates;

create policy "visible firm candidates"
on public.firm_candidates
for select
to authenticated
using (
  private.is_active_user()
  and (
    private.is_admin()
    or created_by_user_id = (select auth.uid())
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

comment on policy "visible firm candidates" on public.firm_candidates is
  'Evaluates the current row directly so INSERT ... ON CONFLICT ... RETURNING works without a self-query visibility race.';
