"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import type { Firm, FirmReadiness } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { fetchFirmReadiness } from "@/lib/supabase/readiness";
import { logSafeError } from "@/lib/safe-error";

function ReadinessItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={`readiness-item ${ok ? "yes" : "no"}`}>
      {ok ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
      <span>{label}</span>
    </div>
  );
}

export function ReadinessPanel({ firm }: { firm: Firm }) {
  const [readiness, setReadiness] = useState<FirmReadiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    fetchFirmReadiness(supabase, firm.id)
      .then(result => { if (!cancelled) setReadiness(result); })
      .catch(fetchError => {
        logSafeError("fetchFirmReadiness", fetchError);
        if (!cancelled) setError(true);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // Re-fetch whenever this firm's row changes server-side (edits, or a
    // contact/outreach write that rescored it), not just when a different
    // firm is selected.
  }, [firm.id, firm.updatedAt]);

  return (
    <div className="panel readiness-panel">
      <div className="panel-head"><div><h2>Outreach readiness</h2><p>Calculated by PostgreSQL from contacts and outreach history</p></div></div>
      {loading && <p className="readiness-status">Loading readiness…</p>}
      {error && <p className="readiness-status readiness-error">We couldn&apos;t load readiness for this firm. Please try again.</p>}
      {readiness && (
        <div className="readiness-grid">
          <ReadinessItem ok={readiness.decisionMakerFound} label="Decision maker found" />
          <ReadinessItem ok={readiness.decisionMakerEmailFound} label="Decision maker email found" />
          <ReadinessItem ok={readiness.primaryContactComplete} label="Primary contact complete" />
          <ReadinessItem ok={readiness.readyForOutreach} label="Ready for outreach" />
        </div>
      )}
    </div>
  );
}
