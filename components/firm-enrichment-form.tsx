"use client";
import { useState, type FormEvent } from "react";
import type { Firm } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { updateFirm } from "@/lib/supabase/firms";
import { logSafeError } from "@/lib/safe-error";
import { Modal, Field, Select } from "@/components/form-controls";

type TriStateLabel = "Unknown" | "Yes" | "No";

const FIRM_TYPE_OPTIONS = ["CPA Firm", "Accounting Firm", "Enrolled Agent", "Bookkeeper", "Tax Firm", "CAS / Advisory", "Other"];
const NICHE_INDUSTRY_OPTIONS = ["construction", "trades", "restaurants", "hospitality", "medical", "dental", "home health", "professional services", "trucking", "staffing", "manufacturing"];
const RESEARCH_STATUS_OPTIONS = ["Not Started", "Researching", "Complete", "Needs Review"];
const CONFIDENCE_OPTIONS = ["High", "Medium", "Low"];
const TRI_STATE_OPTIONS: TriStateLabel[] = ["Unknown", "Yes", "No"];

const CAPABILITY_FIELDS: Array<[key: keyof CapabilityFlags, label: string]> = [
  ["providesTax", "Tax"],
  ["providesBookkeeping", "Bookkeeping"],
  ["providesAccounting", "Accounting"],
  ["providesPayroll", "Payroll"],
  ["providesCas", "CAS"],
  ["providesAudit", "Audit"],
  ["providesBusinessAdvisory", "Business advisory"],
  ["providesFinancialPlanning", "Financial planning"],
  ["providesWealthManagement", "Wealth management"],
  ["providesQuickbooksServices", "QuickBooks services"],
  ["quickbooksProadvisor", "QuickBooks ProAdvisor"],
  ["xeroPartner", "Xero partner"],
];

const RESEARCH_SIGNAL_FIELDS: Array<[key: keyof ResearchSignalState, label: string]> = [
  ["payrollMentioned", "Payroll mentioned"],
  ["bookkeepingMentioned", "Bookkeeping mentioned"],
  ["taxMentioned", "Tax mentioned"],
  ["casMentioned", "CAS mentioned"],
  ["outsourcedAccountingMentioned", "Outsourced accounting mentioned"],
  ["advisoryMentioned", "Advisory mentioned"],
  ["quickbooksMentioned", "QuickBooks mentioned"],
  ["xeroMentioned", "Xero mentioned"],
  ["spanishMentioned", "Spanish mentioned"],
  ["smallBusinessMentioned", "Small business mentioned"],
  ["businessClientsMentioned", "Business clients mentioned"],
  ["primarilyIndividualTax", "Primarily individual tax"],
  ["primarilyAuditAssurance", "Primarily audit / assurance"],
];

type CapabilityFlags = {
  providesTax: boolean; providesBookkeeping: boolean; providesAccounting: boolean; providesPayroll: boolean;
  providesCas: boolean; providesAudit: boolean; providesBusinessAdvisory: boolean; providesFinancialPlanning: boolean;
  providesWealthManagement: boolean; providesQuickbooksServices: boolean; quickbooksProadvisor: boolean; xeroPartner: boolean;
};

type ResearchSignalState = {
  payrollMentioned: TriStateLabel; bookkeepingMentioned: TriStateLabel; taxMentioned: TriStateLabel; casMentioned: TriStateLabel;
  outsourcedAccountingMentioned: TriStateLabel; advisoryMentioned: TriStateLabel; quickbooksMentioned: TriStateLabel; xeroMentioned: TriStateLabel;
  spanishMentioned: TriStateLabel; smallBusinessMentioned: TriStateLabel; businessClientsMentioned: TriStateLabel;
  primarilyIndividualTax: TriStateLabel; primarilyAuditAssurance: TriStateLabel;
};

type FormState = CapabilityFlags & ResearchSignalState & {
  firmName: string; website: string; phone: string; addressLine1: string; addressLine2: string;
  city: string; state: string; zipCode: string; region: string; market: string;
  firmTypes: string[]; employeeCount: string; businessClientFocus: string; industrySpecialties: string[];
  spanishSpeaking: boolean; smbFocus: boolean; researchStatus: string; dataConfidence: string;
  source: string; sourceUrl: string; googleMapsUrl: string; linkedinCompanyUrl: string;
  aboutPageUrl: string; servicesPageUrl: string; leadershipPageUrl: string; contactPageUrl: string; notes: string;
};

