alter table public.discovery_job_queries
  add column anchor_city text,
  add column page_size integer not null default 20 check (page_size between 1 and 20);

update public.discovery_job_queries set anchor_city = market where anchor_city is null;
alter table public.discovery_job_queries alter column anchor_city set not null;
alter table public.discovery_job_queries drop constraint discovery_job_queries_job_id_market_category_key;
alter table public.discovery_job_queries add constraint discovery_job_queries_job_anchor_category_key unique (job_id, anchor_city, category);

create table public.candidate_contacts (
  id uuid primary key default gen_random_uuid(),
  firm_candidate_id uuid not null references public.firm_candidates(id) on delete cascade,
  provider text not null,
  provider_record_id text not null,
  first_name text,
  last_name text,
  full_name text,
  normalized_name text,
  title text,
  role_category text,
  email text,
  email_status text not null default 'Not Found' check (email_status in ('Not Found','Unverified','Verified','Invalid')),
  direct_phone text,
  phone_status text not null default 'Not Found' check (phone_status in ('Not Found','Unverified','Verified','Invalid')),
  linkedin_url text,
  confidence public.confidence_level not null default 'Medium',
  is_primary_contact boolean not null default false,
  is_decision_maker boolean not null default true,
  selected_for_approval boolean not null default true,
  source_url text,
  resulting_contact_id uuid references public.contacts(id) on delete set null,
  approved_at timestamptz,
  raw_data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (firm_candidate_id, provider, provider_record_id)
);

create index candidate_contacts_candidate_idx on public.candidate_contacts(firm_candidate_id, selected_for_approval, created_at);
create unique index candidate_contacts_candidate_email_unique on public.candidate_contacts(firm_candidate_id, lower(email)) where email is not null and email <> '';
alter table public.candidate_contacts enable row level security;
grant select, insert, update, delete on public.candidate_contacts to authenticated;
revoke all on public.candidate_contacts from anon;
create policy "authenticated staff read candidate contacts" on public.candidate_contacts for select to authenticated using ((select auth.uid()) is not null);
create policy "authenticated staff create candidate contacts" on public.candidate_contacts for insert to authenticated with check ((select auth.uid()) is not null);
create policy "authenticated staff update candidate contacts" on public.candidate_contacts for update to authenticated using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);
create policy "authenticated staff delete candidate contacts" on public.candidate_contacts for delete to authenticated using ((select auth.uid()) is not null);
create trigger candidate_contacts_updated before update on public.candidate_contacts for each row execute function public.set_updated_at();

alter table public.firm_candidates
  add column contact_research_status text not null default 'Not Started' check (contact_research_status in ('Not Started','Researching','Complete','No Contact Found','Failed')),
  add column contact_researched_at timestamptz;

create or replace function public.approve_firm_candidate(candidate_id uuid) returns uuid language plpgsql security invoker set search_path = '' as $$
declare c public.firm_candidates; staged_contact public.candidate_contacts; new_firm_id uuid; new_contact_id uuid; contact_number integer := 0;
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

  for staged_contact in
    select * from public.candidate_contacts
    where firm_candidate_id=c.id and selected_for_approval and resulting_contact_id is null
      and (nullif(trim(coalesce(full_name,concat_ws(' ',first_name,last_name))), '') is not null or nullif(email,'') is not null)
    order by is_primary_contact desc, created_at
  loop
    contact_number := contact_number + 1;
    insert into public.contacts(firm_id,first_name,last_name,full_name,normalized_name,title,role_category,email,email_status,email_source,direct_phone,linkedin_url,is_primary_contact,is_decision_maker,contact_priority,source,notes)
    values(new_firm_id,staged_contact.first_name,staged_contact.last_name,staged_contact.full_name,coalesce(staged_contact.normalized_name,public.normalize_name(nullif(trim(coalesce(staged_contact.full_name,concat_ws(' ',staged_contact.first_name,staged_contact.last_name))),''))),staged_contact.title,staged_contact.role_category,staged_contact.email,staged_contact.email_status,staged_contact.provider,staged_contact.direct_phone,staged_contact.linkedin_url,staged_contact.is_primary_contact,staged_contact.is_decision_maker,contact_number,staged_contact.provider,'Approved from staged candidate contact')
    returning id into new_contact_id;
    update public.candidate_contacts set resulting_contact_id=new_contact_id,approved_at=now() where id=staged_contact.id;
  end loop;

  update public.firm_candidates set review_status='Approved',resulting_firm_id=new_firm_id,reviewed_at=now() where id=c.id;
  return new_firm_id;
end $$;

comment on table public.candidate_contacts is 'Reviewable contact previews and enriched details staged before candidate approval.';
comment on column public.candidate_contacts.selected_for_approval is 'Only selected staged contacts are copied into contacts by approve_firm_candidate.';
comment on column public.discovery_job_queries.anchor_city is 'Concrete city used by a query inside a broader market such as West Texas.';
