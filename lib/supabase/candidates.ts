import type { SupabaseClient } from "@supabase/supabase-js";
import type { CandidateStatus, DiscoveryJob, DuplicateStatus, FirmCandidate } from "@/lib/types";

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
