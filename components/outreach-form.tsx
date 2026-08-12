"use client";
import { useState, type FormEvent } from "react";
import type { Activity, Firm } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { fetchFirmById, insertOutreach } from "@/lib/supabase/firms";
import { logSafeError } from "@/lib/safe-error";
import { Modal, Select } from "@/components/form-controls";

const TYPE_OPTIONS: Activity["type"][] = ["Email", "Phone", "LinkedIn", "Meeting", "Referral", "Other"];
const STATUS_OPTIONS = ["No Response", "Interested", "Meeting Scheduled", "Follow Up Later", "Referred", "Partner", "Not Interested", "Bad Contact"];

type Props = {
  firms: Firm[];
  lockedFirmId?: string;
  close: () => void;
  onLogged: (firm: Firm) => void;
  notify: (s: string) => void;
};

export function OutreachForm({ firms, lockedFirmId, close, onLogged, notify }: Props) {
  const [firmId, setFirmId] = useState(lockedFirmId ?? "");
  const [contactId, setContactId] = useState("");
  const [type, setType] = useState<Activity["type"]>("Email");
  const [status, setStatus] = useState("No Response");
  const [notes, setNotes] = useState("");
  const [nextFollowUp, setNextFollowUp] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const lockedFirm = lockedFirmId ? firms.find(f => f.id === lockedFirmId) : undefined;
  const selectedFirm = firms.find(f => f.id === firmId);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setError("");
    if (!firmId || !selectedFirm) { setError("Select a firm."); return; }
    if (contactId && !selectedFirm.contacts.some(c => c.id === contactId)) {
      setError("The selected contact doesn't belong to this firm.");
      return;
    }
    setSubmitting(true);
    const supabase = createClient();
    const result = await insertOutreach(supabase, {
      firmId,
      contactId: contactId || null,
      type,
      responseStatus: status,
      notes: notes.trim(),
      nextFollowUp,
    });
    if ("error" in result) {
      logSafeError("insertOutreach", result.error);
      setError("This activity could not be logged. Please try again.");
      setSubmitting(false);
      return;
    }
    try {
      const firm = await fetchFirmById(supabase, firmId);
      onLogged(firm);
      notify(`Outreach logged for ${firm.name}`);
      close();
    } catch (refreshError) {
      logSafeError("fetchFirmById after insertOutreach", refreshError);
      notify("Outreach saved, but we couldn't refresh the firm. Please reload.");
      close();
    }
  };

  return (
    <Modal title="Log outreach" subtitle="Record a touchpoint with this firm." close={close}>
      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          {lockedFirm ? (
            <label><span>Firm</span><input value={lockedFirm.name} disabled readOnly /></label>
          ) : (
            <div>
              <label htmlFor="outreach-firm"><span>Firm</span></label>
              <span className="select">
                <select id="outreach-firm" value={firmId} onChange={e => { setFirmId(e.target.value); setContactId(""); }}>
                  <option value="">Select a firm…</option>
                  {firms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </span>
            </div>
          )}
          <div>
            <label htmlFor="outreach-contact"><span>Contact</span></label>
            <span className="select">
              <select id="outreach-contact" value={contactId} onChange={e => setContactId(e.target.value)} disabled={!selectedFirm}>
                <option value="">No contact</option>
                {selectedFirm?.contacts.map(c => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
              </select>
            </span>
          </div>
          <div>
            <label htmlFor="outreach-type"><span>Outreach type</span></label>
            <Select id="outreach-type" value={type} onChange={v => setType(v as Activity["type"])} options={TYPE_OPTIONS} />
          </div>
          <div>
            <label htmlFor="outreach-status"><span>Response status</span></label>
            <Select id="outreach-status" value={status} onChange={setStatus} options={STATUS_OPTIONS} />
          </div>
          <label><span>Next follow-up</span><input type="date" value={nextFollowUp} onChange={e => setNextFollowUp(e.target.value)} /></label>
        </div>
        <label className="full-label"><span>Notes</span><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4} placeholder="What happened?" /></label>
        {error && <div className="auth-error">{error}</div>}
        <div className="modal-actions">
          <button type="button" onClick={close}>Cancel</button>
          <button type="submit" className="primary" disabled={submitting}>{submitting ? "Saving…" : "Log outreach"}</button>
        </div>
      </form>
    </Modal>
  );
}
