-- Cover the composite outreach/contact foreign key for updates and deletes.
create index outreach_contact_firm_idx
  on public.outreach (contact_id, firm_id)
  where contact_id is not null;
