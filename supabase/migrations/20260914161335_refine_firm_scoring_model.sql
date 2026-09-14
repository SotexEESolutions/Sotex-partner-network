alter table public.firms
  add column legacy_partner_score integer,
  add column partner_fit_score integer not null default 0 check (partner_fit_score between 0 and 60),
  add column partnership_opportunity_score integer not null default 0 check (partnership_opportunity_score between 0 and 25),
  add column outreach_readiness_score integer not null default 0 check (outreach_readiness_score between 0 and 15),
  add column total_partner_score integer not null default 0 check (total_partner_score between 0 and 100),
  add column top_target boolean not null default false,
  add column scoring_breakdown jsonb not null default '{"partnerFit":{"score":0,"max":60,"items":[]},"partnershipOpportunity":{"score":0,"max":25,"items":[]},"outreachReadiness":{"score":0,"max":15,"items":[]},"adjustments":[]}'::jsonb,
  add column ideal_client_size_match boolean,
  add column locally_owned boolean,
  add column payroll_secondary_service boolean,
  add column small_local_practice boolean,
  add column primarily_wealth_management boolean,
  add column no_business_clients boolean,
  add column national_tax_franchise boolean,
  add column inactive_or_outdated boolean,
  add column institutional_payroll_operation boolean,
  add column institutional_payroll_adjustment integer not null default 0
    check (institutional_payroll_adjustment = 0 or institutional_payroll_adjustment between -20 and -10);

update public.firms
set legacy_partner_score = partner_score
where legacy_partner_score is null;

create index firms_fit_score_idx on public.firms(partner_fit_score desc);
create index firms_opportunity_score_idx on public.firms(partnership_opportunity_score desc);
create index firms_readiness_score_idx on public.firms(outreach_readiness_score desc);
create index firms_total_partner_score_idx on public.firms(total_partner_score desc);
create index firms_top_target_idx on public.firms(top_target) where top_target;
create index firms_partner_type_idx on public.firms(recommended_partner_type);

create or replace function public.calculate_firm_scoring(f public.firms)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  fit integer := 0;
  opportunity integer := 0;
  readiness integer := 0;
  adjustment integer := 0;
  final_score integer := 0;
  fit_items jsonb := '[]'::jsonb;
  opportunity_items jsonb := '[]'::jsonb;
  readiness_items jsonb := '[]'::jsonb;
  adjustment_items jsonb := '[]'::jsonb;
  reasons text[] := '{}';
  has_bookkeeping boolean := f.provides_bookkeeping or f.bookkeeping_mentioned is true or f.provides_accounting;
  has_cas boolean := f.provides_cas or f.cas_mentioned is true or f.outsourced_accounting_mentioned is true or f.advisory_mentioned is true or f.provides_business_advisory;
  has_business_tax boolean := (f.provides_tax or f.tax_mentioned is true)
    and (f.business_clients_mentioned is true or f.smb_focus or f.small_business_mentioned is true)
    and f.primarily_individual_tax is not true;
  has_smb_focus boolean := f.smb_focus or f.small_business_mentioned is true;
  has_business_clients boolean := f.business_clients_mentioned is true or has_smb_focus or has_bookkeeping or has_cas;
  has_systems boolean := f.provides_quickbooks_services or f.quickbooks_proadvisor or f.quickbooks_mentioned is true or f.xero_partner or f.xero_mentioned is true;
  has_target_industry boolean;
  ideal_client_match boolean;
  payroll_offered boolean := f.provides_payroll or f.payroll_mentioned is true;
  payroll_absent boolean := f.payroll_mentioned is false and not f.provides_payroll;
  recurring_services boolean := has_bookkeeping or has_cas;
  local_practice boolean := f.small_local_practice is true or f.locally_owned is true or f.employee_count between 1 and 25;
  decision_maker boolean := false;
  direct_email boolean := false;
  direct_channel boolean := false;
  personalizable boolean := false;
  institutional_adjustment integer := 0;
  is_accounting_type boolean;
  is_bookkeeping_type boolean;
  is_tax_type boolean;
  insufficient_research boolean;
  partner_type_value public.partner_type;
