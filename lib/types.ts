export type Grade = "A" | "B" | "C" | "D";
export type Priority = "High" | "Medium" | "Low";

export type Contact = {
  id: string; firstName: string; lastName: string; title: string; role: string;
  email: string; phone: string; linkedin?: string; primary: boolean; decisionMaker: boolean;
  emailStatus?: string;
};

export type Activity = {
  id: string; type: "Email" | "Phone" | "LinkedIn" | "Meeting" | "Referral" | "Other";
  date: string; status: string; notes: string; nextFollowUp?: string;
};

export type Firm = {
  id: string; name: string; website: string; phone: string; city: string; state: string;
  region: string; type: string; employees: number | null; services: string[];
  smb: boolean; spanish: boolean; industries: string[]; score: number; grade: Grade;
  priority: Priority; researchStatus: string; confidence: string; source: string; notes: string;
  scoreReason: string; approach: string; personalizationNote: string;
  partnerType?: string; businessClientFocus?: string; suggestedConversationAngle?: string;
  research?: Partial<Record<"payroll"|"bookkeeping"|"tax"|"cas"|"outsourcedAccounting"|"advisory"|"quickbooks"|"xero"|"spanish"|"smallBusiness", boolean | null>>;
  evidence?: ResearchEvidence[];
  contacts: Contact[]; outreach: Activity[]; createdAt: string;
};

export type ResearchEvidence = { id:string; attribute:string; value:boolean|null; sourceUrl:string; sourceText:string; confidence:"High"|"Medium"|"Low" };
export type CandidateStatus = "New"|"Approved"|"Rejected"|"Duplicate"|"Needs Review";
export type DuplicateStatus = "No Match"|"Possible Match"|"Exact Match";
export type FirmCandidate = { id:string; jobId:string; name:string; website:string; domain:string; phone:string; address:string; city:string; state:string; zip:string; region:string; market:string; type:string; source:string; sourceUrl:string; description:string; duplicateStatus:DuplicateStatus; possibleExistingFirmId?:string; confidence:"High"|"Medium"|"Low"; reviewStatus:CandidateStatus; resultingFirmId?:string; reviewedAt?:string; createdAt:string };

export type DiscoveryJob = {
  id: string; city: string; market: string; region: string; state: string;
  searchCategory: string; searchQuery: string; source: string; status: string;
  recordsFound: number; recordsImported: number; recordsRejected: number;
  startedAt?: string; completedAt?: string; createdAt: string;
};
