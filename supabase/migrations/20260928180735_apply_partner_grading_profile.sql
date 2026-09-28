create or replace function public.keep_unknown_firm_in_needs_research()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  insufficient_research boolean;
  revised_grade public.partner_grade;
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
    revised_grade := 'NR'::public.partner_grade;
    new.recommended_partner_type := 'Needs Research';
    new.suggested_approach := 'Needs Research';
    new.score_reason := 'Insufficient research to grade partnership potential.';
    new.scoring_breakdown := jsonb_set(
      jsonb_set(new.scoring_breakdown, '{partnerType}', to_jsonb('Needs Research'::text)),
      '{grade}', to_jsonb('NR'::text)
    );
  else
    revised_grade := case
      when new.total_partner_score >= 90 then 'A+'::public.partner_grade
      when new.total_partner_score >= 80 then 'A'::public.partner_grade
      when new.total_partner_score >= 55 then 'B'::public.partner_grade
      when new.total_partner_score >= 35 then 'C'::public.partner_grade
      else 'D'::public.partner_grade
    end;
    new.scoring_breakdown := jsonb_set(new.scoring_breakdown, '{grade}', to_jsonb(revised_grade::text));
  end if;

  new.partner_grade := revised_grade;
  return new;
end
$$;

update public.firms set updated_at = now();

comment on function public.keep_unknown_firm_in_needs_research() is
  'Assigns Needs Research when evidence is insufficient and applies the revised A+/A/B/C/D partnership grade thresholds.';
