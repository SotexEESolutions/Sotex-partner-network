alter function public.normalize_name(text) set search_path = '';
alter function public.normalize_domain(text) set search_path = '';
alter extension pg_trgm set schema extensions;

create index if not exists firm_candidates_possible_existing_idx on public.firm_candidates(possible_existing_firm_id);
create index if not exists firm_candidates_resulting_firm_idx on public.firm_candidates(resulting_firm_id);
create index if not exists firm_tags_tag_idx on public.firm_tags(tag_id);
create index if not exists outreach_contact_idx on public.outreach(contact_id);

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
      and extensions.similarity(f.normalized_name,new.normalized_name) >= .72
      order by extensions.similarity(f.normalized_name,new.normalized_name) desc limit 1;
    if possible_firm is not null then new.duplicate_status:='Possible Match'; new.possible_existing_firm_id:=possible_firm;
    else new.duplicate_status:='No Match'; new.possible_existing_firm_id:=null; end if;
  end if;
  return new;
end $$;
