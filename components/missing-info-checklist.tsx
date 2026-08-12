import { AlertTriangle } from "lucide-react";
import type { Firm } from "@/lib/types";

function missingItems(firm: Firm): string[] {
  const items: string[] = [];
  if (firm.employees === null) items.push("No employee count on file");
  if (firm.industries.length === 0) items.push("No industry specialties selected");
  const hasCapability = firm.providesTax || firm.providesBookkeeping || firm.providesAccounting || firm.providesPayroll
    || firm.providesCas || firm.providesAudit || firm.providesBusinessAdvisory || firm.providesFinancialPlanning
    || firm.providesWealthManagement || firm.providesQuickbooksServices || firm.quickbooksProadvisor || firm.xeroPartner;
  if (!hasCapability) items.push("No service capabilities confirmed");
  if (!firm.businessClientFocus) items.push("No business-client-focus notes");
  if (!firm.contacts.some(c => c.primary)) items.push("No primary contact on file");
  return items;
}

export function MissingInfoChecklist({ firm }: { firm: Firm }) {
  const items = missingItems(firm);
  return (
    <div className="panel missing-info-panel">
      <div className="panel-head"><div><h2>Missing information</h2><p>Profile gaps identified in the browser — not a database calculation</p></div></div>
      {items.length ? (
        <ul className="missing-info-list">
          {items.map(item => <li key={item}><AlertTriangle size={13} />{item}</li>)}
        </ul>
      ) : (
        <p className="missing-info-empty">No obvious profile gaps detected.</p>
      )}
    </div>
  );
}