begin
  has_target_industry := exists (
    select 1
    from unnest(coalesce(f.industry_specialties, '{}')) industry
    where lower(industry) = any(array[
      'construction','contractors','trades','restaurants','hospitality','medical','dental',
      'home health','trucking','transportation','staffing','manufacturing','professional services'
    ])
  );
  ideal_client_match := f.ideal_client_size_match is true
    or (has_smb_focus and f.business_clients_mentioned is true and recurring_services);
  is_accounting_type := exists (
    select 1 from unnest(coalesce(f.firm_types, '{}')) firm_type
    where lower(firm_type) in ('cpa firm','accounting firm','cas / advisory','cas firm')
  );
  is_bookkeeping_type := exists (
    select 1 from unnest(coalesce(f.firm_types, '{}')) firm_type
    where lower(firm_type) in ('bookkeeper','bookkeeping firm')
  );
  is_tax_type := exists (
    select 1 from unnest(coalesce(f.firm_types, '{}')) firm_type
    where lower(firm_type) in ('enrolled agent','tax firm','ea firm')
  );

  if f.id is not null then
    select
      exists (
        select 1 from public.contacts c
        where c.firm_id = f.id
          and c.is_decision_maker
          and (c.role_category in ('Owner','Founder','Managing Partner','Partner','Principal','Managing Director')
            or lower(coalesce(c.title,'')) ~ '(owner|founder|managing partner|partner|principal)')
      ),
      exists (
        select 1 from public.contacts c
        where c.firm_id = f.id and c.is_decision_maker
          and nullif(c.email,'') is not null
          and lower(coalesce(c.email_status,'')) in ('verified','valid','high confidence')
      ),
      exists (
        select 1 from public.contacts c
        where c.firm_id = f.id and c.is_decision_maker
          and (nullif(c.direct_phone,'') is not null or nullif(c.mobile_phone,'') is not null or nullif(c.linkedin_url,'') is not null)
      )
    into decision_maker, direct_email, direct_channel;

    personalizable := nullif(f.business_client_focus,'') is not null
      or nullif(f.suggested_conversation_angle,'') is not null
      or nullif(f.about_page_url,'') is not null
      or nullif(f.services_page_url,'') is not null
      or exists (select 1 from public.research_evidence e where e.firm_id = f.id);

    if f.institutional_payroll_operation is true
      and f.institutional_payroll_adjustment between -20 and -10
      and exists (
        select 1 from public.research_evidence e
        where e.firm_id = f.id
          and e.attribute_name = 'institutional_payroll_operation'
          and e.detected_value is true
          and nullif(e.source_text,'') is not null
      )
    then institutional_adjustment := f.institutional_payroll_adjustment;
    end if;
  end if;

  if has_smb_focus then
    fit := fit + 15; fit_items := fit_items || jsonb_build_array(jsonb_build_object('points',15,'label','Small-business focus'));
  end if;
  if has_bookkeeping then
    fit := fit + 10; fit_items := fit_items || jsonb_build_array(jsonb_build_object('points',10,'label','Bookkeeping / outsourced accounting'));
  end if;
  if has_business_tax then
    fit := fit + 8; fit_items := fit_items || jsonb_build_array(jsonb_build_object('points',8,'label','Business tax services'));
  end if;
  if has_cas then
    fit := fit + 10; fit_items := fit_items || jsonb_build_array(jsonb_build_object('points',10,'label','CAS / recurring advisory'));
  end if;
  if ideal_client_match then
    fit := fit + 7; fit_items := fit_items || jsonb_build_array(jsonb_build_object('points',7,'label','Likely 1–150 employee client base'));
  end if;
  if has_systems then
    fit := fit + 5; fit_items := fit_items || jsonb_build_array(jsonb_build_object('points',5,'label','QuickBooks / Xero / SMB systems'));
  end if;
  if has_target_industry then
    fit := fit + 5; fit_items := fit_items || jsonb_build_array(jsonb_build_object('points',5,'label','Auris target-industry alignment'));
  end if;
  fit := least(fit, 60);

  if payroll_absent then
    opportunity := opportunity + 15;
    opportunity_items := opportunity_items || jsonb_build_array(jsonb_build_object('points',15,'label','Potential referral payroll partner'));
    if recurring_services then
      opportunity := opportunity + 5;
      opportunity_items := opportunity_items || jsonb_build_array(jsonb_build_object('points',5,'label','CAS / bookkeeping referral opportunity'));
    end if;
    if f.locally_owned is true then
      opportunity := opportunity + 5;
      opportunity_items := opportunity_items || jsonb_build_array(jsonb_build_object('points',5,'label','Locally owned / relationship-driven practice'));
    end if;
  elsif payroll_offered then
    opportunity := opportunity + 10;
    opportunity_items := opportunity_items || jsonb_build_array(jsonb_build_object('points',10,'label','Potential wholesale / outsourced payroll partner'));
    if f.payroll_secondary_service is true then
      opportunity := opportunity + 5;
      opportunity_items := opportunity_items || jsonb_build_array(jsonb_build_object('points',5,'label','Payroll appears secondary to the core practice'));
    end if;
    if recurring_services then
      opportunity := opportunity + 5;
      opportunity_items := opportunity_items || jsonb_build_array(jsonb_build_object('points',5,'label','Recurring accounting creates payroll servicing burden'));
    end if;
    if local_practice then
      opportunity := opportunity + 5;
      opportunity_items := opportunity_items || jsonb_build_array(jsonb_build_object('points',5,'label','Small / local practice may benefit from outsourced infrastructure'));
    end if;
  end if;
  opportunity := least(opportunity, 25);

  if decision_maker then
    readiness := readiness + 5; readiness_items := readiness_items || jsonb_build_array(jsonb_build_object('points',5,'label','Owner / decision maker identified'));
  else
    readiness_items := readiness_items || jsonb_build_array(jsonb_build_object('points',0,'label','Decision maker still needed'));
  end if;
  if direct_email then
    readiness := readiness + 5; readiness_items := readiness_items || jsonb_build_array(jsonb_build_object('points',5,'label','Verified direct business email'));
  else
    readiness_items := readiness_items || jsonb_build_array(jsonb_build_object('points',0,'label','Verified email still needed'));
  end if;
  if direct_channel then
    readiness := readiness + 2; readiness_items := readiness_items || jsonb_build_array(jsonb_build_object('points',2,'label','Direct phone, mobile, or LinkedIn available'));
  end if;
  if personalizable then
    readiness := readiness + 3; readiness_items := readiness_items || jsonb_build_array(jsonb_build_object('points',3,'label','Research supports personalized outreach'));
  end if;
  readiness := least(readiness, 15);

  if f.primarily_individual_tax is true then
    adjustment := adjustment - 15; adjustment_items := adjustment_items || jsonb_build_array(jsonb_build_object('points',-15,'label','Primarily individual tax / 1040 / refund shop'));
  end if;
  if f.national_tax_franchise is true then
    adjustment := adjustment - 20; adjustment_items := adjustment_items || jsonb_build_array(jsonb_build_object('points',-20,'label','National tax franchise or major chain'));
  end if;
  if f.primarily_audit_assurance is true and not has_cas then
    adjustment := adjustment - 10; adjustment_items := adjustment_items || jsonb_build_array(jsonb_build_object('points',-10,'label','Primarily audit / assurance with little SMB advisory'));
  end if;
  if f.primarily_wealth_management is true then
    adjustment := adjustment - 10; adjustment_items := adjustment_items || jsonb_build_array(jsonb_build_object('points',-10,'label','Primarily personal wealth management / financial planning'));
  end if;
  if f.no_business_clients is true or f.business_clients_mentioned is false then
    adjustment := adjustment - 10; adjustment_items := adjustment_items || jsonb_build_array(jsonb_build_object('points',-10,'label','No evidence of business clients'));
  end if;
  if f.inactive_or_outdated is true then
    adjustment := adjustment - 20; adjustment_items := adjustment_items || jsonb_build_array(jsonb_build_object('points',-20,'label','Firm appears closed, inactive, or clearly outdated'));
  end if;
  if institutional_adjustment < 0 then
    adjustment := adjustment + institutional_adjustment;
    adjustment_items := adjustment_items || jsonb_build_array(jsonb_build_object('points',institutional_adjustment,'label','Large firm with institutional payroll / HCM operation'));
  end if;

  final_score := greatest(0, least(100, fit + opportunity + readiness + adjustment));
  insufficient_research := not has_smb_focus and f.business_clients_mentioned is null
    and not has_bookkeeping and not has_cas and not has_business_tax and f.payroll_mentioned is null;

  partner_type_value := case
    when final_score < 50 or f.primarily_individual_tax is true or f.national_tax_franchise is true
      or f.inactive_or_outdated is true or f.primarily_wealth_management is true
      or (f.primarily_audit_assurance is true and not has_cas) then 'Low Fit'::public.partner_type
    when insufficient_research then 'Needs Research'::public.partner_type
    when is_accounting_type and has_smb_focus and fit >= 48 then 'Strategic CPA Partner'::public.partner_type
    when payroll_absent and has_business_clients then 'Referral Payroll Partner'::public.partner_type
    when payroll_offered and recurring_services then 'Wholesale Payroll Partner'::public.partner_type
    when is_bookkeeping_type and has_bookkeeping and not is_accounting_type then 'Bookkeeping Partner'::public.partner_type
    when is_tax_type and has_business_tax then 'Tax / EA Partner'::public.partner_type
    else 'Needs Research'::public.partner_type
  end;

  select coalesce(array_agg(item->>'label'), '{}')
  into reasons
  from jsonb_array_elements(fit_items || opportunity_items || readiness_items || adjustment_items) item
  where coalesce((item->>'points')::integer, 0) <> 0;

  return jsonb_build_object(
    'partnerFit', jsonb_build_object('score',fit,'max',60,'items',fit_items),
    'partnershipOpportunity', jsonb_build_object('score',opportunity,'max',25,'items',opportunity_items),
    'outreachReadiness', jsonb_build_object('score',readiness,'max',15,'items',readiness_items),
    'adjustments', adjustment_items,
    'adjustmentTotal', adjustment,
    'preAdjustmentTotal', fit + opportunity + readiness,
    'total', final_score,
    'grade', case when final_score >= 90 then 'A+' when final_score >= 80 then 'A' when final_score >= 65 then 'B' when final_score >= 50 then 'C' else 'D' end,
    'topTarget', fit >= 48 and opportunity >= 18,
    'partnerType', partner_type_value::text,
    'reason', array_to_string(reasons, ' · ')
  );
