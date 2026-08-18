create type public.candidate_web_research_status as enum ('Not Queued','Queued','Researching','Needs Review','Complete','Failed','Invalid Domain','Daily Limit');
create type public.research_run_status as enum ('Queued','Running','Complete','Failed','Retry');
create type public.finding_review_status as enum ('Pending','Accepted','Rejected');

alter table public.firm_candidates
  add column web_research_status public.candidate_web_research_status not null default 'Not Queued',
  add column web_researched_at timestamptz,
  add column web_research_error_code text;

create table public.candidate_research_runs (
  id uuid primary key default gen_random_uuid(),
  firm_candidate_id uuid not null references public.firm_candidates(id) on delete cascade,
  provider text not null default 'Firecrawl' check (provider = 'Firecrawl'),
  status public.research_run_status not null default 'Queued',
  attempt_count integer not null default 0 check (attempt_count between 0 and 3),
  available_at timestamptz not null default now(), claimed_at timestamptz, started_at timestamptz,
  completed_at timestamptz, provider_requests integer not null default 0 check (provider_requests >= 0),
  provider_credits integer not null default 0 check (provider_credits >= 0),
  pages_visited integer not null default 0 check (pages_visited >= 0), error_code text,
  requested_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index candidate_research_runs_active_unique on public.candidate_research_runs(firm_candidate_id) where status in ('Queued','Running','Retry');
create index candidate_research_runs_queue_idx on public.candidate_research_runs(status,available_at,created_at) where status in ('Queued','Retry');
create index candidate_research_runs_daily_idx on public.candidate_research_runs(started_at) where started_at is not null;

create table public.candidate_research_findings (
  id uuid primary key default gen_random_uuid(), firm_candidate_id uuid not null references public.firm_candidates(id) on delete cascade,
  research_run_id uuid not null references public.candidate_research_runs(id) on delete cascade,
  category text not null check (category in ('Services','Client Focus','Industries','Language','Firm Profile','Contact Details','Important Pages','Partnership','Leadership')),
  attribute_name text not null, proposed_value jsonb not null, source_url text not null,
  source_text text not null check (length(trim(source_text)) > 0), confidence public.confidence_level not null default 'Medium',
  review_status public.finding_review_status not null default 'Pending', reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (research_run_id,attribute_name,source_url,source_text)
);
create index candidate_research_findings_candidate_idx on public.candidate_research_findings(firm_candidate_id,review_status,category,created_at);

alter table public.candidate_research_runs enable row level security;
alter table public.candidate_research_findings enable row level security;
grant select on public.candidate_research_runs to authenticated;
grant select on public.candidate_research_findings to authenticated;
revoke all on public.candidate_research_runs,public.candidate_research_findings from anon;
create policy "authenticated staff read research runs" on public.candidate_research_runs for select to authenticated using ((select auth.uid()) is not null);
create policy "authenticated staff read research findings" on public.candidate_research_findings for select to authenticated using ((select auth.uid()) is not null);
create trigger candidate_research_runs_updated before update on public.candidate_research_runs for each row execute function public.set_updated_at();
create trigger candidate_research_findings_updated before update on public.candidate_research_findings for each row execute function public.set_updated_at();

create schema if not exists private;
revoke all on schema private from public,anon,authenticated;

create or replace function private.enqueue_candidate_web_research() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.review_status in ('New','Needs Review') and coalesce(new.domain,public.normalize_domain(new.website)) is not null then
    insert into public.candidate_research_runs(firm_candidate_id,requested_by) values(new.id,(select auth.uid())) on conflict do nothing;
    update public.firm_candidates set web_research_status='Queued',web_research_error_code=null where id=new.id;
  end if;
  return null;
end $$;
revoke all on function private.enqueue_candidate_web_research() from public,anon,authenticated;
create trigger firm_candidates_queue_web_research after insert on public.firm_candidates for each row execute function private.enqueue_candidate_web_research();

create or replace function public.queue_candidate_web_research(p_candidate_id uuid) returns uuid language plpgsql security invoker set search_path='' as $$
declare run_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.firm_candidates where id=p_candidate_id and review_status in ('New','Needs Review')) then raise exception 'Candidate is not researchable'; end if;
  insert into public.candidate_research_runs(firm_candidate_id,requested_by) values(p_candidate_id,(select auth.uid()))
  on conflict do nothing returning id into run_id;
  if run_id is null then select id into run_id from public.candidate_research_runs where firm_candidate_id=p_candidate_id and status in ('Queued','Running','Retry') order by created_at desc limit 1; end if;
  update public.firm_candidates set web_research_status='Queued',web_research_error_code=null where id=p_candidate_id and web_research_status not in ('Researching');
  return run_id;
