import { PartnerNetwork } from "@/components/partner-network";
import { createClient } from "@/lib/supabase/server";
import { fetchFirms } from "@/lib/supabase/firms";
import { fetchCandidates, fetchDiscoveryJobs } from "@/lib/supabase/candidates";
import { DataError } from "@/components/data-error";
import type { DiscoveryJob, Firm, FirmCandidate } from "@/lib/types";

export const dynamic = "force-dynamic";

async function loadFirms(): Promise<{ firms: Firm[] } | { failed: true }> {
  try {
    const supabase = await createClient();
    const firms = await fetchFirms(supabase);
    return { firms };
  } catch (error) {
    console.error("[Home] Failed to load firms from Supabase:", error);
    return { failed: true };
  }
}

async function loadDiscovery(): Promise<{ candidates: FirmCandidate[]; jobs: DiscoveryJob[] } | { failed: true }> {
  try {
    const supabase = await createClient();
    const [candidates, jobs] = await Promise.all([fetchCandidates(supabase), fetchDiscoveryJobs(supabase)]);
    return { candidates, jobs };
  } catch (error) {
    console.error("[Home] Failed to load discovery data from Supabase:", error);
    return { failed: true };
  }
}

export default async function Home() {
  const firmsResult = await loadFirms();
  if ("failed" in firmsResult) return <DataError />;

  const discoveryResult = await loadDiscovery();
  const discoveryFailed = "failed" in discoveryResult;

  return (
    <PartnerNetwork
      initialFirms={firmsResult.firms}
      initialCandidates={discoveryFailed ? null : discoveryResult.candidates}
      initialJobs={discoveryFailed ? null : discoveryResult.jobs}
      discoveryFailed={discoveryFailed}
    />
  );
}