end
$$;

create or replace function public.prepare_firm()
returns trigger
language plpgsql
set search_path = ''
as $$
declare scoring jsonb;
begin
  new.normalized_name := public.normalize_name(new.firm_name);
  if new.website is not null then
    new.domain := coalesce(public.normalize_domain(new.domain), public.normalize_domain(new.website));
  elsif new.domain is not null then
    new.domain := public.normalize_domain(new.domain);
  end if;

  scoring := public.calculate_firm_scoring(new);
  new.partner_fit_score := (scoring->'partnerFit'->>'score')::integer;
  new.partnership_opportunity_score := (scoring->'partnershipOpportunity'->>'score')::integer;
  new.outreach_readiness_score := (scoring->'outreachReadiness'->>'score')::integer;
  new.total_partner_score := (scoring->>'total')::integer;
  new.partner_score := new.total_partner_score;
  new.partner_grade := (scoring->>'grade')::public.partner_grade;
  new.top_target := (scoring->>'topTarget')::boolean;
  new.recommended_partner_type := (scoring->>'partnerType')::public.partner_type;
  new.score_reason := scoring->>'reason';
  new.scoring_breakdown := scoring;
  new.suggested_approach := new.recommended_partner_type::text;
  new.personalization_note := concat_ws(' ',
    coalesce(new.city,'Texas'),
    lower(coalesce(new.firm_types[1],'accounting firm')) || case when new.business_clients_mentioned is true or new.smb_focus then ' focused on small-business clients.' else '.' end,
    case when new.provides_quickbooks_services or new.quickbooks_mentioned is true or new.xero_partner or new.xero_mentioned is true then 'Supports SMB accounting systems.' end,
    case when new.provides_payroll or new.payroll_mentioned is true then 'Payroll is offered; explore wholesale support.' when new.payroll_mentioned is false then 'Payroll is not offered; explore a referral partnership.' else 'Payroll offering still needs research.' end
  );
  new.suggested_conversation_angle := case
    when new.recommended_partner_type = 'Wholesale Payroll Partner' then 'Explore wholesale or outsourced payroll capacity and service support.'
    when new.recommended_partner_type = 'Referral Payroll Partner' then 'Lead with a reciprocal small-business referral partnership centered on payroll.'
    when new.recommended_partner_type = 'Strategic CPA Partner' then 'Lead with a broader strategic alliance for shared small-business clients.'
    else coalesce(new.suggested_conversation_angle, 'Research the firm further before selecting an outreach angle.')
  end;
  return new;
