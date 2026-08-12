-- Keep the database-controlled firm domain synchronized with website edits.
-- Preserve an explicitly supplied domain when a firm has never had a website.

create or replace function public.sync_firm_domain_from_website()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.website is not null and btrim(new.website) <> '' then
    new.domain := public.normalize_domain(new.website);
  elsif tg_op = 'UPDATE' and old.website is not null then
    new.domain := null;
  end if;

  return new;
end
$$;

create trigger firms_domain_sync
before insert or update of website on public.firms
for each row execute function public.sync_firm_domain_from_website();
