create or replace function public.keep_unknown_firm_in_needs_research()
returns trigger
language plpgsql
set search_path = ''
as $$
declare insufficient_research boolean;
begin
  insufficient_research := not new.smb_focus
    and new.small_business_mentioned is null
    and new.business_clients_mentioned is null
    and not new.provides_tax
    and not new.provides_bookkeeping
    and not new.provides_accounting
    and not new.provides_payroll
    and not new.provides_cas
    and not new.provides_business_advisory
    and new.tax_mentioned is null
    and new.bookkeeping_mentioned is null
    and new.payroll_mentioned is null
    and new.cas_mentioned is null
    and new.advisory_mentioned is null;

  if insufficient_research
    and new.primarily_individual_tax is not true
    and new.primarily_audit_assurance is not true
    and new.primarily_wealth_management is not true
    and new.national_tax_franchise is not true
    and new.inactive_or_outdated is not true
  then
    new.recommended_partner_type := 'Needs Research';
    new.suggested_approach := 'Needs Research';
    new.scoring_breakdown := jsonb_set(new.scoring_breakdown, '{partnerType}', to_jsonb('Needs Research'::text));
  end if;
  return new;
end
$$;

drop trigger if exists firms_score_unknown_guard on public.firms;
create trigger firms_score_unknown_guard
before insert or update on public.firms
for each row execute function public.keep_unknown_firm_in_needs_research();

update public.firms set updated_at = now();

revoke execute on function public.keep_unknown_firm_in_needs_research() from public, anon;
