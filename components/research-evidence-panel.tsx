"use client";
import { useEffect, useState, type FormEvent } from "react";
import { ExternalLink } from "lucide-react";
import type { Firm, ResearchEvidence } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { fetchResearchEvidence, insertResearchEvidence } from "@/lib/supabase/research-evidence";
import { logSafeError } from "@/lib/safe-error";
import { Select } from "@/components/form-controls";

const ATTRIBUTE_OPTIONS: Array<[string, string]> = [
  ["payroll_mentioned", "Payroll mentioned"],
  ["bookkeeping_mentioned", "Bookkeeping mentioned"],
  ["tax_mentioned", "Tax mentioned"],
  ["cas_mentioned", "CAS mentioned"],
  ["outsourced_accounting_mentioned", "Outsourced accounting mentioned"],
  ["advisory_mentioned", "Advisory mentioned"],
  ["quickbooks_mentioned", "QuickBooks mentioned"],
  ["xero_mentioned", "Xero mentioned"],
  ["spanish_mentioned", "Spanish mentioned"],
  ["small_business_mentioned", "Small business mentioned"],
  ["business_clients_mentioned", "Business clients mentioned"],
  ["primarily_individual_tax", "Primarily individual tax"],
  ["primarily_audit_assurance", "Primarily audit / assurance"],
];
const CONFIDENCE_OPTIONS = ["Medium", "High", "Low"];
const VALUE_OPTIONS = ["Unknown", "Yes", "No"];

function attributeLabel(attr: string): string {
  return ATTRIBUTE_OPTIONS.find(([value]) => value === attr)?.[1] ?? attr;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

type Props = { firm: Firm; notify?: (s: string) => void };

// Rendered with key={firm.id} by the parent so this remounts (and its useState
// defaults apply fresh) whenever the viewed firm changes.
export function ResearchEvidencePanel({ firm, notify }: Props) {
  const [evidence, setEvidence] = useState<ResearchEvidence[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [addedNotice, setAddedNotice] = useState(false);

  const [attributeName, setAttributeName] = useState(ATTRIBUTE_OPTIONS[0][0]);
  const [detectedValue, setDetectedValue] = useState("Unknown");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [confidence, setConfidence] = useState("Medium");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    fetchResearchEvidence(supabase, firm.id)
      .then(result => { if (!cancelled) setEvidence(result); })
      .catch(fetchError => {
        logSafeError("fetchResearchEvidence", fetchError);
        if (!cancelled) setLoadError(true);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [firm.id]);

  const reload = () => {
    setLoading(true);
    setLoadError(false);
    const supabase = createClient();
    fetchResearchEvidence(supabase, firm.id)
      .then(setEvidence)
      .catch(fetchError => {
        logSafeError("fetchResearchEvidence", fetchError);
        setLoadError(true);
      })
      .finally(() => setLoading(false));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setFormError("");
    if (!isHttpUrl(sourceUrl)) { setFormError("Enter a valid source URL (starting with http:// or https://)."); return; }
    setSubmitting(true);
    const supabase = createClient();
    const result = await insertResearchEvidence(supabase, {
      firmId: firm.id,
      attributeName,
      detectedValue: detectedValue === "Yes" ? true : detectedValue === "No" ? false : null,
      sourceUrl: sourceUrl.trim(),
      sourceText: sourceText.trim(),
      confidence: confidence as "High" | "Medium" | "Low",
    });
    if ("error" in result) {
      logSafeError("insertResearchEvidence", result.error);
      setFormError("This evidence could not be saved. Please try again.");
      setSubmitting(false);
      return;
    }
    setSourceUrl("");
    setSourceText("");
    setDetectedValue("Unknown");
    setSubmitting(false);
    reload();
    if (notify) {
      notify("Evidence added. The firm profile and score are unchanged until you update it in Edit Firm.");
    } else {
      setAddedNotice(true);
      window.setTimeout(() => setAddedNotice(false), 4000);
    }
  };

  return (
    <div className="panel evidence-panel">
      <div className="panel-head"><div><h2>Research evidence</h2><p>Source citations supporting this firm&apos;s profile</p></div></div>
      <p className="evidence-disclaimer">Evidence records are citations only. Adding evidence does not change the firm profile, research signals, score, or grade. After reviewing evidence, update the corresponding research signal yourself in <b>Edit Firm</b>.</p>
      {addedNotice && <p className="evidence-status evidence-success">Evidence added. The firm profile and score are unchanged until you update it in Edit Firm.</p>}
      {loading && <p className="evidence-status">Loading evidence…</p>}
      {loadError && <p className="evidence-status evidence-error">We couldn&apos;t load research evidence for this firm. Please try again.</p>}
      {evidence && (evidence.length ? (
        <div className="evidence-list">
          {evidence.map(item => (
            <div className="evidence-row" key={item.id}>
              <div className="evidence-row-head">
                <b>{attributeLabel(item.attribute)}</b>
                <span className={`confidence c-${item.confidence.toLowerCase()}`}>{item.confidence} confidence</span>
              </div>
              <p>{item.sourceText || "No excerpt provided."}</p>
              <div className="evidence-meta">
                <a href={item.sourceUrl} target="_blank" rel="noreferrer">Source <ExternalLink size={11} /></a>
                <span>{item.createdAt.slice(0, 10)}</span>
                {item.value !== null && <span>{item.value ? "Confirmed" : "Not found"}</span>}
              </div>
            </div>
          ))}
        </div>
      ) : <p className="evidence-status">No evidence recorded yet.</p>)}

      <form onSubmit={handleSubmit} className="evidence-form">
        <h3>Add evidence</h3>
        <div className="form-grid">
          <div>
            <label htmlFor="evidence-attribute"><span>Attribute</span></label>
            <span className="select">
              <select id="evidence-attribute" value={attributeName} onChange={e => setAttributeName(e.target.value)}>
                {ATTRIBUTE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </span>
          </div>
          <div>
            <label htmlFor="evidence-value"><span>Detected value</span></label>
            <Select id="evidence-value" value={detectedValue} onChange={setDetectedValue} options={VALUE_OPTIONS} />
          </div>
          <div>
            <label htmlFor="evidence-confidence"><span>Confidence</span></label>
            <Select id="evidence-confidence" value={confidence} onChange={setConfidence} options={CONFIDENCE_OPTIONS} />
          </div>
          <label><span>Source URL</span><input type="url" value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} placeholder="https://example.com/about" /></label>
        </div>
        <label className="full-label"><span>Excerpt</span><textarea value={sourceText} onChange={e => setSourceText(e.target.value)} rows={3} placeholder="What did the source say?" /></label>
        {formError && <div className="auth-error">{formError}</div>}
        <div className="modal-actions">
          <button type="submit" className="primary" disabled={submitting}>{submitting ? "Saving…" : "Add evidence"}</button>
        </div>
      </form>
    </div>
  );
}
