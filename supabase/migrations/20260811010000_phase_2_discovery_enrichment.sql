create extension if not exists pg_trgm with schema extensions;

create type public.discovery_job_status as enum ('Pending','Running','Complete','Failed','Needs Review');
create type public.candidate_review_status as enum ('New','Approved','Rejected','Duplicate','Needs Review');
create type public.duplicate_match_status as enum ('No Match','Possible Match','Exact Match');
create type public.partner_type as enum ('Referral Partner','Wholesale Payroll Partner','Strategic CPA Partner','Bookkeeping Partner','Tax / EA Partner','Needs Research');

create table public.discovery_jobs (
  id uuid primary key default gen_random_uuid(), city text not null, market text, region text not null,
  state text not null default 'TX', search_category text not null, search_query text not null,
  source text not null, status public.discovery_job_status not null default 'Pending',
  records_found integer not null default 0 check (records_found >= 0),
  records_imported integer not null default 0 check (records_imported >= 0),
  records_rejected integer not null default 0 check (records_rejected >= 0),
  started_at timestamptz, completed_at timestamptz, created_at timestamptz not null default now()
);

create table public.firm_candidates (
  id uuid primary key default gen_random_uuid(), discovery_job_id uuid references public.discovery_jobs(id) on delete set null,
  firm_name text not null, normalized_name text not null, website text, domain text, phone text,
  address_line_1 text, city text not null, state text not null default 'TX', zip_code text, region text, market text,
  possible_firm_type text, source text not null, source_url text, description text, raw_data jsonb not null default '{}',
  duplicate_status public.duplicate_match_status not null default 'No Match',
  possible_existing_firm_id uuid references public.firms(id) on delete set null,
  confidence public.confidence_level not null default 'Medium',
  review_status public.candidate_review_status not null default 'New', resulting_firm_id uuid references public.firms(id) on delete set null,
  created_at timestamptz not null default now(), reviewed_at timestamptz
);
create index discovery_jobs_status_idx on public.discovery_jobs(status, created_at desc);
create index firm_candidates_review_idx on public.firm_candidates(review_status, created_at desc);
create index firm_candidates_job_idx on public.firm_candidates(discovery_job_id);
create index firm_candidates_domain_idx on public.firm_candidates(lower(domain)) where domain is not null;
create index firm_candidates_name_trgm_idx on public.firm_candidates using gin(normalized_name gin_trgm_ops);

alter table public.firms
  add column about_page_url text, add column services_page_url text, add column leadership_page_url text,
  add column contact_page_url text, add column payroll_mentioned boolean, add column bookkeeping_mentioned boolean,
  add column tax_mentioned boolean, add column cas_mentioned boolean, add column outsourced_accounting_mentioned boolean,
  add column advisory_mentioned boolean, add column quickbooks_mentioned boolean, add column xero_mentioned boolean,
  add column spanish_mentioned boolean, add column small_business_mentioned boolean,
  add column business_clients_mentioned boolean, add column primarily_individual_tax boolean,
  add column primarily_audit_assurance boolean, add column recommended_partner_type public.partner_type not null default 'Needs Research',
  add column suggested_conversation_angle text;

create table public.research_evidence (
  id uuid primary key default gen_random_uuid(), firm_id uuid not null references public.firms(id) on delete cascade,
  attribute_name text not null, detected_value boolean, source_url text not null, source_text text,
  confidence public.confidence_level not null default 'Medium', created_at timestamptz not null default now()
);
create index research_evidence_firm_idx on public.research_evidence(firm_id, attribute_name);

create or replace function public.prepare_candidate() returns trigger language plpgsql set search_path = '' as $$
declare exact_firm uuid; possible_firm uuid;
begin
  new.normalized_name := public.normalize_name(new.firm_name);
  new.domain := coalesce(public.normalize_domain(new.domain), public.normalize_domain(new.website));
  select f.id into exact_firm from public.firms f
    where (new.domain is not null and lower(f.domain)=lower(new.domain))
       or (nullif(regexp_replace(new.phone,'[^0-9]','','g'),'') is not null and regexp_replace(f.phone,'[^0-9]','','g')=regexp_replace(new.phone,'[^0-9]','','g'))
       or (f.normalized_name=new.normalized_name and lower(coalesce(f.city,''))=lower(new.city))
       or (new.website is not null and lower(f.website)=lower(new.website)) limit 1;
  if exact_firm is not null then new.duplicate_status:='Exact Match'; new.possible_existing_firm_id:=exact_firm;
  else
    select f.id into possible_firm from public.firms f where lower(coalesce(f.city,''))=lower(new.city)
      and extensions.similarity(f.normalized_name,new.normalized_name) >= .72 order by extensions.similarity(f.normalized_name,new.normalized_name) desc limit 1;
    if possible_firm is not null then new.duplicate_status:='Possible Match'; new.possible_existing_firm_id:=possible_firm;
    else new.duplicate_status:='No Match'; new.possible_existing_firm_id:=null; end if;
  end if;
  return new;
