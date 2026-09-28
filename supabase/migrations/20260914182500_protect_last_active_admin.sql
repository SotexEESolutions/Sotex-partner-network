create or replace function private.protect_last_active_admin()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.role='Admin' and old.is_active and (
    tg_op='DELETE' or new.role<>'Admin' or not new.is_active
  ) and not exists(
    select 1 from public.profiles p where p.id<>old.id and p.role='Admin' and p.is_active
  ) then
    raise exception 'At least one active administrator is required';
  end if;
  return case when tg_op='DELETE' then old else new end;
end
$$;
revoke all on function private.protect_last_active_admin() from public,anon,authenticated;
create trigger profiles_protect_last_admin before update of role,is_active or delete on public.profiles for each row execute function private.protect_last_active_admin();
