export type Grade = "A+" | "A" | "B" | "C" | "D";
export type Priority = "High" | "Medium" | "Low";
export type TriState = boolean | null;
export type AppRole = "Admin"|"Manager"|"Rep"|"Researcher";
export type TerritoryAccessLevel = "View"|"Work"|"Manage";
export type RecordVisibility = "Private"|"Territory"|"Organization";
export type AssignmentStatus = "Unassigned"|"Assigned"|"Working"|"On Hold"|"Closed";

export type Profile = { id:string; fullName:string; email:string; role:AppRole; isActive:boolean; managerUserId?:string; createdAt:string; updatedAt:string };
export type Territory = { id:string; name:string; region:string; state:string; isActive:boolean; createdAt:string; updatedAt:string };
export type UserTerritory = { id:string; userId:string; territoryId:string; accessLevel:TerritoryAccessLevel; createdAt:string };
export type AccessContext = { currentUser:Profile; profiles:Profile[]; territories:Territory[]; assignments:UserTerritory[] };

export type Contact = {
  id: string; firstName: string; lastName: string; title: string; role: string;
  email: string; phone: string; linkedin?: string; primary: boolean; decisionMaker: boolean;
  emailStatus?: string;
};

export type Activity = {
  id: string; type: "Email" | "Phone" | "LinkedIn" | "Meeting" | "Referral" | "Other";
  date: string; status: string; notes: string; nextFollowUp?: string;
  createdByUserId?: string; noteVisibility?: RecordVisibility;
};

export type ResearchSignals = {
  payrollMentioned: TriState;
  bookkeepingMentioned: TriState;
  taxMentioned: TriState;
  casMentioned: TriState;
  outsourcedAccountingMentioned: TriState;
  advisoryMentioned: TriState;
  quickbooksMentioned: TriState;
  xeroMentioned: TriState;
  spanishMentioned: TriState;
  smallBusinessMentioned: TriState;
  businessClientsMentioned: TriState;
  primarilyIndividualTax: TriState;
  primarilyAuditAssurance: TriState;
  idealClientSizeMatch: TriState;
  locallyOwned: TriState;
  payrollSecondaryService: TriState;
  smallLocalPractice: TriState;
  primarilyWealthManagement: TriState;
  noBusinessClients: TriState;
  nationalTaxFranchise: TriState;
  inactiveOrOutdated: TriState;
  institutionalPayrollOperation: TriState;
};

export type ScoreItem = { points: number; label: string };
export type ScoringBreakdown = {
  partnerFit: { score: number; max: 60; items: ScoreItem[] };
  partnershipOpportunity: { score: number; max: 25; items: ScoreItem[] };
  outreachReadiness: { score: number; max: 15; items: ScoreItem[] };
  adjustments: ScoreItem[];
  adjustmentTotal: number;
  preAdjustmentTotal: number;
  total: number;
  grade: Grade;
  topTarget: boolean;
  partnerType: string;
  reason: string;
};

export type Firm = {
  id: string; name: string; normalizedName: string; website: string; domain: string; phone: string;
  addressLine1: string; addressLine2: string; city: string; state: string; zipCode: string;
  region: string; market: string;
  type: string; firmTypes: string[];
  employees: number | null; employeeCountRange: string; estimatedClientCount: number | null;
  services: string[];
  providesTax: boolean; providesBookkeeping: boolean; providesAccounting: boolean; providesPayroll: boolean;
  providesCas: boolean; providesAudit: boolean; providesBusinessAdvisory: boolean;
  providesFinancialPlanning: boolean; providesWealthManagement: boolean;
  providesQuickbooksServices: boolean; quickbooksProadvisor: boolean; xeroPartner: boolean;
  smb: boolean; spanish: boolean; industries: string[];
  score: number; grade: Grade; legacyScore: number | null;
  partnerFitScore: number; partnershipOpportunityScore: number; outreachReadinessScore: number;
  topTarget: boolean; scoringBreakdown: ScoringBreakdown;
  institutionalPayrollAdjustment: number;
  priority: Priority; researchStatus: string; enrichmentStatus: string; confidence: string;
  source: string; sourceUrl: string; googleMapsUrl: string; linkedinCompanyUrl: string;
  aboutPageUrl: string; servicesPageUrl: string; leadershipPageUrl: string; contactPageUrl: string;
  notes: string;
  scoreReason: string; approach: string; personalizationNote: string;
  partnerType?: string; businessClientFocus?: string; suggestedConversationAngle?: string;
  research: ResearchSignals;
  territoryId?: string; assignedUserId?: string; assignedAt?: string; assignmentStatus:AssignmentStatus;
  recordVisibility:RecordVisibility; createdByUserId?:string; discoveredByUserId?:string;
  contacts: Contact[]; outreach: Activity[]; createdAt: string; updatedAt: string;
};

