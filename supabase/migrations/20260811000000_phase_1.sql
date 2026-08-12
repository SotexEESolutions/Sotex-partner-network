create extension if not exists pgcrypto;

create type public.partner_grade as enum ('A','B','C','D');
create type public.priority_level as enum ('High','Medium','Low');
create type public.confidence_level as enum ('High','Medium','Low');
create type public.research_state as enum ('Not Started','Researching','Complete','Needs Review');
create type public.enrichment_state as enum ('Not Started','Contact Found','No Contact Found','Needs Review');
create type public.outreach_kind as enum ('Email','Phone','LinkedIn','Meeting','Referral','Other');
create type public.response_state as enum ('No Response','Interested','Meeting Scheduled','Follow Up Later','Referred','Partner','Not Interested','Bad Contact');

create table public.firms (
  id uuid primary key default gen_random_uuid(), firm_name text not null, normalized_name text not null,
  website text, domain text, phone text, address_line_1 text, address_line_2 text, city text,
  state text not null default 'TX', zip_code text, region text, market text, firm_types text[] not null default '{}',
  provides_tax boolean not null default false, provides_bookkeeping boolean not null default false,
  provides_accounting boolean not null default false, provides_payroll boolean not null default false,
  provides_cas boolean not null default false, provides_audit boolean not null default false,
  provides_business_advisory boolean not null default false, provides_financial_planning boolean not null default false,
  provides_wealth_management boolean not null default false, provides_quickbooks_services boolean not null default false,
  quickbooks_proadvisor boolean not null default false, xero_partner boolean not null default false,
  spanish_speaking boolean not null default false, smb_focus boolean not null default false,
  employee_count integer check (employee_count is null or employee_count >= 0), employee_count_range text,
  estimated_client_count integer check (estimated_client_count is null or estimated_client_count >= 0),
  business_client_focus text, industry_specialties text[] not null default '{}', notes text,
  partner_score integer not null default 0 check (partner_score between 0 and 100),
  partner_grade public.partner_grade not null default 'D', score_reason text, target_priority public.priority_level default 'Medium',
  suggested_approach text, personalization_note text, source text, source_url text, google_maps_url text,
  linkedin_company_url text, data_confidence public.confidence_level default 'Medium',
  research_status public.research_state not null default 'Not Started',
  enrichment_status public.enrichment_state not null default 'Not Started',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index firms_domain_unique on public.firms (lower(domain)) where domain is not null and domain <> '';
create unique index firms_name_city_unique on public.firms (normalized_name, lower(coalesce(city,''))) where domain is null or domain = '';
create index firms_region_idx on public.firms(region); create index firms_city_idx on public.firms(city);
create index firms_score_idx on public.firms(partner_score desc); create index firms_grade_idx on public.firms(partner_grade);
create index firms_search_idx on public.firms using gin(to_tsvector('english', firm_name || ' ' || coalesce(city,'') || ' ' || coalesce(region,'')));

create table public.contacts (
  id uuid primary key default gen_random_uuid(), firm_id uuid not null references public.firms(id) on delete cascade,
  first_name text, last_name text, full_name text, normalized_name text, title text, role_category text,
  email text, email_status text, email_source text, direct_phone text, mobile_phone text, linkedin_url text,
  is_primary_contact boolean not null default false, is_decision_maker boolean not null default false,
  contact_priority integer, source text, notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index contacts_firm_email_unique on public.contacts(firm_id, lower(email)) where email is not null and email <> '';
create unique index contacts_firm_name_unique on public.contacts(firm_id, normalized_name) where email is null or email = '';
create index contacts_firm_idx on public.contacts(firm_id);

create table public.outreach (
  id uuid primary key default gen_random_uuid(), firm_id uuid not null references public.firms(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null, outreach_type public.outreach_kind not null,
  campaign text, step text, subject text, sent_date timestamptz not null default now(), response_received boolean not null default false,
  response_date timestamptz, response_status public.response_state, notes text, next_follow_up_date date,
  created_at timestamptz not null default now()
);
create index outreach_firm_sent_idx on public.outreach(firm_id, sent_date desc);
create index outreach_follow_up_idx on public.outreach(next_follow_up_date) where next_follow_up_date is not null;

create table public.tags (id uuid primary key default gen_random_uuid(), name text not null unique, color text, created_at timestamptz not null default now());
create table public.firm_tags (firm_id uuid references public.firms(id) on delete cascade, tag_id uuid references public.tags(id) on delete cascade, primary key(firm_id,tag_id));
create table public.import_batches (
  id uuid primary key default gen_random_uuid(), file_name text not null, status text not null default 'Previewed',
  total_rows integer not null default 0, new_firms integer not null default 0, possible_duplicates integer not null default 0,
  new_contacts integer not null default 0, invalid_records integer not null default 0, error_log jsonb not null default '[]',
  imported_by uuid default auth.uid(), created_at timestamptz not null default now(), completed_at timestamptz
);

create or replace function public.normalize_name(value text) returns text language sql immutable strict as $$
  select trim(regexp_replace(lower(value), '[^a-z0-9]+', ' ', 'g'))
$$;
create or replace function public.normalize_domain(value text) returns text language sql immutable strict as $$
  select nullif(regexp_replace(regexp_replace(lower(trim(value)), '^https?://(www\.)?', ''), '/.*$', ''), '')
$$;
create or replace function public.set_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;
create or replace function public.prepare_firm() returns trigger language plpgsql set search_path = '' as $$
declare score integer := 0; reason text[] := '{}'; niche boolean; has_decision_maker boolean := false; has_direct_email boolean := false;
begin
  new.normalized_name := public.normalize_name(new.firm_name);
  if new.website is not null then new.domain := coalesce(public.normalize_domain(new.domain), public.normalize_domain(new.website));
  elsif new.domain is not null then new.domain := public.normalize_domain(new.domain); end if;
  niche := exists(select 1 from unnest(coalesce(new.industry_specialties,'{}')) x where lower(x) = any(array['construction','trades','restaurants','hospitality','medical','dental','home health','professional services','trucking','staffing','manufacturing']));
  if new.smb_focus then score:=score+20; reason:=array_append(reason,'SMB-focused practice'); end if;
  if new.provides_bookkeeping then score:=score+15; reason:=array_append(reason,'Bookkeeping services'); end if;
  if new.provides_cas then score:=score+15; reason:=array_append(reason,'CAS / advisory services'); end if;
  if new.provides_tax then score:=score+10; reason:=array_append(reason,'Business tax services'); end if;
  if new.id is not null then
    select exists(select 1 from public.contacts c where c.firm_id=new.id and c.is_decision_maker and c.role_category in ('Owner','Managing Partner','Partner')),
           exists(select 1 from public.contacts c where c.firm_id=new.id and c.is_decision_maker and nullif(c.email,'') is not null)
      into has_decision_maker, has_direct_email;
  end if;
  if has_decision_maker then score:=score+10; reason:=array_append(reason,'Decision-maker identified'); end if;
  if has_direct_email then score:=score+10; reason:=array_append(reason,'Verified direct email'); end if;
  if new.provides_quickbooks_services then score:=score+5; reason:=array_append(reason,'QuickBooks services'); end if;
  if new.spanish_speaking then score:=score+5; reason:=array_append(reason,'Spanish-speaking practice'); end if;
  if new.employee_count between 2 and 20 then score:=score+5; reason:=array_append(reason,'Ideal firm size'); end if;
  if niche then score:=score+5; reason:=array_append(reason,'Target-industry niche'); end if;
  if new.provides_payroll then score:=score+5; reason:=array_append(reason,'Potential wholesale / outsourced payroll partner');
  else score:=score+15; reason:=array_append(reason,'Does not advertise payroll'); end if;
  new.partner_score:=least(score,100); new.partner_grade:=case when score>=80 then 'A' when score>=60 then 'B' when score>=40 then 'C' else 'D' end;
  new.score_reason:=array_to_string(reason, ' · ');
  new.suggested_approach:=case when new.provides_payroll then 'Wholesale Payroll Partner' when new.partner_score>=80 then 'CPA Strategic Partner' when new.partner_score>=50 then 'Referral Partner' else 'Needs Research' end;
  new.personalization_note:=concat_ws(' ', coalesce(new.city,'Texas'), lower(coalesce(new.firm_types[1],'accounting firm')) || ' focused on', case when new.smb_focus then 'small businesses.' else 'business clients.' end, case when new.provides_payroll then 'Offers payroll; possible wholesale partnership.' else 'Does not appear to advertise payroll.' end);
  return new;
end $$;
create trigger firms_prepare before insert or update on public.firms for each row execute function public.prepare_firm();
create trigger firms_updated before update on public.firms for each row execute function public.set_updated_at();
create trigger contacts_updated before update on public.contacts for each row execute function public.set_updated_at();
create or replace function public.contact_normalize() returns trigger language plpgsql set search_path = '' as $$ begin new.full_name:=coalesce(nullif(new.full_name,''),trim(concat_ws(' ',new.first_name,new.last_name))); new.normalized_name:=public.normalize_name(new.full_name); return new; end $$;
create trigger contacts_normalize before insert or update on public.contacts for each row execute function public.contact_normalize();
create or replace function public.rescore_contact_firm() returns trigger language plpgsql set search_path = '' as $$
begin update public.firms set updated_at=now() where id=coalesce(new.firm_id,old.firm_id); return coalesce(new,old); end $$;
create trigger contacts_rescore after insert or update or delete on public.contacts for each row execute function public.rescore_contact_firm();

alter table public.firms enable row level security; alter table public.contacts enable row level security;
alter table public.outreach enable row level security; alter table public.tags enable row level security;
alter table public.firm_tags enable row level security; alter table public.import_batches enable row level security;
grant select, insert, update, delete on public.firms, public.contacts, public.outreach, public.tags, public.firm_tags, public.import_batches to authenticated;
revoke all on public.firms, public.contacts, public.outreach, public.tags, public.firm_tags, public.import_batches from anon;
create policy "internal firms" on public.firms for all to authenticated using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);
create policy "internal contacts" on public.contacts for all to authenticated using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);
create policy "internal outreach" on public.outreach for all to authenticated using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);
create policy "internal tags" on public.tags for all to authenticated using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);
create policy "internal firm tags" on public.firm_tags for all to authenticated using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);
create policy "internal import batches" on public.import_batches for all to authenticated using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);

insert into public.tags(name,color) values ('Construction Clients','#a16207'),('Restaurant Clients','#c2410c'),('Medical Clients','#0f766e'),('Spanish Speaking','#7c3aed'),('Payroll Opportunity','#2563eb'),('CPA Referral','#0891b2'),('High Value','#dc2626'),('Existing Relationship','#16a34a'),('QuickBooks','#15803d'),('Xero','#0369a1');
