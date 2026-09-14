create or replace function public.merge_firm_candidate(candidate_id uuid, existing_firm_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  c public.firm_candidates;
  staged public.candidate_contacts;
  merged_contact_id uuid;
begin
  if not private.is_active_user() then raise exception 'Authentication required'; end if;
  select * into c from public.firm_candidates where id=candidate_id for update;
  if c.id is null then raise exception 'Candidate not found'; end if;
  if c.review_status not in ('New','Needs Review') or c.duplicate_status='No Match' then raise exception 'Candidate is not mergeable'; end if;
  if c.possible_existing_firm_id is distinct from existing_firm_id then raise exception 'Candidate match changed; review it again'; end if;
  if private.profile_role((select auth.uid())) not in ('Admin','Manager') then raise exception 'Manager access required'; end if;
  if not private.is_admin() and (not private.user_can_manage_territory(c.territory_id) or not private.can_edit_firm(existing_firm_id)) then raise exception 'Territory management access required'; end if;

  update public.firms f set
    website=coalesce(nullif(f.website,''),c.website), domain=coalesce(nullif(f.domain,''),c.domain),
    phone=coalesce((select proposed_value#>>'{}' from public.candidate_research_findings where firm_candidate_id=c.id and review_status='Accepted' and attribute_name='phone' order by reviewed_at desc limit 1),nullif(f.phone,''),c.phone),
    address_line_1=coalesce((select proposed_value#>>'{}' from public.candidate_research_findings where firm_candidate_id=c.id and review_status='Accepted' and attribute_name='address_line_1' order by reviewed_at desc limit 1),nullif(f.address_line_1,''),c.address_line_1),
    source_url=coalesce(nullif(f.source_url,''),c.source_url),
    provides_tax=coalesce((select (proposed_value#>>'{}')::boolean from public.candidate_research_findings where firm_candidate_id=c.id and review_status='Accepted' and attribute_name='provides_tax' order by reviewed_at desc limit 1),f.provides_tax),
    provides_bookkeeping=coalesce((select (proposed_value#>>'{}')::boolean from public.candidate_research_findings where firm_candidate_id=c.id and review_status='Accepted' and attribute_name='provides_bookkeeping' order by reviewed_at desc limit 1),f.provides_bookkeeping),
    provides_accounting=coalesce((select (proposed_value#>>'{}')::boolean from public.candidate_research_findings where firm_candidate_id=c.id and review_status='Accepted' and attribute_name='provides_accounting' order by reviewed_at desc limit 1),f.provides_accounting),
    provides_payroll=coalesce((select (proposed_value#>>'{}')::boolean from public.candidate_research_findings where firm_candidate_id=c.id and review_status='Accepted' and attribute_name='provides_payroll' order by reviewed_at desc limit 1),f.provides_payroll),
    provides_cas=coalesce((select (proposed_value#>>'{}')::boolean from public.candidate_research_findings where firm_candidate_id=c.id and review_status='Accepted' and attribute_name='provides_cas' order by reviewed_at desc limit 1),f.provides_cas),
    provides_business_advisory=coalesce((select (proposed_value#>>'{}')::boolean from public.candidate_research_findings where firm_candidate_id=c.id and review_status='Accepted' and attribute_name='provides_business_advisory' order by reviewed_at desc limit 1),f.provides_business_advisory),
    provides_audit=coalesce((select (proposed_value#>>'{}')::boolean from public.candidate_research_findings where firm_candidate_id=c.id and review_status='Accepted' and attribute_name='provides_audit' order by reviewed_at desc limit 1),f.provides_audit),
    provides_quickbooks_services=coalesce((select (proposed_value#>>'{}')::boolean from public.candidate_research_findings where firm_candidate_id=c.id and review_status='Accepted' and attribute_name='provides_quickbooks_services' order by reviewed_at desc limit 1),f.provides_quickbooks_services),
    xero_partner=coalesce((select (proposed_value#>>'{}')::boolean from public.candidate_research_findings where firm_candidate_id=c.id and review_status='Accepted' and attribute_name='xero_partner' order by reviewed_at desc limit 1),f.xero_partner),
    smb_focus=coalesce((select (proposed_value#>>'{}')::boolean from public.candidate_research_findings where firm_candidate_id=c.id and review_status='Accepted' and attribute_name='smb_focus' order by reviewed_at desc limit 1),f.smb_focus),
    spanish_speaking=coalesce((select (proposed_value#>>'{}')::boolean from public.candidate_research_findings where firm_candidate_id=c.id and review_status='Accepted' and attribute_name='spanish_speaking' order by reviewed_at desc limit 1),f.spanish_speaking),
    updated_at=now()
  where f.id=existing_firm_id;
  if not found then raise exception 'Existing firm not found'; end if;

  insert into public.research_evidence(firm_id,attribute_name,detected_value,source_url,source_text,confidence,created_by_user_id,visibility)
  select existing_firm_id,r.attribute_name,case when jsonb_typeof(r.proposed_value)='boolean' then (r.proposed_value#>>'{}')::boolean else null end,r.source_url,r.source_text,r.confidence,(select auth.uid()),'Territory'
  from public.candidate_research_findings r where r.firm_candidate_id=c.id and r.review_status='Accepted'
    and not exists(select 1 from public.research_evidence e where e.firm_id=existing_firm_id and e.attribute_name=r.attribute_name and e.source_url=r.source_url and coalesce(e.source_text,'')=coalesce(r.source_text,''));

  for staged in select * from public.candidate_contacts where firm_candidate_id=c.id and selected_for_approval and resulting_contact_id is null loop
    insert into public.contacts(firm_id,first_name,last_name,full_name,normalized_name,title,role_category,email,email_status,email_source,direct_phone,linkedin_url,is_primary_contact,is_decision_maker,source,notes)
    values(existing_firm_id,staged.first_name,staged.last_name,staged.full_name,coalesce(staged.normalized_name,public.normalize_name(nullif(trim(coalesce(staged.full_name,concat_ws(' ',staged.first_name,staged.last_name))),''))),staged.title,staged.role_category,staged.email,staged.email_status,staged.provider,staged.direct_phone,staged.linkedin_url,staged.is_primary_contact,staged.is_decision_maker,staged.provider,'Merged from staged candidate contact')
    on conflict do nothing;
    select id into merged_contact_id from public.contacts where firm_id=existing_firm_id and ((nullif(staged.email,'') is not null and lower(email)=lower(staged.email)) or (nullif(staged.email,'') is null and normalized_name=staged.normalized_name)) order by created_at limit 1;
    if merged_contact_id is not null then update public.candidate_contacts set resulting_contact_id=merged_contact_id,approved_at=now() where id=staged.id; end if;
  end loop;

  update public.firm_candidates set review_status='Duplicate',resulting_firm_id=existing_firm_id,reviewed_at=now() where id=c.id;
  perform private.write_audit_event('candidate_merged','firm_candidate',c.id,c.territory_id,jsonb_build_object('resulting_firm_id',existing_firm_id,'created_by_user_id',c.created_by_user_id));
  return existing_firm_id;
end
$$;
revoke all on function public.merge_firm_candidate(uuid,uuid) from public,anon;
grant execute on function public.merge_firm_candidate(uuid,uuid) to authenticated;
comment on function public.merge_firm_candidate(uuid,uuid) is 'Management-only candidate merge that fills missing firm data and copies only reviewer-accepted evidence and selected contacts.';