end
$$;

create or replace function public.rescore_research_evidence_firm()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.firms set updated_at = now() where id = coalesce(new.firm_id, old.firm_id);
  return coalesce(new, old);
end
$$;

drop trigger if exists research_evidence_rescore on public.research_evidence;
create trigger research_evidence_rescore
after insert or update or delete on public.research_evidence
for each row execute function public.rescore_research_evidence_firm();

create or replace function public.apply_candidate_scoring_findings()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  institutional_confidence public.confidence_level;
begin
  if new.review_status = 'Approved' and new.resulting_firm_id is not null
    and (old.review_status is distinct from new.review_status or old.resulting_firm_id is distinct from new.resulting_firm_id)
  then
    select confidence into institutional_confidence
    from public.candidate_research_findings
    where firm_candidate_id = new.id and review_status = 'Accepted'
      and attribute_name = 'institutional_payroll_operation' and proposed_value = 'true'::jsonb
    order by case confidence when 'High' then 1 when 'Medium' then 2 else 3 end
    limit 1;

    update public.firms f set
      payroll_mentioned = case
        when exists(select 1 from public.candidate_research_findings x where x.firm_candidate_id=new.id and x.review_status='Accepted' and x.attribute_name='provides_payroll' and x.proposed_value='true'::jsonb) then true
        when exists(select 1 from public.candidate_research_findings x where x.firm_candidate_id=new.id and x.review_status='Accepted' and x.attribute_name='payroll_not_offered' and x.proposed_value='true'::jsonb) then false
        else f.payroll_mentioned end,
      bookkeeping_mentioned = case when exists(select 1 from public.candidate_research_findings x where x.firm_candidate_id=new.id and x.review_status='Accepted' and x.attribute_name='provides_bookkeeping' and x.proposed_value='true'::jsonb) then true else f.bookkeeping_mentioned end,
      tax_mentioned = case when exists(select 1 from public.candidate_research_findings x where x.firm_candidate_id=new.id and x.review_status='Accepted' and x.attribute_name='provides_tax' and x.proposed_value='true'::jsonb) then true else f.tax_mentioned end,
      cas_mentioned = case when exists(select 1 from public.candidate_research_findings x where x.firm_candidate_id=new.id and x.review_status='Accepted' and x.attribute_name='provides_cas' and x.proposed_value='true'::jsonb) then true else f.cas_mentioned end,
      advisory_mentioned = case when exists(select 1 from public.candidate_research_findings x where x.firm_candidate_id=new.id and x.review_status='Accepted' and x.attribute_name='provides_business_advisory' and x.proposed_value='true'::jsonb) then true else f.advisory_mentioned end,
      quickbooks_mentioned = case when exists(select 1 from public.candidate_research_findings x where x.firm_candidate_id=new.id and x.review_status='Accepted' and x.attribute_name='provides_quickbooks_services' and x.proposed_value='true'::jsonb) then true else f.quickbooks_mentioned end,
      xero_mentioned = case when exists(select 1 from public.candidate_research_findings x where x.firm_candidate_id=new.id and x.review_status='Accepted' and x.attribute_name='xero_partner' and x.proposed_value='true'::jsonb) then true else f.xero_mentioned end,
      small_business_mentioned = case when exists(select 1 from public.candidate_research_findings x where x.firm_candidate_id=new.id and x.review_status='Accepted' and x.attribute_name='smb_focus' and x.proposed_value='true'::jsonb) then true else f.small_business_mentioned end,
      business_clients_mentioned = case when exists(select 1 from public.candidate_research_findings x where x.firm_candidate_id=new.id and x.review_status='Accepted' and (x.attribute_name='business_client_focus' or (x.attribute_name='smb_focus' and x.proposed_value='true'::jsonb))) then true else f.business_clients_mentioned end,
      ideal_client_size_match = case when exists(select 1 from public.candidate_research_findings x where x.firm_candidate_id=new.id and x.review_status='Accepted' and x.attribute_name='ideal_client_size_match' and x.proposed_value='true'::jsonb) then true else f.ideal_client_size_match end,
      locally_owned = case when exists(select 1 from public.candidate_research_findings x where x.firm_candidate_id=new.id and x.review_status='Accepted' and x.attribute_name='locally_owned' and x.proposed_value='true'::jsonb) then true else f.locally_owned end,
      payroll_secondary_service = case when exists(select 1 from public.candidate_research_findings x where x.firm_candidate_id=new.id and x.review_status='Accepted' and x.attribute_name='payroll_secondary_service' and x.proposed_value='true'::jsonb) then true else f.payroll_secondary_service end,
      small_local_practice = case when exists(select 1 from public.candidate_research_findings x where x.firm_candidate_id=new.id and x.review_status='Accepted' and x.attribute_name='small_local_practice' and x.proposed_value='true'::jsonb) then true else f.small_local_practice end,
      primarily_individual_tax = case when exists(select 1 from public.candidate_research_findings x where x.firm_candidate_id=new.id and x.review_status='Accepted' and x.attribute_name='primarily_individual_tax' and x.proposed_value='true'::jsonb) then true else f.primarily_individual_tax end,
      primarily_audit_assurance = case when exists(select 1 from public.candidate_research_findings x where x.firm_candidate_id=new.id and x.review_status='Accepted' and x.attribute_name='primarily_audit_assurance' and x.proposed_value='true'::jsonb) then true else f.primarily_audit_assurance end,
      primarily_wealth_management = case when exists(select 1 from public.candidate_research_findings x where x.firm_candidate_id=new.id and x.review_status='Accepted' and x.attribute_name='primarily_wealth_management' and x.proposed_value='true'::jsonb) then true else f.primarily_wealth_management end,
      no_business_clients = case when exists(select 1 from public.candidate_research_findings x where x.firm_candidate_id=new.id and x.review_status='Accepted' and x.attribute_name='no_business_clients' and x.proposed_value='true'::jsonb) then true else f.no_business_clients end,
      national_tax_franchise = case when exists(select 1 from public.candidate_research_findings x where x.firm_candidate_id=new.id and x.review_status='Accepted' and x.attribute_name='national_tax_franchise' and x.proposed_value='true'::jsonb) then true else f.national_tax_franchise end,
      inactive_or_outdated = case when exists(select 1 from public.candidate_research_findings x where x.firm_candidate_id=new.id and x.review_status='Accepted' and x.attribute_name='inactive_or_outdated' and x.proposed_value='true'::jsonb) then true else f.inactive_or_outdated end,
      institutional_payroll_operation = case when institutional_confidence is not null then true else f.institutional_payroll_operation end,
      institutional_payroll_adjustment = case institutional_confidence when 'High' then -20 when 'Medium' then -15 when 'Low' then -10 else f.institutional_payroll_adjustment end
    where f.id = new.resulting_firm_id;
  end if;
  return new;
