import { logSafeError } from "@/lib/safe-error";
import type { CandidateContactRow } from "@/lib/supabase/candidates";

export type ResearchResult = { status: string; contacts: CandidateContactRow[] } | { error: string };

export async function researchCandidateContacts(candidateId: string): Promise<ResearchResult> {
  try {
    const response = await fetch(`/api/discovery/candidates/${candidateId}/contacts/research`, { method: "POST" });
    if (!response.ok) {
      logSafeError("researchCandidateContacts", { code: response.status });
      if (response.status === 402) return { error: "Contact enrichment credits are unavailable." };
      if (response.status === 422) return { error: "A company website is required before contact research can run." };
      if (response.status === 429) return { error: "Contact enrichment is temporarily rate limited." };
      if (response.status === 503) return { error: "Contact enrichment is not configured." };
      if (response.status === 401) return { error: "You must be signed in to research contacts." };
      return { error: "Contacts could not be researched. Please try again." };
    }
    const data = await response.json().catch(() => null);
    if (!data || typeof data.status !== "string" || !Array.isArray(data.contacts)) {
      logSafeError("researchCandidateContacts", { code: "invalid-response" });
      return { error: "Contacts could not be researched. Please try again." };
    }
    return { status: data.status, contacts: data.contacts };
  } catch (error) {
    logSafeError("researchCandidateContacts", error);
    return { error: "Contacts could not be researched. Please try again." };
  }
}
