create schema if not exists private;
revoke all on schema private from public, anon;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text not null unique,
  role text not null default 'Rep' check (role in ('Admin','Manager','Rep','Researcher')),
  is_active boolean not null default true,
  manager_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.territories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  region text not null,
  state text not null default 'TX',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_territories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  territory_id uuid not null references public.territories(id) on delete cascade,
  access_level text not null default 'View' check (access_level in ('View','Work','Manage')),
  created_at timestamptz not null default now(),
  unique (user_id, territory_id)
);

insert into public.profiles(id, full_name, email, role, is_active, created_at, updated_at)
select u.id,
  nullif(coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name'), ''),
  coalesce(u.email, u.id::text || '@unknown.invalid'),
  case when u.id = (select id from auth.users where deleted_at is null order by created_at, id limit 1) then 'Admin' else 'Rep' end,
  u.deleted_at is null,
  coalesce(u.created_at, now()), now()
from auth.users u
on conflict (id) do nothing;

insert into public.territories(name, region) values
  ('San Antonio','South Central Texas'),
  ('New Braunfels / Seguin','South Central Texas'),
  ('Hill Country','Hill Country'),
  ('Corpus Christi / Coastal Bend','Coastal Bend'),
  ('Laredo','South Texas'),
  ('Rio Grande Valley','South Texas'),
  ('Midland / Odessa','West Texas')
on conflict (name) do nothing;

insert into public.user_territories(user_id, territory_id, access_level)
select p.id, t.id, case when p.role='Admin' then 'Manage' else 'View' end
from public.profiles p cross join public.territories t
on conflict (user_id, territory_id) do nothing;

alter table public.firms
  add column territory_id uuid references public.territories(id) on delete set null,
  add column assigned_user_id uuid references public.profiles(id) on delete set null,
  add column assigned_at timestamptz,
  add column assignment_status text not null default 'Unassigned'
    check (assignment_status in ('Unassigned','Assigned','Working','On Hold','Closed')),
  add column record_visibility text not null default 'Territory'
    check (record_visibility in ('Private','Territory','Organization')),
  add column created_by_user_id uuid references public.profiles(id) on delete set null,
  add column discovered_by_user_id uuid references public.profiles(id) on delete set null;

alter table public.discovery_jobs
  add column created_by_user_id uuid references public.profiles(id) on delete set null,
  add column territory_id uuid references public.territories(id) on delete set null,
  add column visibility text not null default 'Private'
    check (visibility in ('Private','Territory','Organization'));

alter table public.firm_candidates
  add column created_by_user_id uuid references public.profiles(id) on delete set null,
  add column territory_id uuid references public.territories(id) on delete set null,
  add column visibility text not null default 'Private'
    check (visibility in ('Private','Territory','Organization'));

alter table public.import_batches
  add column created_by_user_id uuid references public.profiles(id) on delete set null,
  add column territory_id uuid references public.territories(id) on delete set null,
  add column visibility text not null default 'Private'
    check (visibility in ('Private','Territory','Organization'));

alter table public.research_evidence
  add column created_by_user_id uuid references public.profiles(id) on delete set null,
  add column visibility text not null default 'Territory'
    check (visibility in ('Private','Territory','Organization'));

alter table public.outreach
  add column created_by_user_id uuid references public.profiles(id) on delete set null,
  add column note_visibility text not null default 'Private'
    check (note_visibility in ('Private','Territory','Organization'));

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  entity_type text not null,
  entity_id uuid,
  territory_id uuid references public.territories(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index profiles_role_active_idx on public.profiles(role, is_active);
create index profiles_manager_idx on public.profiles(manager_user_id) where manager_user_id is not null;
create index user_territories_user_idx on public.user_territories(user_id, access_level, territory_id);
create index user_territories_territory_idx on public.user_territories(territory_id, access_level, user_id);
create index firms_territory_idx on public.firms(territory_id, total_partner_score desc);
create index firms_assigned_user_idx on public.firms(assigned_user_id, assignment_status);
create index firms_visibility_idx on public.firms(record_visibility, territory_id);
create index discovery_jobs_owner_visibility_idx on public.discovery_jobs(created_by_user_id, visibility, territory_id);
create index firm_candidates_owner_visibility_idx on public.firm_candidates(created_by_user_id, visibility, territory_id);
create index import_batches_owner_visibility_idx on public.import_batches(created_by_user_id, visibility, territory_id);
create index research_evidence_owner_visibility_idx on public.research_evidence(created_by_user_id, visibility, firm_id);
create index outreach_owner_visibility_idx on public.outreach(created_by_user_id, note_visibility, firm_id);
create index audit_log_actor_idx on public.audit_log(actor_user_id, created_at desc);
create index audit_log_entity_idx on public.audit_log(entity_type, entity_id, created_at desc);
create index audit_log_territory_idx on public.audit_log(territory_id, created_at desc);

create or replace function private.profile_role(p_user_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id=p_user_id and is_active
$$;

create or replace function private.is_active_user()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id=(select auth.uid()) and is_active)
$$;

create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(private.profile_role((select auth.uid()))='Admin',false)
$$;

create or replace function private.access_rank(p_level text)
returns integer language sql immutable set search_path = '' as $$
  select case p_level when 'Manage' then 3 when 'Work' then 2 when 'View' then 1 else 0 end
$$;

create or replace function private.user_has_territory_access(p_territory_id uuid, p_minimum text default 'View')
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_admin() or exists(
    select 1 from public.user_territories ut
    join public.profiles p on p.id=ut.user_id and p.is_active
    join public.territories t on t.id=ut.territory_id and t.is_active
    where ut.user_id=(select auth.uid()) and ut.territory_id=p_territory_id
      and private.access_rank(ut.access_level)>=private.access_rank(p_minimum)
  )
$$;

create or replace function private.user_can_manage_territory(p_territory_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_admin() or (
    private.profile_role((select auth.uid()))='Manager'
    and private.user_has_territory_access(p_territory_id,'Manage')
  )
$$;

create or replace function private.manager_can_view_user(p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_admin() or exists(
    select 1 from public.profiles p
    where p.id=p_user_id and p.manager_user_id=(select auth.uid())
      and private.profile_role((select auth.uid()))='Manager'
  ) or exists(
    select 1 from public.user_territories mine
    join public.user_territories theirs on theirs.territory_id=mine.territory_id
    where mine.user_id=(select auth.uid()) and theirs.user_id=p_user_id
      and mine.access_level='Manage'
      and private.profile_role((select auth.uid()))='Manager'
  )
$$;

create or replace function private.territory_for_region(p_region text)
returns uuid language sql stable security definer set search_path = '' as $$
  select id from public.territories
  where name = case
    when p_region='San Antonio' then 'San Antonio'
    when p_region in ('New Braunfels / Seguin','New Braunfels','Seguin','Central Texas') then 'New Braunfels / Seguin'
    when p_region='Hill Country' then 'Hill Country'
    when p_region in ('Coastal Bend','Corpus Christi','Crossroads') then 'Corpus Christi / Coastal Bend'
    when p_region='Laredo' then 'Laredo'
    when p_region='Rio Grande Valley' then 'Rio Grande Valley'
    when p_region in ('West Texas','Midland / Odessa','Far West Texas') then 'Midland / Odessa'
    else null end
  limit 1
$$;

create or replace function private.can_view_firm(p_firm_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_active_user() and exists(
    select 1 from public.firms f where f.id=p_firm_id and (
      private.is_admin()
      or f.record_visibility='Organization'
      or f.assigned_user_id=(select auth.uid())
      or f.created_by_user_id=(select auth.uid())
      or f.discovered_by_user_id=(select auth.uid())
      or (f.record_visibility='Territory' and private.user_has_territory_access(f.territory_id,'View'))
      or (f.record_visibility='Private' and private.manager_can_view_user(coalesce(f.assigned_user_id,f.created_by_user_id))
        and private.user_can_manage_territory(f.territory_id))
    )
  )
$$;

create or replace function private.can_work_firm(p_firm_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_active_user() and exists(
    select 1 from public.firms f where f.id=p_firm_id and (
      private.is_admin()
      or private.user_can_manage_territory(f.territory_id)
      or (private.profile_role((select auth.uid()))='Rep'
        and private.can_view_firm(f.id) and private.user_has_territory_access(f.territory_id,'Work'))
      or (private.profile_role((select auth.uid()))='Researcher'
        and private.can_view_firm(f.id) and private.user_has_territory_access(f.territory_id,'Work'))
    )
  )
$$;

create or replace function private.can_edit_firm(p_firm_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_active_user() and exists(
    select 1 from public.firms f where f.id=p_firm_id and (
      private.is_admin()
      or private.user_can_manage_territory(f.territory_id)
      or (private.profile_role((select auth.uid()))='Rep' and f.assigned_user_id=(select auth.uid())
        and private.user_has_territory_access(f.territory_id,'Work'))
      or (f.record_visibility='Private' and f.created_by_user_id=(select auth.uid()))
    )
  )
$$;

create or replace function private.can_view_discovery_job(p_job_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_active_user() and exists(
    select 1 from public.discovery_jobs j where j.id=p_job_id and (
      private.is_admin() or j.created_by_user_id=(select auth.uid()) or j.requested_by=(select auth.uid())
      or j.visibility='Organization'
      or (j.visibility='Territory' and private.user_has_territory_access(j.territory_id,'View'))
      or (j.visibility='Private' and private.manager_can_view_user(j.created_by_user_id)
        and private.user_can_manage_territory(j.territory_id))
    )
  )
$$;

create or replace function private.can_edit_discovery_job(p_job_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_active_user() and exists(
    select 1 from public.discovery_jobs j where j.id=p_job_id and (
      private.is_admin() or j.created_by_user_id=(select auth.uid()) or j.requested_by=(select auth.uid())
      or private.user_can_manage_territory(j.territory_id)
    )
  )
$$;

create or replace function private.can_view_candidate(p_candidate_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_active_user() and exists(
    select 1 from public.firm_candidates c where c.id=p_candidate_id and (
      private.is_admin() or c.created_by_user_id=(select auth.uid())
      or c.visibility='Organization'
      or (c.visibility='Territory' and private.user_has_territory_access(c.territory_id,'View'))
      or (c.visibility='Private' and private.manager_can_view_user(c.created_by_user_id)
        and private.user_can_manage_territory(c.territory_id))
    )
  )
$$;

create or replace function private.can_edit_candidate(p_candidate_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_active_user() and exists(
    select 1 from public.firm_candidates c where c.id=p_candidate_id and (
      private.is_admin() or c.created_by_user_id=(select auth.uid())
      or private.user_can_manage_territory(c.territory_id)
    )
  )
$$;

create or replace function public.current_user_role()
returns text language sql stable set search_path = '' as $$ select private.profile_role((select auth.uid())) $$;
create or replace function public.is_admin()
returns boolean language sql stable set search_path = '' as $$ select private.is_admin() $$;
create or replace function public.user_has_territory_access(p_territory_id uuid)
returns boolean language sql stable set search_path = '' as $$ select private.user_has_territory_access(p_territory_id,'View') $$;
create or replace function public.user_can_manage_territory(p_territory_id uuid)
returns boolean language sql stable set search_path = '' as $$ select private.user_can_manage_territory(p_territory_id) $$;
create or replace function public.can_view_firm(p_firm_id uuid)
returns boolean language sql stable set search_path = '' as $$ select private.can_view_firm(p_firm_id) $$;
create or replace function public.can_edit_firm(p_firm_id uuid)
returns boolean language sql stable set search_path = '' as $$ select private.can_edit_firm(p_firm_id) $$;

create or replace function private.prepare_access_fields()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name='firms' then
    if new.territory_id is null then new.territory_id:=private.territory_for_region(new.region); end if;
    if new.created_by_user_id is null then new.created_by_user_id:=(select auth.uid()); end if;
    if new.discovered_by_user_id is null then new.discovered_by_user_id:=new.created_by_user_id; end if;
    if new.assigned_user_id is null then
      new.assignment_status:='Unassigned'; new.assigned_at:=null;
    elsif tg_op='INSERT' or old.assigned_user_id is distinct from new.assigned_user_id then
      new.assigned_at:=now();
      if new.assignment_status='Unassigned' then new.assignment_status:='Assigned'; end if;
    end if;
  elsif tg_table_name='discovery_jobs' then
    if new.created_by_user_id is null then new.created_by_user_id:=coalesce(new.requested_by,(select auth.uid())); end if;
    if new.requested_by is null then new.requested_by:=new.created_by_user_id; end if;
    if new.territory_id is null then new.territory_id:=private.territory_for_region(new.region); end if;
  elsif tg_table_name='firm_candidates' then
    if new.created_by_user_id is null and new.discovery_job_id is not null then
      select created_by_user_id,territory_id,visibility into new.created_by_user_id,new.territory_id,new.visibility
      from public.discovery_jobs where id=new.discovery_job_id;
    end if;
    if new.created_by_user_id is null then new.created_by_user_id:=(select auth.uid()); end if;
    if new.territory_id is null then new.territory_id:=private.territory_for_region(new.region); end if;
  elsif tg_table_name='import_batches' then
    if new.created_by_user_id is null then new.created_by_user_id:=coalesce(new.imported_by,(select auth.uid())); end if;
  elsif tg_table_name='research_evidence' then
    if new.created_by_user_id is null then new.created_by_user_id:=(select auth.uid()); end if;
  elsif tg_table_name='outreach' then
    if new.created_by_user_id is null then new.created_by_user_id:=(select auth.uid()); end if;
  end if;
  return new;
end
$$;

create trigger firms_access_defaults before insert or update of region,territory_id,assigned_user_id,assignment_status on public.firms for each row execute function private.prepare_access_fields();
create trigger discovery_jobs_access_defaults before insert or update of region,territory_id,requested_by on public.discovery_jobs for each row execute function private.prepare_access_fields();
create trigger firm_candidates_access_defaults before insert or update of discovery_job_id,region,territory_id on public.firm_candidates for each row execute function private.prepare_access_fields();
create trigger import_batches_access_defaults before insert on public.import_batches for each row execute function private.prepare_access_fields();
create trigger research_evidence_access_defaults before insert on public.research_evidence for each row execute function private.prepare_access_fields();
create trigger outreach_access_defaults before insert on public.outreach for each row execute function private.prepare_access_fields();

create or replace function private.sync_auth_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id,full_name,email,role,is_active,created_at,updated_at)
  values(new.id,nullif(coalesce(new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'name'),''),coalesce(new.email,new.id::text||'@unknown.invalid'),'Rep',new.deleted_at is null,coalesce(new.created_at,now()),now())
  on conflict(id) do update set email=excluded.email,is_active=excluded.is_active,updated_at=now();
  return new;
end
$$;
create trigger auth_users_sync_profile after insert or update of email,deleted_at on auth.users for each row execute function private.sync_auth_profile();

update public.firms f set
  territory_id=private.territory_for_region(f.region),
  created_by_user_id=coalesce(f.created_by_user_id,(select id from public.profiles where role='Admin' order by created_at,id limit 1)),
  discovered_by_user_id=coalesce(f.discovered_by_user_id,(select id from public.profiles where role='Admin' order by created_at,id limit 1)),
  record_visibility='Territory';

update public.discovery_jobs j set
  created_by_user_id=coalesce(j.requested_by,(select id from public.profiles where role='Admin' order by created_at,id limit 1)),
  requested_by=coalesce(j.requested_by,(select id from public.profiles where role='Admin' order by created_at,id limit 1)),
  territory_id=private.territory_for_region(j.region), visibility='Private';

update public.firm_candidates c set
  created_by_user_id=coalesce((select j.created_by_user_id from public.discovery_jobs j where j.id=c.discovery_job_id),(select id from public.profiles where role='Admin' order by created_at,id limit 1)),
  territory_id=coalesce((select j.territory_id from public.discovery_jobs j where j.id=c.discovery_job_id),private.territory_for_region(c.region)),
  visibility='Private';

update public.import_batches b set created_by_user_id=coalesce(b.imported_by,(select id from public.profiles where role='Admin' order by created_at,id limit 1));
update public.research_evidence e set created_by_user_id=coalesce(e.created_by_user_id,(select created_by_user_id from public.firms f where f.id=e.firm_id));
update public.outreach o set created_by_user_id=coalesce(o.created_by_user_id,(select created_by_user_id from public.firms f where f.id=o.firm_id));

alter table public.profiles enable row level security;
alter table public.territories enable row level security;
alter table public.user_territories enable row level security;
alter table public.audit_log enable row level security;

grant usage on schema private to authenticated;
grant select,insert,update,delete on public.profiles,public.territories,public.user_territories,public.audit_log to authenticated;
revoke all on public.profiles,public.territories,public.user_territories,public.audit_log from anon;

revoke all on all functions in schema private from public, anon;
grant execute on function private.profile_role(uuid),private.is_active_user(),private.is_admin(),private.access_rank(text),private.user_has_territory_access(uuid,text),private.user_can_manage_territory(uuid),private.manager_can_view_user(uuid),private.territory_for_region(text),private.can_view_firm(uuid),private.can_work_firm(uuid),private.can_edit_firm(uuid),private.can_view_discovery_job(uuid),private.can_edit_discovery_job(uuid),private.can_view_candidate(uuid),private.can_edit_candidate(uuid) to authenticated;
revoke all on function public.current_user_role(),public.is_admin(),public.user_has_territory_access(uuid),public.user_can_manage_territory(uuid),public.can_view_firm(uuid),public.can_edit_firm(uuid) from public,anon;
grant execute on function public.current_user_role(),public.is_admin(),public.user_has_territory_access(uuid),public.user_can_manage_territory(uuid),public.can_view_firm(uuid),public.can_edit_firm(uuid) to authenticated;

create policy "profiles visible by relationship" on public.profiles for select to authenticated
using (id=(select auth.uid()) or (private.is_active_user() and (private.is_admin() or private.manager_can_view_user(id))));
create policy "admins manage profiles" on public.profiles for all to authenticated
using (private.is_admin()) with check (private.is_admin());

create policy "assigned territories are visible" on public.territories for select to authenticated
using (private.is_active_user() and (private.is_admin() or private.user_has_territory_access(id,'View')));
create policy "territory managers update territories" on public.territories for update to authenticated
using (private.user_can_manage_territory(id)) with check (private.user_can_manage_territory(id));
create policy "admins create territories" on public.territories for insert to authenticated with check (private.is_admin());
create policy "admins delete territories" on public.territories for delete to authenticated using (private.is_admin());

create policy "territory assignments visible by relationship" on public.user_territories for select to authenticated
using (private.is_active_user() and (user_id=(select auth.uid()) or private.is_admin() or private.manager_can_view_user(user_id)));
create policy "territory managers create assignments" on public.user_territories for insert to authenticated
with check (private.is_admin() or private.user_can_manage_territory(territory_id));
create policy "territory managers update assignments" on public.user_territories for update to authenticated
using (private.is_admin() or private.user_can_manage_territory(territory_id))
with check (private.is_admin() or private.user_can_manage_territory(territory_id));
create policy "territory managers delete assignments" on public.user_territories for delete to authenticated
using (private.is_admin() or private.user_can_manage_territory(territory_id));

drop policy if exists "internal firms" on public.firms;
create policy "visible firms" on public.firms for select to authenticated using (private.can_view_firm(id));
create policy "authorized firm creation" on public.firms for insert to authenticated with check (
  private.is_active_user() and created_by_user_id=(select auth.uid()) and (
    private.is_admin() or record_visibility='Private' or private.user_has_territory_access(territory_id,'Work'))
);
create policy "authorized firm updates" on public.firms for update to authenticated
using (private.can_edit_firm(id)) with check (private.can_edit_firm(id));
create policy "admins delete firms" on public.firms for delete to authenticated using (private.is_admin());

drop policy if exists "internal contacts" on public.contacts;
create policy "contacts inherit firm visibility" on public.contacts for select to authenticated using (private.can_view_firm(firm_id));
create policy "authorized contact creation" on public.contacts for insert to authenticated with check (private.can_work_firm(firm_id));
create policy "authorized contact updates" on public.contacts for update to authenticated using (private.can_work_firm(firm_id)) with check (private.can_work_firm(firm_id));
create policy "managers delete contacts" on public.contacts for delete to authenticated using (private.is_admin() or private.user_can_manage_territory((select territory_id from public.firms where id=firm_id)));

drop policy if exists "internal outreach" on public.outreach;
create policy "authorized outreach history" on public.outreach for select to authenticated using (
  private.can_view_firm(firm_id) and (created_by_user_id=(select auth.uid()) or note_visibility<>'Private' or private.is_admin()
    or private.user_can_manage_territory((select territory_id from public.firms where id=firm_id)))
);
create policy "authorized outreach creation" on public.outreach for insert to authenticated
with check (created_by_user_id=(select auth.uid()) and private.can_work_firm(firm_id));
create policy "outreach owners update" on public.outreach for update to authenticated
using (created_by_user_id=(select auth.uid()) or private.is_admin() or private.user_can_manage_territory((select territory_id from public.firms where id=firm_id)))
with check (created_by_user_id=(select auth.uid()) or private.is_admin() or private.user_can_manage_territory((select territory_id from public.firms where id=firm_id)));
create policy "outreach owners delete" on public.outreach for delete to authenticated
using (created_by_user_id=(select auth.uid()) or private.is_admin() or private.user_can_manage_territory((select territory_id from public.firms where id=firm_id)));

drop policy if exists "internal discovery jobs" on public.discovery_jobs;
drop policy if exists "authenticated staff read discovery jobs" on public.discovery_jobs;
drop policy if exists "staff create owned discovery jobs" on public.discovery_jobs;
drop policy if exists "staff update owned discovery jobs" on public.discovery_jobs;
drop policy if exists "staff delete owned discovery jobs" on public.discovery_jobs;
create policy "visible discovery jobs" on public.discovery_jobs for select to authenticated using (private.can_view_discovery_job(id));
create policy "users create private discovery jobs" on public.discovery_jobs for insert to authenticated
with check (private.is_active_user() and created_by_user_id=(select auth.uid()) and requested_by=(select auth.uid()) and (territory_id is null or private.user_has_territory_access(territory_id,'Work')));
create policy "owners update discovery jobs" on public.discovery_jobs for update to authenticated
using (private.can_edit_discovery_job(id)) with check (private.can_edit_discovery_job(id));
create policy "owners delete discovery jobs" on public.discovery_jobs for delete to authenticated using (private.can_edit_discovery_job(id));

drop policy if exists "authenticated staff read discovery queries" on public.discovery_job_queries;
drop policy if exists "staff create owned discovery queries" on public.discovery_job_queries;
drop policy if exists "staff update owned discovery queries" on public.discovery_job_queries;
drop policy if exists "staff delete owned discovery queries" on public.discovery_job_queries;
create policy "visible discovery queries" on public.discovery_job_queries for select to authenticated using (private.can_view_discovery_job(job_id));
create policy "owners create discovery queries" on public.discovery_job_queries for insert to authenticated with check (private.can_edit_discovery_job(job_id));
create policy "owners update discovery queries" on public.discovery_job_queries for update to authenticated using (private.can_edit_discovery_job(job_id)) with check (private.can_edit_discovery_job(job_id));
create policy "owners delete discovery queries" on public.discovery_job_queries for delete to authenticated using (private.can_edit_discovery_job(job_id));

drop policy if exists "internal candidates" on public.firm_candidates;
create policy "visible firm candidates" on public.firm_candidates for select to authenticated using (private.can_view_candidate(id));
create policy "users create private candidates" on public.firm_candidates for insert to authenticated
with check (private.is_active_user() and created_by_user_id=(select auth.uid()) and (territory_id is null or private.user_has_territory_access(territory_id,'Work')));
create policy "owners update firm candidates" on public.firm_candidates for update to authenticated
using (private.can_edit_candidate(id)) with check (private.can_edit_candidate(id));
create policy "owners delete firm candidates" on public.firm_candidates for delete to authenticated using (private.can_edit_candidate(id));

drop policy if exists "authenticated staff read candidate contacts" on public.candidate_contacts;
drop policy if exists "authenticated staff create candidate contacts" on public.candidate_contacts;
drop policy if exists "authenticated staff update candidate contacts" on public.candidate_contacts;
drop policy if exists "authenticated staff delete candidate contacts" on public.candidate_contacts;
create policy "candidate contacts inherit visibility" on public.candidate_contacts for select to authenticated using (private.can_view_candidate(firm_candidate_id));
create policy "candidate owners create contacts" on public.candidate_contacts for insert to authenticated with check (private.can_edit_candidate(firm_candidate_id));
create policy "candidate owners update contacts" on public.candidate_contacts for update to authenticated using (private.can_edit_candidate(firm_candidate_id)) with check (private.can_edit_candidate(firm_candidate_id));
create policy "candidate owners delete contacts" on public.candidate_contacts for delete to authenticated using (private.can_edit_candidate(firm_candidate_id));

drop policy if exists "authenticated staff read research runs" on public.candidate_research_runs;
create policy "research runs inherit candidate visibility" on public.candidate_research_runs for select to authenticated using (private.can_view_candidate(firm_candidate_id));
create policy "candidate owners queue research" on public.candidate_research_runs for insert to authenticated with check (requested_by=(select auth.uid()) and private.can_edit_candidate(firm_candidate_id));
create policy "candidate owners update research runs" on public.candidate_research_runs for update to authenticated using (private.can_edit_candidate(firm_candidate_id)) with check (private.can_edit_candidate(firm_candidate_id));

drop policy if exists "authenticated staff read research findings" on public.candidate_research_findings;
create policy "research findings inherit candidate visibility" on public.candidate_research_findings for select to authenticated using (private.can_view_candidate(firm_candidate_id));
create policy "candidate reviewers update findings" on public.candidate_research_findings for update to authenticated
using (private.can_edit_candidate(firm_candidate_id)) with check (private.can_edit_candidate(firm_candidate_id));

drop policy if exists "internal import batches" on public.import_batches;
create policy "visible import batches" on public.import_batches for select to authenticated using (
  private.is_active_user() and (private.is_admin() or created_by_user_id=(select auth.uid()) or visibility='Organization'
    or (visibility='Territory' and private.user_has_territory_access(territory_id,'View'))
    or (visibility='Private' and private.manager_can_view_user(created_by_user_id) and private.user_can_manage_territory(territory_id)))
);
create policy "users create import batches" on public.import_batches for insert to authenticated
with check (private.is_active_user() and created_by_user_id=(select auth.uid()) and imported_by=(select auth.uid()));
create policy "owners update import batches" on public.import_batches for update to authenticated
using (created_by_user_id=(select auth.uid()) or private.is_admin() or private.user_can_manage_territory(territory_id))
with check (created_by_user_id=(select auth.uid()) or private.is_admin() or private.user_can_manage_territory(territory_id));
create policy "owners delete import batches" on public.import_batches for delete to authenticated
using (created_by_user_id=(select auth.uid()) or private.is_admin());

drop policy if exists "internal research evidence" on public.research_evidence;
create policy "visible research evidence" on public.research_evidence for select to authenticated using (
  private.can_view_firm(firm_id) and (created_by_user_id=(select auth.uid()) or visibility<>'Private' or private.is_admin()
    or private.user_can_manage_territory((select territory_id from public.firms where id=firm_id)))
);
create policy "authorized research evidence creation" on public.research_evidence for insert to authenticated
with check (created_by_user_id=(select auth.uid()) and private.can_work_firm(firm_id));
create policy "evidence owners update" on public.research_evidence for update to authenticated
using (created_by_user_id=(select auth.uid()) or private.is_admin() or private.user_can_manage_territory((select territory_id from public.firms where id=firm_id)))
with check (created_by_user_id=(select auth.uid()) or private.is_admin() or private.user_can_manage_territory((select territory_id from public.firms where id=firm_id)));
create policy "evidence owners delete" on public.research_evidence for delete to authenticated
using (created_by_user_id=(select auth.uid()) or private.is_admin() or private.user_can_manage_territory((select territory_id from public.firms where id=firm_id)));

drop policy if exists "internal tags" on public.tags;
create policy "active users read tags" on public.tags for select to authenticated using (private.is_active_user());
create policy "admins manage tags" on public.tags for all to authenticated using (private.is_admin()) with check (private.is_admin());
drop policy if exists "internal firm tags" on public.firm_tags;
create policy "firm tags inherit firm visibility" on public.firm_tags for select to authenticated using (private.can_view_firm(firm_id));
create policy "authorized firm tag creation" on public.firm_tags for insert to authenticated with check (private.can_edit_firm(firm_id));
create policy "authorized firm tag deletion" on public.firm_tags for delete to authenticated using (private.can_edit_firm(firm_id));

create policy "audit visible by relationship" on public.audit_log for select to authenticated using (
  private.is_admin() or actor_user_id=(select auth.uid())
  or (territory_id is not null and private.user_can_manage_territory(territory_id))
);

create or replace function private.write_audit_event(p_event text,p_entity text,p_entity_id uuid,p_territory_id uuid,p_metadata jsonb default '{}'::jsonb)
returns void language sql volatile security definer set search_path = '' as $$
  insert into public.audit_log(actor_user_id,event_type,entity_type,entity_id,territory_id,metadata)
  values((select auth.uid()),p_event,p_entity,p_entity_id,p_territory_id,coalesce(p_metadata,'{}'::jsonb))
$$;
revoke all on function private.write_audit_event(text,text,uuid,uuid,jsonb) from public,anon,authenticated;

create or replace function private.audit_firm_changes()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op='INSERT' then
    perform private.write_audit_event('firm_created','firm',new.id,new.territory_id,jsonb_build_object('visibility',new.record_visibility,'assigned_user_id',new.assigned_user_id));
  else
    if old.assigned_user_id is distinct from new.assigned_user_id then
      perform private.write_audit_event(case when old.assigned_user_id is null then 'firm_assigned' else 'firm_reassigned' end,'firm',new.id,new.territory_id,jsonb_build_object('from',old.assigned_user_id,'to',new.assigned_user_id));
    end if;
    if old.territory_id is distinct from new.territory_id then perform private.write_audit_event('territory_changed','firm',new.id,new.territory_id,jsonb_build_object('from',old.territory_id,'to',new.territory_id)); end if;
    if old.record_visibility is distinct from new.record_visibility then perform private.write_audit_event('visibility_changed','firm',new.id,new.territory_id,jsonb_build_object('from',old.record_visibility,'to',new.record_visibility)); end if;
  end if;
  return new;
end
$$;
create trigger firms_audit after insert or update of assigned_user_id,territory_id,record_visibility on public.firms for each row execute function private.audit_firm_changes();

create or replace function private.audit_candidate_changes()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.review_status is distinct from new.review_status and new.review_status in ('Approved','Rejected') then
    perform private.write_audit_event(case when new.review_status='Approved' then 'candidate_approved' else 'candidate_rejected' end,'firm_candidate',new.id,new.territory_id,jsonb_build_object('resulting_firm_id',new.resulting_firm_id,'created_by_user_id',new.created_by_user_id));
  end if;
  return new;
end
$$;
create trigger firm_candidates_audit after update of review_status on public.firm_candidates for each row execute function private.audit_candidate_changes();

create or replace function private.promote_candidate_access()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.review_status='Approved' and new.resulting_firm_id is not null and (old.resulting_firm_id is distinct from new.resulting_firm_id) then
    update public.firms set territory_id=coalesce(new.territory_id,territory_id),record_visibility='Territory',created_by_user_id=coalesce(created_by_user_id,new.created_by_user_id),discovered_by_user_id=coalesce(new.created_by_user_id,discovered_by_user_id)
    where id=new.resulting_firm_id;
  end if;
  return new;
end
$$;
create trigger firm_candidates_promote_access after update of review_status,resulting_firm_id on public.firm_candidates for each row execute function private.promote_candidate_access();

alter function public.approve_firm_candidate(uuid) set schema private;
revoke all on function private.approve_firm_candidate(uuid) from public,anon,authenticated;
create or replace function public.approve_firm_candidate(candidate_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare territory uuid;
begin
  if not private.is_active_user() then raise exception 'Authentication required'; end if;
  select territory_id into territory from public.firm_candidates where id=candidate_id;
  if private.profile_role((select auth.uid())) not in ('Admin','Manager') then raise exception 'Manager access required'; end if;
  if not private.is_admin() and not private.user_can_manage_territory(territory) then raise exception 'Territory management access required'; end if;
  return private.approve_firm_candidate(candidate_id);
end
$$;
revoke all on function public.approve_firm_candidate(uuid) from public,anon;
grant execute on function public.approve_firm_candidate(uuid) to authenticated;

create or replace function public.assign_firms(p_firm_ids uuid[],p_assigned_user_id uuid,p_assignment_status text default 'Assigned')
returns integer language plpgsql security invoker set search_path = '' as $$
declare changed integer;
begin
  if not private.is_active_user() or private.profile_role((select auth.uid())) not in ('Admin','Manager') then raise exception 'Manager access required'; end if;
  if p_assignment_status not in ('Unassigned','Assigned','Working','On Hold','Closed') then raise exception 'Invalid assignment status'; end if;
  if p_assigned_user_id is not null and not exists(select 1 from public.profiles where id=p_assigned_user_id and is_active) then raise exception 'Assigned user is unavailable'; end if;
  update public.firms f set assigned_user_id=p_assigned_user_id,
    assignment_status=case when p_assigned_user_id is null then 'Unassigned' else p_assignment_status end
  where f.id=any(p_firm_ids)
    and (private.is_admin() or private.user_can_manage_territory(f.territory_id))
    and (p_assigned_user_id is null or private.is_admin() or exists(select 1 from public.user_territories ut where ut.user_id=p_assigned_user_id and ut.territory_id=f.territory_id));
  get diagnostics changed=row_count;
  return changed;
end
$$;
revoke all on function public.assign_firms(uuid[],uuid,text) from public,anon;
grant execute on function public.assign_firms(uuid[],uuid,text) to authenticated;

grant select,insert,update,delete on public.firms,public.contacts,public.outreach,public.discovery_jobs,public.discovery_job_queries,public.firm_candidates,public.candidate_contacts,public.candidate_research_runs,public.candidate_research_findings,public.import_batches,public.research_evidence,public.tags,public.firm_tags to authenticated;
revoke all on public.firms,public.contacts,public.outreach,public.discovery_jobs,public.discovery_job_queries,public.firm_candidates,public.candidate_contacts,public.candidate_research_runs,public.candidate_research_findings,public.import_batches,public.research_evidence,public.tags,public.firm_tags from anon;

comment on table public.profiles is 'Application roles and active status for Supabase Auth users.';
comment on table public.territories is 'Flexible sales and research territories.';
comment on table public.user_territories is 'Territory access assignments with View, Work, or Manage permission.';
comment on table public.audit_log is 'Immutable audit history for access-sensitive prospect changes.';
