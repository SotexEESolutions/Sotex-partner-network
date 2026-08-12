import type { SupabaseClient } from "@supabase/supabase-js";
import type { Activity, Contact, Firm, Grade, Priority } from "@/lib/types";

export type ContactRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  role_category: string | null;
  email: string | null;
  email_status: string | null;
  direct_phone: string | null;
  linkedin_url: string | null;
  is_primary_contact: boolean;
  is_decision_maker: boolean;
};

export type OutreachRow = {
  id: string;
  outreach_type: Activity["type"];
  sent_date: string;
  response_status: string | null;
  notes: string | null;
  next_follow_up_date: string | null;
};

type FirmRow = {
  id: string;
  firm_name: string;
  normalized_name: string;
  website: string | null;
  domain: string | null;
  phone: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state: string;
  zip_code: string | null;
  region: string | null;
  market: string | null;
  firm_types: string[];
  employee_count: number | null;
  employee_count_range: string | null;
  estimated_client_count: number | null;
  provides_tax: boolean;
  provides_bookkeeping: boolean;
  provides_accounting: boolean;
  provides_payroll: boolean;
  provides_cas: boolean;
  provides_audit: boolean;
  provides_business_advisory: boolean;
  provides_financial_planning: boolean;
  provides_wealth_management: boolean;
  provides_quickbooks_services: boolean;
  quickbooks_proadvisor: boolean;
  xero_partner: boolean;
  spanish_speaking: boolean;
  smb_focus: boolean;
  industry_specialties: string[];
  notes: string | null;
  partner_score: number;
  partner_grade: Grade;
  score_reason: string | null;
  target_priority: Priority | null;
  suggested_approach: string | null;
  personalization_note: string | null;
  source: string | null;
  source_url: string | null;
  google_maps_url: string | null;
  linkedin_company_url: string | null;
  data_confidence: string | null;
  research_status: string;
  enrichment_status: string;
  business_client_focus: string | null;
  recommended_partner_type: string | null;
  suggested_conversation_angle: string | null;
  about_page_url: string | null;
  services_page_url: string | null;
  leadership_page_url: string | null;
  contact_page_url: string | null;
  payroll_mentioned: boolean | null;
  bookkeeping_mentioned: boolean | null;
  tax_mentioned: boolean | null;
  cas_mentioned: boolean | null;
  outsourced_accounting_mentioned: boolean | null;
  advisory_mentioned: boolean | null;
  quickbooks_mentioned: boolean | null;
  xero_mentioned: boolean | null;
  spanish_mentioned: boolean | null;
  small_business_mentioned: boolean | null;
  business_clients_mentioned: boolean | null;
  primarily_individual_tax: boolean | null;
  primarily_audit_assurance: boolean | null;
  created_at: string;
  updated_at: string;
  contacts: ContactRow[] | null;
  outreach: OutreachRow[] | null;
};

const SERVICE_FLAGS: Array<[keyof FirmRow, string]> = [
  ["provides_tax", "Tax"],
  ["provides_bookkeeping", "Bookkeeping"],
  ["provides_accounting", "Accounting"],
  ["provides_payroll", "Payroll"],
  ["provides_cas", "CAS"],
  ["provides_audit", "Audit"],
  ["provides_business_advisory", "Business advisory"],
];

function mapServices(row: FirmRow): string[] {
  const services = SERVICE_FLAGS.filter(([key]) => Boolean(row[key])).map(([, label]) => label);
  if (row.provides_quickbooks_services || row.quickbooks_proadvisor) services.push("QuickBooks");
  if (row.xero_partner) services.push("Xero");
  return services;
}

export function mapContactRow(row: ContactRow): Contact {
  return {
    id: row.id,
    firstName: row.first_name ?? "",
    lastName: row.last_name ?? "",
    title: row.title ?? "",
    role: row.role_category ?? "",
    email: row.email ?? "",
    phone: row.direct_phone ?? "",
    linkedin: row.linkedin_url ?? undefined,
    primary: row.is_primary_contact,
    decisionMaker: row.is_decision_maker,
    emailStatus: row.email_status ?? undefined,
  };
}

export function mapOutreachRow(row: OutreachRow): Activity {
  return {
    id: row.id,
    type: row.outreach_type,
    date: row.sent_date.slice(0, 10),
    status: row.response_status ?? "No Response",
    notes: row.notes ?? "",
    nextFollowUp: row.next_follow_up_date ?? undefined,
  };
}