end $$;

create or replace function public.backfill_candidate_web_research() returns integer language plpgsql security invoker set search_path='' as $$
declare queued integer;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  insert into public.candidate_research_runs(firm_candidate_id,requested_by)
    select c.id,(select auth.uid()) from public.firm_candidates c
    where c.review_status in ('New','Needs Review') and coalesce(c.domain,public.normalize_domain(c.website)) is not null
      and c.web_research_status in ('Not Queued','Failed','Invalid Domain','Daily Limit')
      and not exists(select 1 from public.candidate_research_runs r where r.firm_candidate_id=c.id and r.status in ('Queued','Running','Retry'));
  get diagnostics queued=row_count;
  update public.firm_candidates set web_research_status='Queued',web_research_error_code=null
    where review_status in ('New','Needs Review') and web_research_status in ('Not Queued','Failed','Invalid Domain','Daily Limit')
      and exists(select 1 from public.candidate_research_runs r where r.firm_candidate_id=firm_candidates.id and r.status='Queued');
  return queued;
end $$;

create or replace function public.claim_candidate_web_research(p_limit integer,p_daily_limit integer)
returns setof public.candidate_research_runs language plpgsql security invoker set search_path='' as $$
declare remaining integer;
begin
  perform pg_advisory_xact_lock(hashtext('candidate_web_research_daily'));
  remaining:=greatest(least(p_limit,p_daily_limit-(select count(*)::integer from public.candidate_research_runs where started_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')),0);
  if remaining=0 then
    update public.firm_candidates c set web_research_status='Daily Limit'
      where c.web_research_status='Queued' and exists(select 1 from public.candidate_research_runs r where r.firm_candidate_id=c.id and r.status in ('Queued','Retry') and r.available_at<=now());
    return;
  end if;
  return query with claimed as (
    select id from public.candidate_research_runs where status in ('Queued','Retry') and available_at<=now() and attempt_count<3
    order by available_at,created_at for update skip locked limit remaining
  ) update public.candidate_research_runs r set status='Running',attempt_count=r.attempt_count+1,claimed_at=now(),started_at=coalesce(r.started_at,now()),error_code=null
    from claimed where r.id=claimed.id returning r.*;
end $$;
revoke all on function public.claim_candidate_web_research(integer,integer) from public,anon,authenticated;
grant execute on function public.claim_candidate_web_research(integer,integer) to service_role;
grant execute on function public.queue_candidate_web_research(uuid),public.backfill_candidate_web_research() to authenticated;

create or replace function public.review_candidate_research_finding(p_finding_id uuid,p_status public.finding_review_status) returns void language plpgsql security invoker set search_path='' as $$
declare candidate_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  update public.candidate_research_findings set review_status=p_status,reviewed_by=(select auth.uid()),reviewed_at=now() where id=p_finding_id returning firm_candidate_id into candidate_id;
  if candidate_id is not null and not exists(select 1 from public.candidate_research_findings where firm_candidate_id=candidate_id and review_status='Pending') then
    update public.firm_candidates set web_research_status='Complete' where id=candidate_id;
  end if;
end $$;
grant execute on function public.review_candidate_research_finding(uuid,public.finding_review_status) to authenticated;

create or replace function public.accept_high_confidence_candidate_findings(p_candidate_id uuid) returns integer language plpgsql security invoker set search_path='' as $$
declare accepted integer;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  update public.candidate_research_findings set review_status='Accepted',reviewed_by=(select auth.uid()),reviewed_at=now()
    where firm_candidate_id=p_candidate_id and review_status='Pending' and confidence='High';
  get diagnostics accepted=row_count;
  if not exists(select 1 from public.candidate_research_findings where firm_candidate_id=p_candidate_id and review_status='Pending') then update public.firm_candidates set web_research_status='Complete' where id=p_candidate_id; end if;
  return accepted;
end $$;
grant execute on function public.accept_high_confidence_candidate_findings(uuid) to authenticated;

create or replace function public.approve_firm_candidate(candidate_id uuid) returns uuid language plpgsql security invoker set search_path = '' as $$
declare c public.firm_candidates; staged_contact public.candidate_contacts; f record; new_firm_id uuid; new_contact_id uuid; contact_number integer:=0;
  v_tax boolean:=false; v_bookkeeping boolean:=false; v_accounting boolean:=false; v_payroll boolean:=false; v_cas boolean:=false; v_advisory boolean:=false; v_audit boolean:=false; v_qb boolean:=false; v_xero boolean:=false; v_smb boolean:=false; v_spanish boolean:=false;
  v_industries text[]:='{}'; v_firm_types text[]; v_focus text; v_angle text; v_phone text; v_address text; v_about text; v_services text; v_leadership text; v_contact text;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  select * into c from public.firm_candidates where id=candidate_id for update;
  if c.id is null then raise exception 'Candidate not found'; end if;
  if c.review_status not in ('New','Needs Review') then raise exception 'Candidate is not reviewable'; end if;
  update public.firm_candidates set firm_name=c.firm_name where id=c.id returning * into c;
  if c.duplicate_status<>'No Match' then raise exception 'Candidate has a duplicate match and requires merge review'; end if;
  v_firm_types:=array[coalesce(c.possible_firm_type,'Other')]; v_phone:=c.phone; v_address:=c.address_line_1;
  for f in select attribute_name,proposed_value from public.candidate_research_findings where firm_candidate_id=c.id and review_status='Accepted' order by reviewed_at loop
    case f.attribute_name
      when 'provides_tax' then v_tax:=coalesce((f.proposed_value#>>'{}')::boolean,v_tax); when 'provides_bookkeeping' then v_bookkeeping:=coalesce((f.proposed_value#>>'{}')::boolean,v_bookkeeping);
      when 'provides_accounting' then v_accounting:=coalesce((f.proposed_value#>>'{}')::boolean,v_accounting); when 'provides_payroll' then v_payroll:=coalesce((f.proposed_value#>>'{}')::boolean,v_payroll);
      when 'provides_cas' then v_cas:=coalesce((f.proposed_value#>>'{}')::boolean,v_cas); when 'provides_business_advisory' then v_advisory:=coalesce((f.proposed_value#>>'{}')::boolean,v_advisory);
      when 'provides_audit' then v_audit:=coalesce((f.proposed_value#>>'{}')::boolean,v_audit); when 'provides_quickbooks_services' then v_qb:=coalesce((f.proposed_value#>>'{}')::boolean,v_qb);
      when 'xero_partner' then v_xero:=coalesce((f.proposed_value#>>'{}')::boolean,v_xero); when 'smb_focus' then v_smb:=coalesce((f.proposed_value#>>'{}')::boolean,v_smb);
      when 'spanish_speaking' then v_spanish:=coalesce((f.proposed_value#>>'{}')::boolean,v_spanish); when 'industry_specialties' then v_industries:=array(select jsonb_array_elements_text(f.proposed_value));
      when 'firm_types' then v_firm_types:=array(select jsonb_array_elements_text(f.proposed_value)); when 'business_client_focus' then v_focus:=f.proposed_value#>>'{}';
      when 'suggested_conversation_angle' then v_angle:=f.proposed_value#>>'{}'; when 'phone' then v_phone:=f.proposed_value#>>'{}'; when 'address_line_1' then v_address:=f.proposed_value#>>'{}';
      when 'about_page_url' then v_about:=f.proposed_value#>>'{}'; when 'services_page_url' then v_services:=f.proposed_value#>>'{}'; when 'leadership_page_url' then v_leadership:=f.proposed_value#>>'{}'; when 'contact_page_url' then v_contact:=f.proposed_value#>>'{}'; else null;
    end case;
  end loop;
  insert into public.firms(firm_name,normalized_name,website,domain,phone,address_line_1,city,state,zip_code,region,market,firm_types,source,source_url,data_confidence,research_status,notes,provides_tax,provides_bookkeeping,provides_accounting,provides_payroll,provides_cas,provides_audit,provides_business_advisory,provides_quickbooks_services,xero_partner,smb_focus,spanish_speaking,industry_specialties,business_client_focus,suggested_conversation_angle,about_page_url,services_page_url,leadership_page_url,contact_page_url)
  values(c.firm_name,c.normalized_name,c.website,c.domain,v_phone,v_address,c.city,c.state,c.zip_code,c.region,c.market,v_firm_types,c.source,c.source_url,c.confidence,case when c.web_research_status in ('Complete','Needs Review') then 'Complete' else 'Needs Review' end,c.description,v_tax,v_bookkeeping,v_accounting,v_payroll,v_cas,v_audit,v_advisory,v_qb,v_xero,v_smb,v_spanish,v_industries,v_focus,v_angle,v_about,v_services,v_leadership,v_contact) returning id into new_firm_id;
  insert into public.research_evidence(firm_id,attribute_name,detected_value,source_url,source_text,confidence)
    select new_firm_id,attribute_name,case when jsonb_typeof(proposed_value)='boolean' then (proposed_value#>>'{}')::boolean else null end,source_url,source_text,confidence from public.candidate_research_findings where firm_candidate_id=c.id and review_status='Accepted';
  for staged_contact in select * from public.candidate_contacts where firm_candidate_id=c.id and selected_for_approval and resulting_contact_id is null and (nullif(trim(coalesce(full_name,concat_ws(' ',first_name,last_name))), '') is not null or nullif(email,'') is not null) order by is_primary_contact desc,created_at loop
    contact_number:=contact_number+1;
    insert into public.contacts(firm_id,first_name,last_name,full_name,normalized_name,title,role_category,email,email_status,email_source,direct_phone,linkedin_url,is_primary_contact,is_decision_maker,contact_priority,source,notes)
    values(new_firm_id,staged_contact.first_name,staged_contact.last_name,staged_contact.full_name,coalesce(staged_contact.normalized_name,public.normalize_name(nullif(trim(coalesce(staged_contact.full_name,concat_ws(' ',staged_contact.first_name,staged_contact.last_name))),''))),staged_contact.title,staged_contact.role_category,staged_contact.email,staged_contact.email_status,staged_contact.provider,staged_contact.direct_phone,staged_contact.linkedin_url,staged_contact.is_primary_contact,staged_contact.is_decision_maker,contact_number,staged_contact.provider,'Approved from staged candidate contact') returning id into new_contact_id;
    update public.candidate_contacts set resulting_contact_id=new_contact_id,approved_at=now() where id=staged_contact.id;
  end loop;
  update public.firm_candidates set review_status='Approved',resulting_firm_id=new_firm_id,reviewed_at=now() where id=c.id;
  return new_firm_id;
end $$;

comment on table public.candidate_research_runs is 'Auditable Firecrawl queue and provider usage for candidate web research.';
comment on table public.candidate_research_findings is 'Human-reviewable, source-grounded facts proposed by web research.';
