alter table public.firm_candidates add column source_record_id text;
alter table public.firm_candidates add constraint firm_candidates_source_record_unique unique (source, source_record_id);

alter table public.discovery_jobs
  add column requested_categories text[] not null default '{}',
  add column target_candidates integer not null default 20 check (target_candidates between 1 and 40),
  add column queries_attempted integer not null default 0 check (queries_attempted >= 0),
  add column queries_total integer not null default 0 check (queries_total >= 0),
  add column candidates_duplicate_existing integer not null default 0 check (candidates_duplicate_existing >= 0),
  add column firm_matches_flagged integer not null default 0 check (firm_matches_flagged >= 0),
  add column error_message text,
  add column estimated_requests integer not null default 0 check (estimated_requests >= 0),
  add column actual_requests integer not null default 0 check (actual_requests >= 0),
  add column estimated_cost_usd numeric(10,4) check (estimated_cost_usd is null or estimated_cost_usd >= 0),
  add column requested_by uuid references auth.users(id) on delete set null,
  add column idempotency_key text unique;

create table public.discovery_job_queries (
  id uuid primary key default gen_random_uuid(), job_id uuid not null references public.discovery_jobs(id) on delete cascade,
  market text not null, category text not null, query_text text not null,
  status text not null default 'Pending' check (status in ('Pending','Running','Complete','Failed','Skipped')),
  page_number integer not null default 1 check (page_number between 1 and 3), next_page_token text,
  attempt_count integer not null default 0 check (attempt_count between 0 and 3),
  places_returned integer not null default 0 check (places_returned >= 0),
  candidates_staged integer not null default 0 check (candidates_staged >= 0),
  duplicates_skipped integer not null default 0 check (duplicates_skipped >= 0),
  firm_matches_flagged integer not null default 0 check (firm_matches_flagged >= 0),
  last_error text, started_at timestamptz, completed_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (job_id, market, category)
);
create index discovery_job_queries_next_idx on public.discovery_job_queries(job_id, status, created_at);
alter table public.discovery_job_queries enable row level security;
grant select, insert, update, delete on public.discovery_job_queries to authenticated;
revoke all on public.discovery_job_queries from anon;

drop policy if exists "internal discovery jobs" on public.discovery_jobs;
create policy "authenticated staff read discovery jobs" on public.discovery_jobs for select to authenticated using ((select auth.uid()) is not null);
create policy "staff create owned discovery jobs" on public.discovery_jobs for insert to authenticated with check ((select auth.uid()) = requested_by);
create policy "staff update owned discovery jobs" on public.discovery_jobs for update to authenticated using ((select auth.uid()) = requested_by) with check ((select auth.uid()) = requested_by);
create policy "staff delete owned discovery jobs" on public.discovery_jobs for delete to authenticated using ((select auth.uid()) = requested_by);

create policy "authenticated staff read discovery queries" on public.discovery_job_queries for select to authenticated using ((select auth.uid()) is not null);
create policy "staff create owned discovery queries" on public.discovery_job_queries for insert to authenticated with check (exists (select 1 from public.discovery_jobs job where job.id = job_id and job.requested_by = (select auth.uid())));
create policy "staff update owned discovery queries" on public.discovery_job_queries for update to authenticated
  using (exists (select 1 from public.discovery_jobs job where job.id = job_id and job.requested_by = (select auth.uid())))
  with check (exists (select 1 from public.discovery_jobs job where job.id = job_id and job.requested_by = (select auth.uid())));
create policy "staff delete owned discovery queries" on public.discovery_job_queries for delete to authenticated using (exists (select 1 from public.discovery_jobs job where job.id = job_id and job.requested_by = (select auth.uid())));

comment on column public.firm_candidates.source_record_id is 'Stable provider record identifier, such as a Google Place ID.';
comment on table public.discovery_job_queries is 'Resumable, bounded provider requests belonging to an authenticated discovery job.';
