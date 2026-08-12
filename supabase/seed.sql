-- All names and domains below are fictional and reserved for testing.
insert into public.firms (firm_name, normalized_name, website, city, region, firm_types, employee_count, provides_tax, provides_bookkeeping, provides_accounting, provides_payroll, provides_cas, provides_audit, provides_quickbooks_services, spanish_speaking, smb_focus, industry_specialties, source, research_status) values
('Alamo Ledger Partners','alamo ledger partners','https://alamoloedger.example','San Antonio','San Antonio',array['CPA Firm'],12,true,true,true,false,true,false,true,true,true,array['construction','restaurants'],'Seed data','Complete'),
('Mission Trail Accounting','mission trail accounting','https://missiontrail.example','San Antonio','San Antonio',array['Accounting Firm'],8,true,true,true,false,false,false,true,false,true,array['trades'],'Seed data','Complete'),
('Riverstone Advisory Group','riverstone advisory group','https://riverstone.example','New Braunfels','San Antonio',array['CAS / Advisory'],18,false,true,true,true,true,false,false,false,true,array['professional services'],'Seed data','Complete'),
('Gulf Harbor Tax & Books','gulf harbor tax books','https://gulfharbor.example','Corpus Christi','Coastal Bend',array['Tax Firm'],6,true,true,false,false,false,false,false,true,true,array['hospitality','restaurants'],'Seed data','Complete'),
('Coastal Compass CPAs','coastal compass cpas','https://coastalcompass.example','Corpus Christi','Coastal Bend',array['CPA Firm'],24,true,false,true,true,true,true,false,false,false,array['manufacturing'],'Seed data','Complete'),
('Gateway Border Accounting','gateway border accounting','https://gatewayborder.example','Laredo','Laredo',array['Accounting Firm'],10,true,true,true,false,false,false,true,true,true,array['trucking','staffing'],'Seed data','Complete'),
('Palm Vista Advisors','palm vista advisors','https://palmvista.example','McAllen','Rio Grande Valley',array['CAS / Advisory'],14,true,true,true,false,true,false,true,true,true,array['medical','dental'],'Seed data','Complete'),
('Citrus Grove Bookkeeping','citrus grove bookkeeping','https://citrusgrove.example','McAllen','Rio Grande Valley',array['Bookkeeper'],4,false,true,false,false,false,false,true,true,true,array['restaurants'],'Seed data','Complete'),
('Resaca Business Services','resaca business services','https://resaca.example','Brownsville','Rio Grande Valley',array['Accounting Firm'],7,true,true,true,true,false,false,false,true,true,array['home health'],'Seed data','Complete'),
('Arroyo Tax Collective','arroyo tax collective','https://arroyotax.example','Harlingen','Rio Grande Valley',array['Enrolled Agent'],3,true,true,false,false,false,false,false,true,true,array['construction'],'Seed data','Researching'),
('Permian Basin Ledger Co','permian basin ledger co','https://permianledger.example','Midland','West Texas',array['Accounting Firm'],16,true,true,true,true,true,false,false,false,true,array['construction','trucking'],'Seed data','Complete'),
('Prairie Sky CPAs','prairie sky cpas','https://prairiesky.example','Odessa','West Texas',array['CPA Firm'],21,true,false,true,false,false,true,false,false,false,array['manufacturing'],'Seed data','Complete'),
('Peach Tree Books & Tax','peach tree books tax','https://peachtree.example','Fredericksburg','Hill Country',array['Tax Firm'],5,true,true,false,false,false,false,true,false,true,array['hospitality'],'Seed data','Complete'),
('Hill Country Balance','hill country balance','https://hillcountrybalance.example','Kerrville','Hill Country',array['Bookkeeper'],2,false,true,false,true,false,false,false,false,true,array['professional services'],'Seed data','Researching'),
('Bluebonnet Advisory Studio','bluebonnet advisory studio','https://bluebonnet.example','Boerne','San Antonio',array['CAS / Advisory'],9,false,true,true,false,true,false,true,false,true,array['medical','professional services'],'Seed data','Complete');

insert into public.contacts (firm_id, first_name, last_name, title, role_category, email, is_primary_contact, is_decision_maker, email_status)
select id, split_part(person,' ',1), split_part(person,' ',2), role, role, email, true, true, 'Verified'
from public.firms join (values
('Alamo Ledger Partners','Elena Ruiz','Managing Partner','elena@alamoloedger.example'),
('Mission Trail Accounting','Marcus Hill','Owner','marcus@missiontrail.example'),
('Riverstone Advisory Group','Avery Cole','Partner','avery@riverstone.example'),
('Gulf Harbor Tax & Books','Sofia Garza','Owner','sofia@gulfharbor.example'),
('Gateway Border Accounting','Marisol Vela','Owner','marisol@gatewayborder.example'),
('Palm Vista Advisors','Diego Salinas','Managing Partner','diego@palmvista.example'),
('Citrus Grove Bookkeeping','Lucia Mendez','Owner','lucia@citrusgrove.example'),
('Resaca Business Services','Adriana Pena','Partner','adriana@resaca.example'),
('Permian Basin Ledger Co','Grant Baker','Owner','grant@permianledger.example'),
('Prairie Sky CPAs','Megan Ortiz','Partner','megan@prairiesky.example'),
('Peach Tree Books & Tax','Henry Klein','Owner','henry@peachtree.example'),
('Bluebonnet Advisory Studio','Jordan Park','Managing Partner','jordan@bluebonnet.example')
) as c(firm,person,role,email) on firms.firm_name=c.firm;
