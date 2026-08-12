"use client";
import { useState, type FormEvent } from "react";
import type { Firm } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { fetchFirmById, insertContact } from "@/lib/supabase/firms";
import { logSafeError } from "@/lib/safe-error";
import { Modal, Field, Select } from "@/components/form-controls";

const ROLE_OPTIONS = ["Select a role", "Owner", "Founder", "Managing Partner", "Partner", "Principal", "Managing Director", "Other"];
const EMAIL_STATUS_OPTIONS = ["Unknown", "Verified", "Unverified", "Invalid"];

type Props = {
  firms: Firm[];
  lockedFirmId?: string;
  close: () => void;
  onCreated: (firm: Firm) => void;
  notify: (s: string) => void;
};

export function ContactForm({ firms, lockedFirmId, close, onCreated, notify }: Props) {
  const [firmId, setFirmId] = useState(lockedFirmId ?? "");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [title, setTitle] = useState("");
  const [role, setRole] = useState("Select a role");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [emailStatus, setEmailStatus] = useState("Unknown");
  const [primary, setPrimary] = useState(false);
  const [decisionMaker, setDecisionMaker] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const lockedFirm = lockedFirmId ? firms.find(f => f.id === lockedFirmId) : undefined;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setError("");
    if (!firmId) { setError("Select a firm."); return; }
    if (!firstName.trim() || !lastName.trim()) { setError("First and last name are required."); return; }
    setSubmitting(true);
    const supabase = createClient();
    const result = await insertContact(supabase, {
      firmId,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      title: title.trim(),
      role: role === "Select a role" ? "" : role,
      email: email.trim(),
      phone: phone.trim(),
      linkedin: linkedin.trim(),
      emailStatus: emailStatus === "Unknown" ? "" : emailStatus,
      primary,
      decisionMaker,
    });
    if ("error" in result) {
      logSafeError("insertContact", result.error);
      setError("We couldn't save this contact. Please try again.");
      setSubmitting(false);
      return;
    }
    try {
      const firm = await fetchFirmById(supabase, firmId);
      onCreated(firm);
      notify(`${firstName.trim()} ${lastName.trim()} added to ${firm.name}`);
      close();
    } catch (refreshError) {
      logSafeError("fetchFirmById after insertContact", refreshError);
      notify("Contact saved, but we couldn't refresh the firm. Please reload.");
      close();
    }
  };

  return (
    <Modal title="Add contact" subtitle="Create a decision maker or relationship owner." close={close}>
      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          {lockedFirm ? (
            <label><span>Firm</span><input value={lockedFirm.name} disabled readOnly /></label>
          ) : (
            <div>
              <label htmlFor="contact-firm"><span>Firm</span></label>
              <span className="select">
                <select id="contact-firm" value={firmId} onChange={e => setFirmId(e.target.value)}>
                  <option value="">Select a firm…</option>
                  {firms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </span>
            </div>
          )}
          <Field label="First name *" value={firstName} set={setFirstName} />
          <Field label="Last name *" value={lastName} set={setLastName} />
          <Field label="Title" value={title} set={setTitle} />
          <div>
            <label htmlFor="contact-role"><span>Role</span></label>
            <Select id="contact-role" value={role} onChange={setRole} options={ROLE_OPTIONS} />
          </div>
          <Field label="Email" value={email} set={setEmail} type="email" />
          <Field label="Phone" value={phone} set={setPhone} type="tel" />
          <Field label="LinkedIn" value={linkedin} set={setLinkedin} type="url" />
          <div>
            <label htmlFor="contact-email-status"><span>Email status</span></label>
            <Select id="contact-email-status" value={emailStatus} onChange={setEmailStatus} options={EMAIL_STATUS_OPTIONS} />
          </div>
        </div>
        <div className="switches">
          <label><input type="checkbox" checked={primary} onChange={e => setPrimary(e.target.checked)} />Primary contact</label>
          <label><input type="checkbox" checked={decisionMaker} onChange={e => setDecisionMaker(e.target.checked)} />Decision maker</label>
        </div>
        {error && <div className="auth-error">{error}</div>}
        <div className="modal-actions">
          <button type="button" onClick={close}>Cancel</button>
          <button type="submit" className="primary" disabled={submitting}>{submitting ? "Saving…" : "Create contact"}</button>
        </div>
      </form>
    </Modal>
  );
}
