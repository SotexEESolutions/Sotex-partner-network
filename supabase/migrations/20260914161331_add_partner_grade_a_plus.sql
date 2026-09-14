-- Enum values must be committed before they can be used by the scoring migration.
alter type public.partner_grade add value if not exists 'A+' before 'A';
alter type public.partner_type add value if not exists 'Referral Payroll Partner' before 'Wholesale Payroll Partner';
alter type public.partner_type add value if not exists 'Low Fit' after 'Needs Research';
