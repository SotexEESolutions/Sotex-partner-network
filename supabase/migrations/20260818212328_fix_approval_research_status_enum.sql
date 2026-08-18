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
  values(c.firm_name,c.normalized_name,c.website,c.domain,v_phone,v_address,c.city,c.state,c.zip_code,c.region,c.market,v_firm_types,c.source,c.source_url,c.confidence,case when c.web_research_status in ('Complete','Needs Review') then 'Complete'::public.research_state else 'Needs Review'::public.research_state end,c.description,v_tax,v_bookkeeping,v_accounting,v_payroll,v_cas,v_audit,v_advisory,v_qb,v_xero,v_smb,v_spanish,v_industries,v_focus,v_angle,v_about,v_services,v_leadership,v_contact) returning id into new_firm_id;
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
