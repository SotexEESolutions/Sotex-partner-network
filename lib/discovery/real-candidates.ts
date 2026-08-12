import type { FirmCandidate } from "@/lib/types";
const make=(id:string,name:string,website:string,type:string,description:string,phone="",address=""):FirmCandidate=>({id,jobId:"sa-live-2026-08-11",name,website,domain:new URL(website).hostname.replace(/^www\./,""),phone,address,city:"San Antonio",state:"TX",zip:"",region:"San Antonio",market:"Central Texas",type,source:"Official firm website",sourceUrl:website,description,duplicateStatus:"No Match",confidence:"High",reviewStatus:"New",createdAt:"2026-08-11"});
export const realSanAntonioCandidates:FirmCandidate[]=[
make("rc1","Mason Tax & Business Solutions","https://masontbs.com/","Enrolled Agent","Tax, accounting and financial consulting firm serving small- and medium-sized businesses.","(210) 349-0092","2008 NW Military Hwy"),
make("rc2","Rodriguez Reiffert & Co., P.C.","https://www.cpasat.com/","CPA Firm","San Antonio CPA firm advertising business accounting and tax services for small businesses."),
make("rc3","SA Small Business Accounting & Tax, Inc.","https://www.sasmallbusiness.com/","Accounting Firm","Small-business accounting, tax and QuickBooks services.","(210) 481-7100","13750 San Pedro Road, Suite 645"),
make("rc4","INK & LEDGER TAX SOLUTIONS LLC","https://inkandledger.org/","Tax Firm","Tax and bookkeeping services for individuals and small businesses."),
make("rc5","Small Business Services of San Antonio","https://www.sbsofsa.com/","Bookkeeper","Bookkeeping, payroll, tax preparation and CFO/tax advisory for small businesses.","(210) 884-5067","101 Sunflower Lane"),
make("rc6","True Books","https://www.truebooksonline.com/","Bookkeeper","Owner-led San Antonio bookkeeping service focused on small-business financial independence."),
make("rc7","Bulverde Business Solutions","https://www.bulverdebusiness.com/","CAS / Advisory","Bookkeeping, reporting, payroll/HR infrastructure and business coaching for small businesses."),
make("rc8","Petry Bookkeeping","https://petrybookkeeping.com/","Bookkeeper","Professionally managed bookkeeping for small and midsized businesses in San Antonio and surrounding markets."),
make("rc9","Tax Consultants of San Antonio","https://www.taxconsultantsofsanantonio.com/","Enrolled Agent","Enrolled Agent practice offering IRS representation, tax help and small-business tax services."),
make("rc10","Britts & Associates, LLP","https://www.cpasatx.com/","CPA Firm","Full-service CPA firm offering bookkeeping, tax, assurance, payroll and advisory services to small businesses."),
make("rc11","Wilder Bookkeeping","https://www.wilderbk.com/","Bookkeeper","Professional bookkeeping services for San Antonio small businesses and nonprofits."),
make("rc12","Axis Mobile Bookkeeping","https://www.axismb.org/","Bookkeeper","Veteran-owned bookkeeping provider serving San Antonio and the Hill Country."),
make("rc13","West Wind Accounting, PC","https://www.westwindcpa.com/","Accounting Firm","Texas accounting firm providing tax, bookkeeping and advisory services."),
make("rc14","1604 Tax & Accounting Group","https://1604tax.com/","Enrolled Agent","San Antonio tax and accounting practice led by a licensed Enrolled Agent."),
make("rc15","Debra R. Quintanilla CPA PC","https://www.drqcpa.com/","CPA Firm","Full-service CPA and consulting practice advertising small-business accounting and bookkeeping.","","5825 Callaghan Road #100"),
];
