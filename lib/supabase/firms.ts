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
  website: string | null;
  phone: string | null;
  city: string | null;
  state: string;
  region: string | null;
  firm_types: string[];
  employee_count: number | null;
  provides_tax: boolean;
  provides_bookkeeping: boolean;
  provides_accounting: boolean;
  provides_payroll: boolean;
  provides_cas: boolean;
  provides_audit: boolean;
  provides_business_advisory: boolean;
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
  data_confidence: string | null;
  research_status: string;
  business_client_focus: string | null;
  recommended_partner_type: string | null;
  suggested_conversation_angle: string | null;
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
  created_at: string;
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
    website: row.website ?? "",
    phone: row.phone ?? "",
    city: row.city ?? "",
    state: row.state,
    region: row.region ?? "",
    type: row.firm_types[0] ?? "Other",
    employees: row.employee_count,
    services: mapServices(row),
    smb: row.smb_focus,
    spanish: row.spanish_speaking,
    industries: row.industry_specialties ?? [],
    score: row.partner_score,
    grade: row.partner_grade,
    priority: row.target_priority ?? "Medium",
    researchStatus: row.research_status,
    confidence: row.data_confidence ?? "Medium",
    source: row.source ?? "",
    notes: row.notes ?? "",
    scoreReason: row.score_reason ?? "",
    approach: row.suggested_approach ?? "",
    personalizationNote: row.personalization_note ?? "",
    partnerType: row.recommended_partner_type ?? undefined,
    businessClientFocus: row.business_client_focus ?? undefined,
    suggestedConversationAngle: row.suggested_conversation_angle ?? undefined,
    research: {
      payroll: row.payroll_mentioned,
      bookkeeping: row.bookkeeping_mentioned,
      tax: row.tax_mentioned,
      cas: row.cas_mentioned,
      outsourcedAccounting: row.outsourced_accounting_mentioned,
      advisory: row.advisory_mentioned,
      quickbooks: row.quickbooks_mentioned,
      xero: row.xero_mentioned,
      spanish: row.spanish_mentioned,
      smallBusiness: row.small_business_mentioned,
    },
    contacts: (row.contacts ?? []).map(mapContactRow),
    outreach: (row.outreach ?? []).map(mapOutreachRow),
    createdAt: row.created_at.slice(0, 10),
  };
}

export async function fetchFirms(supabase: SupabaseClient): Promise<Firm[]> {
  const { data, error } = await supabase
    .from("firms")
    .select("*, contacts(*), outreach(*)")
    .order("partner_score", { ascending: false })
    .returns<FirmRow[]>();
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapFirmRow);
}

export async function fetchFirmById(supabase: SupabaseClient, id: string): Promise<Firm> {
  const { data, error } = await supabase
    .from("firms")
    .select("*, contacts(*), outreach(*)")
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