function triToLabel(value: boolean | null): TriStateLabel {
  return value === true ? "Yes" : value === false ? "No" : "Unknown";
}
function labelToTri(label: TriStateLabel): boolean | null {
  return label === "Yes" ? true : label === "No" ? false : null;
}

function initFromFirm(firm: Firm): FormState {
  return {
    firmName: firm.name, website: firm.website, phone: firm.phone,
    addressLine1: firm.addressLine1, addressLine2: firm.addressLine2, city: firm.city, state: firm.state,
    zipCode: firm.zipCode, region: firm.region, market: firm.market,
    firmTypes: firm.firmTypes, employeeCount: firm.employees === null ? "" : String(firm.employees),
    businessClientFocus: firm.businessClientFocus ?? "", industrySpecialties: firm.industries,
    providesTax: firm.providesTax, providesBookkeeping: firm.providesBookkeeping, providesAccounting: firm.providesAccounting,
    providesPayroll: firm.providesPayroll, providesCas: firm.providesCas, providesAudit: firm.providesAudit,
    providesBusinessAdvisory: firm.providesBusinessAdvisory, providesFinancialPlanning: firm.providesFinancialPlanning,
    providesWealthManagement: firm.providesWealthManagement, providesQuickbooksServices: firm.providesQuickbooksServices,
    quickbooksProadvisor: firm.quickbooksProadvisor, xeroPartner: firm.xeroPartner,
    spanishSpeaking: firm.spanish, smbFocus: firm.smb,
    researchStatus: firm.researchStatus, dataConfidence: firm.confidence,
    source: firm.source, sourceUrl: firm.sourceUrl, googleMapsUrl: firm.googleMapsUrl, linkedinCompanyUrl: firm.linkedinCompanyUrl,
    aboutPageUrl: firm.aboutPageUrl, servicesPageUrl: firm.servicesPageUrl, leadershipPageUrl: firm.leadershipPageUrl, contactPageUrl: firm.contactPageUrl,
    notes: firm.notes,
    payrollMentioned: triToLabel(firm.research.payrollMentioned), bookkeepingMentioned: triToLabel(firm.research.bookkeepingMentioned),
    taxMentioned: triToLabel(firm.research.taxMentioned), casMentioned: triToLabel(firm.research.casMentioned),
    outsourcedAccountingMentioned: triToLabel(firm.research.outsourcedAccountingMentioned), advisoryMentioned: triToLabel(firm.research.advisoryMentioned),
    quickbooksMentioned: triToLabel(firm.research.quickbooksMentioned), xeroMentioned: triToLabel(firm.research.xeroMentioned),
    spanishMentioned: triToLabel(firm.research.spanishMentioned), smallBusinessMentioned: triToLabel(firm.research.smallBusinessMentioned),
    businessClientsMentioned: triToLabel(firm.research.businessClientsMentioned),
    primarilyIndividualTax: triToLabel(firm.research.primarilyIndividualTax), primarilyAuditAssurance: triToLabel(firm.research.primarilyAuditAssurance),
  };
}

type Props = { firm: Firm; close: () => void; onUpdated: (firm: Firm) => void; notify: (s: string) => void };

