import type { SupabaseClient } from "@supabase/supabase-js";
import type { CandidateContact, CandidateStatus, ContactFieldStatus, ContactResearchStatus, DiscoveryJob, DuplicateStatus, FirmCandidate } from "@/lib/types";

export type FirmCandidateRow = {
  id: string;
  discovery_job_id: string | null;
  firm_name: string;
  website: string | null;
  domain: string | null;
  phone: string | null;
  address_line_1: string | null;
  city: string;
  state: string;
  zip_code: string | null;
  region: string | null;
  market: string | null;
  possible_firm_type: string | null;
  source: string;
  source_url: string | null;
  description: string | null;
  duplicate_status: DuplicateStatus;
  possible_existing_firm_id: string | null;
  confidence: "High" | "Medium" | "Low";
  review_status: CandidateStatus;
  resulting_firm_id: string | null;
  created_at: string;
  reviewed_at: string | null;
  contact_research_status: ContactResearchStatus;
  contact_researched_at: string | null;
};

export type CandidateContactRow = {
  id: string;
  firm_candidate_id: string;
  provider: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  title: string | null;
  role_category: string | null;
  email: string | null;
  email_status: ContactFieldStatus;
  direct_phone: string | null;
  phone_status: ContactFieldStatus;
  linkedin_url: string | null;
  confidence: "High" | "Medium" | "Low";
  is_primary_contact: boolean;
  is_decision_maker: boolean;
  selected_for_approval: boolean;
  source_url: string | null;
  created_at: string;
};

type DiscoveryJobRow = {
  id: string;
  city: string;
  market: string | null;
  region: string;
  state: string;
  search_category: string;
  search_query: string;
  source: string;
  status: string;
  records_found: number;
  records_imported: number;
  records_rejected: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  requested_categories: string[] | null;
  target_candidates: number;
  queries_attempted: number;
  queries_total: number;
  candidates_duplicate_existing: number;
  firm_matches_flagged: number;
  error_message: string | null;
  estimated_requests: number;
  actual_requests: number;
  estimated_cost_usd: number | null;
  requested_by: string | null;
};

export function mapCandidateRow(row: FirmCandidateRow): FirmCandidate {
  return {
    id: row.id,
    jobId: row.discovery_job_id ?? "",
    name: row.firm_name,
    website: row.website ?? "",
    domain: row.domain ?? "",
    phone: row.phone ?? "",
    address: row.address_line_1 ?? "",
    city: row.city,
    state: row.state,
    zip: row.zip_code ?? "",
    region: row.region ?? "",
    market: row.market ?? "",
    type: row.possible_firm_type ?? "Other",
    source: row.source,
    sourceUrl: row.source_url ?? "",
    description: row.description ?? "",
    duplicateStatus: row.duplicate_status,
    possibleExistingFirmId: row.possible_existing_firm_id ?? undefined,
    confidence: row.confidence,
    reviewStatus: row.review_status,
    resultingFirmId: row.resulting_firm_id ?? undefined,
    reviewedAt: row.reviewed_at ?? undefined,
    createdAt: row.created_at.slice(0, 10),
    contactResearchStatus: row.contact_research_status,
    contactResearchedAt: row.contact_researched_at ?? undefined,
  };
}

export function mapCandidateContactRow(row: CandidateContactRow): CandidateContact {
  return {
    id: row.id,
    candidateId: row.firm_candidate_id,
    firstName: row.first_name ?? "",
    lastName: row.last_name ?? "",
    fullName: row.full_name ?? "",
    title: row.title ?? "",
    roleCategory: row.role_category ?? "",
    email: row.email ?? "",
    emailStatus: row.email_status,
    directPhone: row.direct_phone ?? "",
    phoneStatus: row.phone_status,
    linkedin: row.linkedin_url ?? "",
    confidence: row.confidence,
    isPrimary: row.is_primary_contact,
    isDecisionMaker: row.is_decision_maker,
    selectedForApproval: row.selected_for_approval,
    source: row.provider,
    sourceUrl: row.source_url ?? "",
    createdAt: row.created_at,
  };
}

function mapJobRow(row: DiscoveryJobRow): DiscoveryJob {
  return {
    id: row.id,
    city: row.city,
    market: row.market ?? "",
    region: row.region,
    state: row.state,
    searchCategory: row.search_category,
    searchQuery: row.search_query,
    source: row.source,
    status: row.status,
    recordsFound: row.records_found,
    recordsImported: row.records_imported,
    recordsRejected: row.records_rejected,
    startedAt: row.started_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
    createdAt: row.created_at.slice(0, 10),
    requestedCategories: row.requested_categories ?? [],
    targetCandidates: row.target_candidates,
    queriesAttempted: row.queries_attempted,
    queriesTotal: row.queries_total,
    candidatesDuplicateExisting: row.candidates_duplicate_existing,
    firmMatchesFlagged: row.firm_matches_flagged,
    errorMessage: row.error_message ?? undefined,
    estimatedRequests: row.estimated_requests,
    actualRequests: row.actual_requests,
    estimatedCostUsd: row.estimated_cost_usd,
    requestedBy: row.requested_by ?? undefined,
  };
}

export async function fetchCandidates(supabase: SupabaseClient): Promise<FirmCandidate[]> {
  const { data, error } = await supabase
    .from("firm_candidates")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<FirmCandidateRow[]>();
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapCandidateRow);
}

export async function fetchCandidateById(supabase: SupabaseClient, id: string): Promise<FirmCandidate> {
  const { data, error } = await supabase
    .from("firm_candidates")
    .select("*")
    .eq("id", id)
    .single<FirmCandidateRow>();
  if (error) throw new Error(error.message);
  return mapCandidateRow(data);
}

export async function fetchDiscoveryJobs(supabase: SupabaseClient): Promise<DiscoveryJob[]> {
  const { data, error } = await supabase
    .from("discovery_jobs")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<DiscoveryJobRow[]>();
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapJobRow);
}

export async function fetchCandidateContacts(supabase: SupabaseClient, candidateId: string): Promise<CandidateContact[]> {
  const { data, error } = await supabase
    .from("candidate_contacts")
    .select("*")
    .eq("firm_candidate_id", candidateId)
    .order("is_primary_contact", { ascending: false })
    .order("created_at")
    .returns<CandidateContactRow[]>();
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapCandidateContactRow);
}

export async function fetchAllCandidateContacts(supabase: SupabaseClient, candidateIds: string[]): Promise<Record<string, CandidateContact[]>> {
  if (candidateIds.length === 0) return {};
  const { data, error } = await supabase
    .from("candidate_contacts")
    .select("*")
    .in("firm_candidate_id", candidateIds)
    .order("is_primary_contact", { ascending: false })
    .order("created_at")
    .returns<CandidateContactRow[]>();
  if (error) throw new Error(error.message);
  const grouped: Record<string, CandidateContact[]> = {};
  for (const row of data ?? []) {
    const contact = mapCandidateContactRow(row);
    (grouped[contact.candidateId] ??= []).push(contact);
  }
  return grouped;
}

export async function updateCandidateContactSelection(supabase: SupabaseClient, contactId: string, selected: boolean): Promise<{ ok: true } | { error: unknown }> {
  const { error } = await supabase.from("candidate_contacts").update({ selected_for_approval: selected }).eq("id", contactId);
  if (error) return { error };
  return { ok: true };
}
