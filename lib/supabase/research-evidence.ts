import type { SupabaseClient } from "@supabase/supabase-js";
import type { ResearchEvidence } from "@/lib/types";

type ResearchEvidenceRow = {
  id: string;
  firm_id: string;
  attribute_name: string;
  detected_value: boolean | null;
  source_url: string;
  source_text: string | null;
  confidence: "High" | "Medium" | "Low";
  created_at: string;
};

function mapEvidenceRow(row: ResearchEvidenceRow): ResearchEvidence {
  return {
    id: row.id,
    firmId: row.firm_id,
    attribute: row.attribute_name,
    value: row.detected_value,
    sourceUrl: row.source_url,
    sourceText: row.source_text ?? "",
    confidence: row.confidence,
    createdAt: row.created_at,
  };
}

export async function fetchResearchEvidence(supabase: SupabaseClient, firmId: string): Promise<ResearchEvidence[]> {
  const { data, error } = await supabase
    .from("research_evidence")
    .select("*")
    .eq("firm_id", firmId)
    .order("created_at", { ascending: false })
    .returns<ResearchEvidenceRow[]>();
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapEvidenceRow);
}

export type NewResearchEvidenceParams = {
  firmId: string;
  attributeName: string;
  detectedValue: boolean | null;
  sourceUrl: string;
  sourceText: string;
  confidence: "High" | "Medium" | "Low";
};

export async function insertResearchEvidence(supabase: SupabaseClient, params: NewResearchEvidenceParams): Promise<{ evidence: ResearchEvidence } | { error: unknown }> {
  const { data, error } = await supabase
    .from("research_evidence")
    .insert({
      firm_id: params.firmId,
      attribute_name: params.attributeName,
      detected_value: params.detectedValue,
      source_url: params.sourceUrl,
      source_text: params.sourceText || null,
      confidence: params.confidence,
    })
    .select("*")
    .single<ResearchEvidenceRow>();
  if (error || !data) return { error };
  return { evidence: mapEvidenceRow(data) };
}