end
$$;

drop trigger if exists firm_candidates_apply_scoring_findings on public.firm_candidates;
create trigger firm_candidates_apply_scoring_findings
after update of review_status, resulting_firm_id on public.firm_candidates
for each row execute function public.apply_candidate_scoring_findings();

update public.firms set updated_at = now();

create or replace view public.firm_contact_readiness with (security_invoker = true) as
select f.id as firm_id,
  exists(select 1 from public.contacts c where c.firm_id=f.id and c.is_decision_maker) as decision_maker_found,
  exists(select 1 from public.contacts c where c.firm_id=f.id and c.is_decision_maker and nullif(c.email,'') is not null and coalesce(c.email_status,'') <> 'Invalid') as decision_maker_email_found,
  exists(select 1 from public.contacts c where c.firm_id=f.id and c.is_primary_contact and c.is_decision_maker and nullif(c.email,'') is not null and coalesce(c.email_status,'') <> 'Invalid') as primary_contact_complete,
  f.partner_grade in ('A+','A','B') and exists(select 1 from public.contacts c where c.firm_id=f.id and c.is_primary_contact and nullif(c.email,'') is not null and coalesce(c.email_status,'') <> 'Invalid')
    and not exists(select 1 from public.outreach o where o.firm_id=f.id and o.response_status in ('Partner','Not Interested')) as ready_for_outreach
from public.firms f;

revoke execute on function public.calculate_firm_scoring(public.firms) from public, anon;
grant execute on function public.calculate_firm_scoring(public.firms) to authenticated;
