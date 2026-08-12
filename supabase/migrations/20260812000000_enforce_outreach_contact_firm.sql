-- Ensure an outreach contact always belongs to the outreach firm.
-- Keep the firm association when a referenced contact is deleted.

alter table public.contacts
  add constraint contacts_id_firm_id_key unique (id, firm_id);

alter table public.outreach
  drop constraint outreach_contact_id_fkey,
  add constraint outreach_contact_firm_id_fkey
    foreign key (contact_id, firm_id)
    references public.contacts (id, firm_id)
    on delete set null (contact_id);
