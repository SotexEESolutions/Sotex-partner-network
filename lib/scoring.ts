import type { Firm, Grade } from "./types";
import { recommendPartnerType } from "./discovery/core.mjs";

const targetIndustries = new Set(["construction","trades","restaurants","hospitality","medical","dental","home health","professional services","trucking","staffing","manufacturing"]);

export function scoreFirm(firm: Pick<Firm,"type"|"smb"|"services"|"spanish"|"employees"|"industries"|"contacts">) {
  let score = 0; const reasons: string[] = [];
  const add = (condition: boolean, points: number, reason: string) => { if (condition) { score += points; reasons.push(reason); } };
  add(firm.smb, 20, "SMB-focused practice");
  add(firm.services.includes("Bookkeeping"), 15, "Bookkeeping services");
  add(firm.services.includes("CAS"), 15, "CAS / advisory services");
  add(firm.services.includes("Tax"), 10, "Business tax services");
  add(firm.smb, 10, "Business clients clearly mentioned");
  add(firm.contacts.some(c => c.decisionMaker && ["Owner","Managing Partner","Partner"].includes(c.role)), 10, "Decision-maker identified");
  add(firm.contacts.some(c => c.decisionMaker && Boolean(c.email)), 10, "Verified direct email");
  add(firm.services.includes("QuickBooks"), 5, "QuickBooks services");
  add(firm.spanish, 5, "Spanish-speaking practice");
  add(firm.employees !== null && firm.employees >= 2 && firm.employees <= 20, 5, "Ideal firm size");
  add(firm.industries.some(i => targetIndustries.has(i.toLowerCase())), 5, "Target-industry niche");
  add(firm.services.filter(s => ["Tax","Bookkeeping","Accounting","CAS","Business advisory"].includes(s)).length >= 3, 5, "Multiple SMB services");
  add(!firm.smb && firm.type === "Tax Firm", -10, "Primarily individual tax preparation");
  add(!firm.smb && firm.services.includes("Audit") && !firm.services.includes("CAS"), -10, "Audit-focused with limited SMB advisory");
  add(!firm.services.includes("Payroll"), 15, "Does not advertise payroll");
  add(firm.services.includes("Payroll"), 5, "Potential wholesale / outsourced payroll partner");
  score = Math.max(0, Math.min(score, 100));
  const grade: Grade = score >= 80 ? "A" : score >= 60 ? "B" : score >= 40 ? "C" : "D";
  return { score, grade, reason: reasons.join(" · ") };
}

export function personalization(firm: Pick<Firm,"city"|"type"|"smb"|"services">) {
  const focus = firm.smb ? "focused on small businesses" : "serving business clients";
  const payroll = firm.services.includes("Payroll") ? "Offers payroll; possible wholesale payroll partnership." : "Does not appear to advertise payroll.";
  const quickbooks = firm.services.includes("QuickBooks") ? " QuickBooks services are prominently advertised." : "";
  return `${firm.city} ${firm.type.toLowerCase()} ${focus}.${quickbooks} ${payroll}`;
}

export function enrichScoring(firm: Firm) { const result=scoreFirm(firm); return {...result,partnerType:recommendPartnerType(firm),personalizationNote:personalization(firm),suggestedConversationAngle:firm.services.includes("Payroll")?"Explore wholesale or outsourced payroll capacity and support.":"Lead with a reciprocal small-business referral partnership centered on payroll."}; }