end $$;
create trigger firm_candidates_prepare before insert or update of firm_name,website,domain,phone,city on public.firm_candidates for each row execute function public.prepare_candidate();

create or replace function public.prepare_firm() returns trigger language plpgsql set search_path = '' as $$
declare score integer := 0; reason text[] := '{}'; niche boolean; has_decision_maker boolean := false; has_direct_email boolean := false; service_count integer := 0;
begin
  new.normalized_name := public.normalize_name(new.firm_name);
  if new.website is not null then new.domain := coalesce(public.normalize_domain(new.domain), public.normalize_domain(new.website)); elsif new.domain is not null then new.domain := public.normalize_domain(new.domain); end if;
  niche := exists(select 1 from unnest(coalesce(new.industry_specialties,'{}')) x where lower(x)=any(array['construction','trades','restaurants','hospitality','medical','dental','home health','professional services','trucking','staffing','manufacturing']));
  service_count := (new.provides_tax::int + new.provides_bookkeeping::int + new.provides_accounting::int + new.provides_cas::int + new.provides_business_advisory::int);
  if new.smb_focus then score:=score+20; reason:=array_append(reason,'SMB-focused practice'); end if;
  if new.provides_bookkeeping then score:=score+15; reason:=array_append(reason,'Bookkeeping services'); end if;
  if new.provides_cas then score:=score+15; reason:=array_append(reason,'CAS / advisory services'); end if;
  if new.provides_tax then score:=score+10; reason:=array_append(reason,'Business tax services'); end if;
  if new.business_clients_mentioned is true then score:=score+10; reason:=array_append(reason,'Business clients clearly mentioned'); end if;
  if new.id is not null then select exists(select 1 from public.contacts c where c.firm_id=new.id and c.is_decision_maker and c.role_category in ('Owner','Founder','Managing Partner','Partner','Principal','Managing Director')), exists(select 1 from public.contacts c where c.firm_id=new.id and c.is_decision_maker and nullif(c.email,'') is not null) into has_decision_maker,has_direct_email; end if;
  if has_decision_maker then score:=score+10; reason:=array_append(reason,'Decision-maker identified'); end if;
  if has_direct_email then score:=score+10; reason:=array_append(reason,'Verified direct email'); end if;
  if service_count >= 3 then score:=score+5; reason:=array_append(reason,'Multiple SMB services'); end if;
  if new.provides_quickbooks_services or new.quickbooks_proadvisor or new.quickbooks_mentioned is true then score:=score+5; reason:=array_append(reason,'QuickBooks-focused practice'); end if;
  if (new.spanish_speaking or new.spanish_mentioned is true) and (new.region in ('San Antonio','Laredo','Coastal Bend','Rio Grande Valley')) then score:=score+5; reason:=array_append(reason,'Spanish-language services in target market'); end if;
  if new.employee_count between 2 and 20 then score:=score+5; reason:=array_append(reason,'Ideal firm size'); end if;
  if niche then score:=score+5; reason:=array_append(reason,'Target-industry niche'); end if;
  if new.provides_payroll then score:=score+5; reason:=array_append(reason,'Potential Wholesale Payroll Partner'); else score:=score+15; reason:=array_append(reason,'Potential Referral Payroll Partner'); end if;
  if new.primarily_individual_tax is true then score:=score-10; reason:=array_append(reason,'Primarily individual tax preparation'); end if;
  if new.primarily_audit_assurance is true and not new.smb_focus and not new.provides_cas then score:=score-10; reason:=array_append(reason,'Audit-focused with limited SMB advisory'); end if;
  new.partner_score:=greatest(0,least(score,100)); new.partner_grade:=case when score>=80 then 'A' when score>=60 then 'B' when score>=40 then 'C' else 'D' end;
  new.score_reason:=array_to_string(reason,' · ');
  new.recommended_partner_type:=case when new.provides_payroll then 'Wholesale Payroll Partner' when 'CPA Firm'=any(new.firm_types) and new.provides_bookkeeping then 'Strategic CPA Partner' when 'Enrolled Agent'=any(new.firm_types) or ('Tax Firm'=any(new.firm_types) and new.business_clients_mentioned is true) then 'Tax / EA Partner' when 'Bookkeeper'=any(new.firm_types) and not new.provides_payroll then 'Bookkeeping Partner' when new.provides_bookkeeping and not new.provides_payroll then 'Referral Partner' else 'Needs Research' end;
  new.suggested_approach:=new.recommended_partner_type::text;
  new.personalization_note:=concat_ws(' ',coalesce(new.city,'Texas'),lower(coalesce(new.firm_types[1],'accounting firm'))||case when new.business_clients_mentioned is true or new.smb_focus then ' focused on small-business clients.' else '.' end,case when new.provides_quickbooks_services or new.quickbooks_mentioned is true then 'QuickBooks services are prominently advertised.' end,case when new.provides_payroll then 'Payroll is offered; consider outsourced or wholesale support.' else 'Payroll does not appear to be offered.' end);
  new.suggested_conversation_angle:=case when new.provides_payroll then 'Explore wholesale or outsourced payroll capacity and service support.' else 'Lead with a reciprocal small-business referral partnership centered on payroll.' end;
  return new;