export function mapFirmRow(row: FirmRow): Firm {
  return {
    id: row.id,
    name: row.firm_name,
    normalizedName: row.normalized_name,
    website: row.website ?? "",
    domain: row.domain ?? "",
    phone: row.phone ?? "",
    addressLine1: row.address_line_1 ?? "",
    addressLine2: row.address_line_2 ?? "",
    city: row.city ?? "",
    state: row.state,
    zipCode: row.zip_code ?? "",
    region: row.region ?? "",
    market: row.market ?? "",
    type: row.firm_types[0] ?? "Other",
    firmTypes: row.firm_types ?? [],
    employees: row.employee_count,
    employeeCountRange: row.employee_count_range ?? "",
    estimatedClientCount: row.estimated_client_count,
    services: mapServices(row),
    providesTax: row.provides_tax,
    providesBookkeeping: row.provides_bookkeeping,
    providesAccounting: row.provides_accounting,
    providesPayroll: row.provides_payroll,
    providesCas: row.provides_cas,
    providesAudit: row.provides_audit,
    providesBusinessAdvisory: row.provides_business_advisory,
    providesFinancialPlanning: row.provides_financial_planning,
    providesWealthManagement: row.provides_wealth_management,
    providesQuickbooksServices: row.provides_quickbooks_services,
    quickbooksProadvisor: row.quickbooks_proadvisor,
    xeroPartner: row.xero_partner,
    smb: row.smb_focus,
    spanish: row.spanish_speaking,
    industries: row.industry_specialties ?? [],
    score: row.partner_score,
    grade: row.partner_grade,
    priority: row.target_priority ?? "Medium",
    researchStatus: row.research_status,
    enrichmentStatus: row.enrichment_status,
    confidence: row.data_confidence ?? "Medium",
    source: row.source ?? "",
    sourceUrl: row.source_url ?? "",
    googleMapsUrl: row.google_maps_url ?? "",
    linkedinCompanyUrl: row.linkedin_company_url ?? "",
    aboutPageUrl: row.about_page_url ?? "",
    servicesPageUrl: row.services_page_url ?? "",
    leadershipPageUrl: row.leadership_page_url ?? "",
    contactPageUrl: row.contact_page_url ?? "",
    notes: row.notes ?? "",
    scoreReason: row.score_reason ?? "",
    approach: row.suggested_approach ?? "",
    personalizationNote: row.personalization_note ?? "",
    partnerType: row.recommended_partner_type ?? undefined,
    businessClientFocus: row.business_client_focus ?? undefined,
    suggestedConversationAngle: row.suggested_conversation_angle ?? undefined,
    research: {
      payrollMentioned: row.payroll_mentioned,
      bookkeepingMentioned: row.bookkeeping_mentioned,
      taxMentioned: row.tax_mentioned,
      casMentioned: row.cas_mentioned,
      outsourcedAccountingMentioned: row.outsourced_accounting_mentioned,
      advisoryMentioned: row.advisory_mentioned,
      quickbooksMentioned: row.quickbooks_mentioned,
      xeroMentioned: row.xero_mentioned,
      spanishMentioned: row.spanish_mentioned,
      smallBusinessMentioned: row.small_business_mentioned,
      businessClientsMentioned: row.business_clients_mentioned,
      primarilyIndividualTax: row.primarily_individual_tax,
      primarilyAuditAssurance: row.primarily_audit_assurance,
    },
    contacts: (row.contacts ?? []).map(mapContactRow),
    outreach: (row.outreach ?? []).map(mapOutreachRow),
    createdAt: row.created_at.slice(0, 10),
    updatedAt: row.updated_at,
  };
}

const FIRM_SELECT = "*, contacts(*), outreach(*)";

export async function fetchFirms(supabase: SupabaseClient): Promise<Firm[]> {
  const { data, error } = await supabase
    .from("firms")
    .select(FIRM_SELECT)
    .order("partner_score", { ascending: false })
    .returns<FirmRow[]>();
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapFirmRow);
}

export async function fetchFirmById(supabase: SupabaseClient, id: string): Promise<Firm> {
  const { data, error } = await supabase
    .from("firms")
    .select(FIRM_SELECT)
    .eq("id", id)
    .single<FirmRow>();
  if (error) throw new Error(error.message);
  return mapFirmRow(data);
}

export type NewContactParams = {
  firmId: string;
  firstName: string;
  lastName: string;
  title: string;
  role: string;
  email: string;
  phone: string;
  linkedin: string;
  emailStatus: string;
  primary: boolean;
  decisionMaker: boolean;
};

export async function insertContact(supabase: SupabaseClient, params: NewContactParams): Promise<{ contact: Contact } | { error: unknown }> {
  const { data, error } = await supabase
    .from("contacts")
    .insert({
      firm_id: params.firmId,
      first_name: params.firstName || null,
      last_name: params.lastName || null,
      title: params.title || null,
      role_category: params.role || null,
      email: params.email || null,
      direct_phone: params.phone || null,
      linkedin_url: params.linkedin || null,
      email_status: params.emailStatus || null,
      is_primary_contact: params.primary,
      is_decision_maker: params.decisionMaker,
    })
    .select("*")
    .single<ContactRow>();
  if (error || !data) return { error };
  return { contact: mapContactRow(data) };
}

export type NewOutreachParams = {
  firmId: string;
  contactId: string | null;
  type: Activity["type"];
  responseStatus: string;
  notes: string;
  nextFollowUp: string;
};

