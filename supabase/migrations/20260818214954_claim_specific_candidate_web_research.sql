create or replace function public.claim_specific_candidate_web_research(
  p_candidate_id uuid,
  p_daily_limit integer
)
returns setof public.candidate_research_runs
language plpgsql
security invoker
set search_path = ''
as $$
declare
  daily_limit integer := greatest(coalesce(p_daily_limit, 30), 1);
  daily_started integer;
begin
  perform pg_advisory_xact_lock(hashtext('candidate_web_research_daily'));

  select count(*)::integer
    into daily_started
    from public.candidate_research_runs
   where started_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';

  if daily_started >= daily_limit then
    update public.firm_candidates
       set web_research_status = 'Daily Limit'
     where id = p_candidate_id
       and web_research_status = 'Queued';
    return;
  end if;

  return query
  with claimed as (
    select id
      from public.candidate_research_runs
     where firm_candidate_id = p_candidate_id
       and status in ('Queued', 'Retry')
       and available_at <= now()
       and attempt_count < 3
     order by available_at, created_at
     for update skip locked
     limit 1
  )
  update public.candidate_research_runs r
     set status = 'Running',
         attempt_count = r.attempt_count + 1,
         claimed_at = now(),
         started_at = coalesce(r.started_at, now()),
         error_code = null
    from claimed
   where r.id = claimed.id
  returning r.*;
end
$$;

revoke all on function public.claim_specific_candidate_web_research(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.claim_specific_candidate_web_research(uuid, integer)
  to service_role;

comment on function public.claim_specific_candidate_web_research(uuid, integer)
  is 'Claims one specified queued web-research candidate while enforcing the shared UTC daily limit.';