export type ResearchEvidence = { id:string; firmId:string; attribute:string; value:boolean|null; sourceUrl:string; sourceText:string; confidence:"High"|"Medium"|"Low"; createdByUserId?:string; visibility:RecordVisibility; createdAt:string };

export type FirmReadiness = {
  firmId: string;
  decisionMakerFound: boolean;
  decisionMakerEmailFound: boolean;
  primaryContactComplete: boolean;
  readyForOutreach: boolean;
};

export type CandidateStatus = "New"|"Approved"|"Rejected"|"Duplicate"|"Needs Review";
export type DuplicateStatus = "No Match"|"Possible Match"|"Exact Match";
export type ContactResearchStatus = "Not Started"|"Researching"|"Complete"|"No Contact Found"|"Failed";
export type WebResearchStatus = "Not Queued"|"Queued"|"Researching"|"Needs Review"|"Complete"|"Failed"|"Invalid Domain"|"Daily Limit";
export type FindingReviewStatus = "Pending"|"Accepted"|"Rejected";
export type FirmCandidate = { id:string; jobId:string; name:string; website:string; domain:string; phone:string; address:string; city:string; state:string; zip:string; region:string; market:string; type:string; source:string; sourceUrl:string; description:string; duplicateStatus:DuplicateStatus; possibleExistingFirmId?:string; confidence:"High"|"Medium"|"Low"; reviewStatus:CandidateStatus; resultingFirmId?:string; reviewedAt?:string; createdAt:string; contactResearchStatus:ContactResearchStatus; contactResearchedAt?:string; webResearchStatus:WebResearchStatus; webResearchedAt?:string; webResearchErrorCode?:string; createdByUserId?:string; territoryId?:string; visibility:RecordVisibility };

export type CandidateResearchRun = { id:string; candidateId:string; status:"Queued"|"Running"|"Complete"|"Failed"|"Retry"; attemptCount:number; providerRequests:number; providerCredits:number; pagesVisited:number; errorCode?:string; startedAt?:string; completedAt?:string; createdAt:string };
export type CandidateResearchFinding = { id:string; candidateId:string; runId:string; category:string; attributeName:string; proposedValue:unknown; sourceUrl:string; sourceText:string; confidence:"High"|"Medium"|"Low"; reviewStatus:FindingReviewStatus; reviewedAt?:string; createdAt:string };

export type ContactFieldStatus = "Not Found"|"Unverified"|"Verified"|"Invalid";
export type CandidateContact = {
  id:string; candidateId:string; firstName:string; lastName:string; fullName:string;
  title:string; roleCategory:string; email:string; emailStatus:ContactFieldStatus;
  directPhone:string; phoneStatus:ContactFieldStatus; linkedin:string;
  confidence:"High"|"Medium"|"Low"; isPrimary:boolean; isDecisionMaker:boolean;
  selectedForApproval:boolean; source:string; sourceUrl:string; createdAt:string;
};

export type DiscoveryJob = {
  id: string; city: string; market: string; region: string; state: string;
  searchCategory: string; searchQuery: string; source: string; status: string;
  recordsFound: number; recordsImported: number; recordsRejected: number;
  startedAt?: string; completedAt?: string; createdAt: string;
  requestedCategories: string[]; targetCandidates: number;
  queriesAttempted: number; queriesTotal: number;
  candidatesDuplicateExisting: number; firmMatchesFlagged: number;
  errorMessage?: string;
  estimatedRequests: number; actualRequests: number; estimatedCostUsd: number | null;
  requestedBy?: string;
  createdByUserId?:string; territoryId?:string; visibility:RecordVisibility;
};