export async function insertOutreach(supabase: SupabaseClient, params: NewOutreachParams): Promise<{ outreach: Activity } | { error: unknown }> {
  const { data, error } = await supabase
    .from("outreach")
    .insert({
      firm_id: params.firmId,
      contact_id: params.contactId,
      outreach_type: params.type,
      response_status: params.responseStatus || null,
      notes: params.notes || null,
      next_follow_up_date: params.nextFollowUp || null,
    })
    .select("*")
    .single<OutreachRow>();
  if (error || !data) return { error };
  return { outreach: mapOutreachRow(data) };
}

export type UpdateFirmParams = {
  firmName: string;
  website: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  zipCode: string;
  region: string;
  market: string;
  firmTypes: string[];
  employeeCount: number | null;
  businessClientFocus: string;
  industrySpecialties: string[];
  providesTax: boolean;
  providesBookkeeping: boolean;
  providesAccounting: boolean;
  providesPayroll: boolean;
  providesCas: boolean;
  providesAudit: boolean;
  providesBusinessAdvisory: boolean;
  providesFinancialPlanning: boolean;
  providesWealthManagement: boolean;
  providesQuickbooksServices: boolean;
  quickbooksProadvisor: boolean;
  xeroPartner: boolean;
  spanishSpeaking: boolean;
  smbFocus: boolean;
  researchStatus: string;
  dataConfidence: string;
  source: string;
  sourceUrl: string;
  googleMapsUrl: string;
  linkedinCompanyUrl: string;
  aboutPageUrl: string;
  servicesPageUrl: string;
  leadershipPageUrl: string;
  contactPageUrl: string;
  notes: string;
  payrollMentioned: boolean | null;
  bookkeepingMentioned: boolean | null;
  taxMentioned: boolean | null;
  casMentioned: boolean | null;
  outsourcedAccountingMentioned: boolean | null;
  advisoryMentioned: boolean | null;
  quickbooksMentioned: boolean | null;
  xeroMentioned: boolean | null;
  spanishMentioned: boolean | null;
  smallBusinessMentioned: boolean | null;
  businessClientsMentioned: boolean | null;
  primarilyIndividualTax: boolean | null;
  primarilyAuditAssurance: boolean | null;
};

export async function updateFirm(supabase: SupabaseClient, id: string, params: UpdateFirmParams): Promise<{ firm: Firm } | { error: unknown }> {
  const { data, error } = await supabase
    .from("firms")
    .update({
      firm_name: params.firmName,
      website: params.website || null,
      phone: params.phone || null,
      address_line_1: params.addressLine1 || null,
      address_line_2: params.addressLine2 || null,
      city: params.city || null,
      state: params.state,
      zip_code: params.zipCode || null,
      region: params.region || null,
      market: params.market || null,
      firm_types: params.firmTypes,
      employee_count: params.employeeCount,
      business_client_focus: params.businessClientFocus || null,
      industry_specialties: params.industrySpecialties,
      provides_tax: params.providesTax,
      provides_bookkeeping: params.providesBookkeeping,
      provides_accounting: params.providesAccounting,
      provides_payroll: params.providesPayroll,
      provides_cas: params.providesCas,
      provides_audit: params.providesAudit,
      provides_business_advisory: params.providesBusinessAdvisory,
      provides_financial_planning: params.providesFinancialPlanning,
      provides_wealth_management: params.providesWealthManagement,
      provides_quickbooks_services: params.providesQuickbooksServices,
      quickbooks_proadvisor: params.quickbooksProadvisor,
      xero_partner: params.xeroPartner,
      spanish_speaking: params.spanishSpeaking,
      smb_focus: params.smbFocus,
      research_status: params.researchStatus,
      data_confidence: params.dataConfidence,
      source: params.source || null,
      source_url: params.sourceUrl || null,
      google_maps_url: params.googleMapsUrl || null,
      linkedin_company_url: params.linkedinCompanyUrl || null,
      about_page_url: params.aboutPageUrl || null,
      services_page_url: params.servicesPageUrl || null,
      leadership_page_url: params.leadershipPageUrl || null,
      contact_page_url: params.contactPageUrl || null,
      notes: params.notes || null,
      payroll_mentioned: params.payrollMentioned,
      bookkeeping_mentioned: params.bookkeepingMentioned,
      tax_mentioned: params.taxMentioned,
      cas_mentioned: params.casMentioned,
      outsourced_accounting_mentioned: params.outsourcedAccountingMentioned,
      advisory_mentioned: params.advisoryMentioned,
      quickbooks_mentioned: params.quickbooksMentioned,
      xero_mentioned: params.xeroMentioned,
      spanish_mentioned: params.spanishMentioned,
      small_business_mentioned: params.smallBusinessMentioned,
      business_clients_mentioned: params.businessClientsMentioned,
      primarily_individual_tax: params.primarilyIndividualTax,
      primarily_audit_assurance: params.primarilyAuditAssurance,
    })
    .eq("id", id)
    .select(FIRM_SELECT)
    .single<FirmRow>();
  if (error || !data) return { error };
  return { firm: mapFirmRow(data) };
}