export function FirmEnrichmentForm({ firm, close, onUpdated, notify }: Props) {
  const [form, setForm] = useState<FormState>(() => initFromFirm(firm));
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm(f => ({ ...f, [key]: value }));
  const toggleListItem = (key: "firmTypes" | "industrySpecialties", item: string) =>
    setForm(f => ({ ...f, [key]: f[key].includes(item) ? f[key].filter(x => x !== item) : [...f[key], item] }));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setError("");
    if (!form.firmName.trim()) { setError("Firm name is required."); return; }
    if (!form.state.trim()) { setError("State is required."); return; }
    let employeeCount: number | null = null;
    if (form.employeeCount.trim()) {
      const parsed = Number(form.employeeCount);
      if (!Number.isInteger(parsed) || parsed < 0) { setError("Employee count must be a whole number of 0 or more."); return; }
      employeeCount = parsed;
    }
    setSubmitting(true);
    const supabase = createClient();
    const result = await updateFirm(supabase, firm.id, {
      firmName: form.firmName.trim(), website: form.website.trim(), phone: form.phone.trim(),
      addressLine1: form.addressLine1.trim(), addressLine2: form.addressLine2.trim(), city: form.city.trim(),
      state: form.state.trim(), zipCode: form.zipCode.trim(), region: form.region.trim(), market: form.market.trim(),
      firmTypes: form.firmTypes, employeeCount, businessClientFocus: form.businessClientFocus.trim(),
      industrySpecialties: form.industrySpecialties,
      providesTax: form.providesTax, providesBookkeeping: form.providesBookkeeping, providesAccounting: form.providesAccounting,
      providesPayroll: form.providesPayroll, providesCas: form.providesCas, providesAudit: form.providesAudit,
      providesBusinessAdvisory: form.providesBusinessAdvisory, providesFinancialPlanning: form.providesFinancialPlanning,
      providesWealthManagement: form.providesWealthManagement, providesQuickbooksServices: form.providesQuickbooksServices,
      quickbooksProadvisor: form.quickbooksProadvisor, xeroPartner: form.xeroPartner,
      spanishSpeaking: form.spanishSpeaking, smbFocus: form.smbFocus,
      researchStatus: form.researchStatus, dataConfidence: form.dataConfidence,
      source: form.source.trim(), sourceUrl: form.sourceUrl.trim(), googleMapsUrl: form.googleMapsUrl.trim(),
      linkedinCompanyUrl: form.linkedinCompanyUrl.trim(), aboutPageUrl: form.aboutPageUrl.trim(),
      servicesPageUrl: form.servicesPageUrl.trim(), leadershipPageUrl: form.leadershipPageUrl.trim(), contactPageUrl: form.contactPageUrl.trim(),
      notes: form.notes.trim(),
      payrollMentioned: labelToTri(form.payrollMentioned), bookkeepingMentioned: labelToTri(form.bookkeepingMentioned),
      taxMentioned: labelToTri(form.taxMentioned), casMentioned: labelToTri(form.casMentioned),
      outsourcedAccountingMentioned: labelToTri(form.outsourcedAccountingMentioned), advisoryMentioned: labelToTri(form.advisoryMentioned),
      quickbooksMentioned: labelToTri(form.quickbooksMentioned), xeroMentioned: labelToTri(form.xeroMentioned),
      spanishMentioned: labelToTri(form.spanishMentioned), smallBusinessMentioned: labelToTri(form.smallBusinessMentioned),
      businessClientsMentioned: labelToTri(form.businessClientsMentioned),
      primarilyIndividualTax: labelToTri(form.primarilyIndividualTax), primarilyAuditAssurance: labelToTri(form.primarilyAuditAssurance),
    });
    if ("error" in result) {
      logSafeError("updateFirm", result.error);
      setError("This firm could not be saved. Please check the details and try again.");
      setSubmitting(false);
      return;
    }
    onUpdated(result.firm);
    notify(`${result.firm.name} updated — score ${result.firm.score}, grade ${result.firm.grade}`);
    close();
  };

  return (
    <Modal title="Enrich firm profile" subtitle="PostgreSQL recalculates score, grade, and recommendations from these fields." close={close}>
      <form onSubmit={handleSubmit}>
        <div className="score-preview">
          <div><span>Current score</span><b>{firm.score}/100 · Grade {firm.grade}</b></div>
          <div><span>Recommended approach</span><b>{firm.partnerType || firm.approach || "Needs Research"}</b></div>
          <p>Score, grade, and recommendations update automatically after you save — they are never set directly.</p>
        </div>

        <div className="form-section">
          <h3>Identity &amp; location</h3>
          <div className="form-grid">
            <Field label="Firm name *" value={form.firmName} set={v => set("firmName", v)} />
            <Field label="Website" value={form.website} set={v => set("website", v)} type="url" />
            <Field label="Phone" value={form.phone} set={v => set("phone", v)} type="tel" />
            <Field label="Address line 1" value={form.addressLine1} set={v => set("addressLine1", v)} />
            <Field label="Address line 2" value={form.addressLine2} set={v => set("addressLine2", v)} />
            <Field label="City" value={form.city} set={v => set("city", v)} />
            <Field label="State *" value={form.state} set={v => set("state", v)} />
            <Field label="Zip code" value={form.zipCode} set={v => set("zipCode", v)} />
            <Field label="Region" value={form.region} set={v => set("region", v)} />
            <Field label="Market" value={form.market} set={v => set("market", v)} />
          </div>
        </div>

        <div className="form-section">
          <h3>Firm types</h3>
          <div className="check-grid">
            {FIRM_TYPE_OPTIONS.map(option => (
              <label key={option}>
                <input type="checkbox" checked={form.firmTypes.includes(option)} onChange={() => toggleListItem("firmTypes", option)} />
                {option}
              </label>
            ))}
          </div>
        </div>

        <div className="form-section">
          <h3>Service capabilities</h3>
          <div className="check-grid">
            {CAPABILITY_FIELDS.map(([key, label]) => (
              <label key={key}>
                <input type="checkbox" checked={form[key]} onChange={e => set(key, e.target.checked)} />
                {label}
              </label>
            ))}
          </div>
          <div className="switches">
            <label><input type="checkbox" checked={form.spanishSpeaking} onChange={e => set("spanishSpeaking", e.target.checked)} />Spanish-speaking</label>
            <label><input type="checkbox" checked={form.smbFocus} onChange={e => set("smbFocus", e.target.checked)} />SMB-focused</label>
          </div>
        </div>

        <div className="form-section">
          <h3>Industry specialties</h3>
          <div className="check-grid">
            {NICHE_INDUSTRY_OPTIONS.map(option => (
              <label key={option}>
                <input type="checkbox" checked={form.industrySpecialties.includes(option)} onChange={() => toggleListItem("industrySpecialties", option)} />
                {option[0].toUpperCase() + option.slice(1)}
              </label>
            ))}
          </div>
        </div>

        <div className="form-section">
          <h3>Firmographics &amp; research status</h3>
          <div className="form-grid">
            <Field label="Employee count" value={form.employeeCount} set={v => set("employeeCount", v)} />
            <Field label="Business client focus" value={form.businessClientFocus} set={v => set("businessClientFocus", v)} />
            <div><label htmlFor="enrich-research-status"><span>Research status</span></label><Select id="enrich-research-status" value={form.researchStatus} onChange={v => set("researchStatus", v)} options={RESEARCH_STATUS_OPTIONS} /></div>
            <div><label htmlFor="enrich-confidence"><span>Data confidence</span></label><Select id="enrich-confidence" value={form.dataConfidence} onChange={v => set("dataConfidence", v)} options={CONFIDENCE_OPTIONS} /></div>
          </div>
        </div>

        <div className="form-section">
          <h3>Research signals</h3>
          <p className="form-section-note">Independent of the capability checkboxes above — these record what the source material says, not what the firm actually offers.</p>
          <div className="form-grid">
            {RESEARCH_SIGNAL_FIELDS.map(([key, label]) => (
              <div key={key}>
                <label htmlFor={`enrich-${key}`}><span>{label}</span></label>
                <Select id={`enrich-${key}`} value={form[key]} onChange={v => set(key, v as TriStateLabel)} options={TRI_STATE_OPTIONS} />
              </div>
            ))}
          </div>
        </div>

        <div className="form-section">
          <h3>Sourcing</h3>
          <div className="form-grid">
            <Field label="Source" value={form.source} set={v => set("source", v)} />
            <Field label="Source URL" value={form.sourceUrl} set={v => set("sourceUrl", v)} type="url" />
            <Field label="Google Maps URL" value={form.googleMapsUrl} set={v => set("googleMapsUrl", v)} type="url" />
            <Field label="LinkedIn company URL" value={form.linkedinCompanyUrl} set={v => set("linkedinCompanyUrl", v)} type="url" />
            <Field label="About page URL" value={form.aboutPageUrl} set={v => set("aboutPageUrl", v)} type="url" />
            <Field label="Services page URL" value={form.servicesPageUrl} set={v => set("servicesPageUrl", v)} type="url" />
            <Field label="Leadership page URL" value={form.leadershipPageUrl} set={v => set("leadershipPageUrl", v)} type="url" />
            <Field label="Contact page URL" value={form.contactPageUrl} set={v => set("contactPageUrl", v)} type="url" />
          </div>
        </div>

        <div className="form-section">
          <h3>Notes</h3>
          <label className="full-label"><span>Internal notes</span><textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={4} /></label>
        </div>

        {error && <div className="auth-error">{error}</div>}
        <div className="modal-actions">
          <button type="button" onClick={close}>Cancel</button>
          <button type="submit" className="primary" disabled={submitting}>{submitting ? "Saving…" : "Save and rescore"}</button>
        </div>
      </form>
    </Modal>
  );
}
