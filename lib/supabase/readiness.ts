import type { SupabaseClient } from "@supabase/supabase-js";
import type { FirmReadiness } from "@/lib/types";

type FirmReadinessRow = {
  firm_id: string;
  decision_maker_found: boolean;
  decision_maker_email_found: boolean;
  primary_contact_complete: boolean;
  ready_for_outreach: boolean;
};

function mapReadinessRow(row: FirmReadinessRow): FirmReadiness {
  return {
    firmId: row.firm_id,
    decisionMakerFound: row.decision_maker_found,
    decisionMakerEmailFound: row.decision_maker_email_found,
    primaryContactComplete: row.primary_contact_complete,
    readyForOutreach: row.ready_for_outreach,
  };
}

export async function fetchFirmReadiness(supabase: SupabaseClient, firmId: string): Promise<FirmReadiness> {
  const { data, error } = await supabase
    .from("firm_contact_readiness")
    .select("*")
    .eq("firm_id", firmId)
    .single<FirmReadinessRow>();
  if (error) throw new Error(error.message);
  return mapReadinessRow(data);
}