end $$;

create or replace function public.approve_firm_candidate(candidate_id uuid) returns uuid language plpgsql security invoker set search_path = '' as $$
declare c public.firm_candidates; new_firm_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  select * into c from public.firm_candidates where id=candidate_id for update;
  if c.id is null then raise exception 'Candidate not found'; end if;
  if c.review_status not in ('New','Needs Review') then raise exception 'Candidate is not reviewable'; end if;
  update public.firm_candidates set firm_name=c.firm_name where id=c.id returning * into c;
  if c.duplicate_status <> 'No Match' then raise exception 'Candidate has a duplicate match and requires merge review'; end if;
  insert into public.firms(firm_name,normalized_name,website,domain,phone,address_line_1,city,state,zip_code,region,market,firm_types,source,source_url,data_confidence,research_status,notes)
  values(c.firm_name,c.normalized_name,c.website,c.domain,c.phone,c.address_line_1,c.city,c.state,c.zip_code,c.region,c.market,array[coalesce(c.possible_firm_type,'Other')],c.source,c.source_url,c.confidence,'Needs Review',c.description)
  returning id into new_firm_id;
  update public.firm_candidates set review_status='Approved',resulting_firm_id=new_firm_id,reviewed_at=now() where id=c.id;
  return new_firm_id;
end $$;

create view public.firm_contact_readiness with (security_invoker=true) as
select f.id as firm_id,
  exists(select 1 from public.contacts c where c.firm_id=f.id and c.is_decision_maker) as decision_maker_found,
  exists(select 1 from public.contacts c where c.firm_id=f.id and c.is_decision_maker and nullif(c.email,'') is not null and coalesce(c.email_status,'') <> 'Invalid') as decision_maker_email_found,
  exists(select 1 from public.contacts c where c.firm_id=f.id and c.is_primary_contact and c.is_decision_maker and nullif(c.email,'') is not null and coalesce(c.email_status,'') <> 'Invalid') as primary_contact_complete,
  f.partner_grade in ('A','B') and exists(select 1 from public.contacts c where c.firm_id=f.id and c.is_primary_contact and nullif(c.email,'') is not null and coalesce(c.email_status,'') <> 'Invalid')
    and not exists(select 1 from public.outreach o where o.firm_id=f.id and o.response_status in ('Partner','Not Interested')) as ready_for_outreach
from public.firms f;

alter table public.discovery_jobs enable row level security; alter table public.firm_candidates enable row level security; alter table public.research_evidence enable row level security;
grant select,insert,update,delete on public.discovery_jobs,public.firm_candidates,public.research_evidence to authenticated;
grant select on public.firm_contact_readiness to authenticated; grant execute on function public.approve_firm_candidate(uuid) to authenticated;
revoke all on public.discovery_jobs,public.firm_candidates,public.research_evidence from anon;
create policy "internal discovery jobs" on public.discovery_jobs for all to authenticated using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);
create policy "internal candidates" on public.firm_candidates for all to authenticated using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);
create policy "internal research evidence" on public.research_evidence for all to authenticated using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);
