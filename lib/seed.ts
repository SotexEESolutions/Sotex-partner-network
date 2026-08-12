import type { Firm } from "./types";
import { personalization, scoreFirm } from "./scoring";

type Seed = Omit<Firm,"score"|"grade"|"scoreReason"|"personalizationNote">;
const base = (id:string,name:string,city:string,region:string,type:string,employees:number|null,services:string[],smb:boolean,spanish:boolean,industries:string[],contact?:[string,string,string,string,string], activity?:[string,string,string]): Seed => ({
  id,name,website:`https://${name.toLowerCase().replace(/[^a-z0-9]+/g,"")}.example`,phone:`(210) 555-${String(1100+Number(id)).slice(-4)}`,
  city,state:"TX",region,type,employees,services,smb,spanish,industries,priority:"Medium",researchStatus:contact?"Complete":"Researching",confidence:contact?"High":"Medium",source:"Regional research",notes:"Fictional seed record for product testing.",
  approach:services.includes("Payroll")?"Wholesale Payroll Partner":"Referral Partner",contacts:contact?[{id:`c${id}`,firstName:contact[0],lastName:contact[1],title:contact[2],role:contact[3],email:contact[4],phone:`(210) 555-${String(3100+Number(id)).slice(-4)}`,primary:true,decisionMaker:["Owner","Managing Partner","Partner"].includes(contact[3])}]:[],
  outreach:activity?[{id:`a${id}`,type:activity[0] as "Email",date:activity[1],status:activity[2],notes:"Initial introduction and partnership overview.",nextFollowUp:"2026-08-22"}]:[],createdAt:`2026-07-${String(10+Number(id)).padStart(2,"0")}`
});

const seeds: Seed[] = [
  base("1","Alamo Ledger Partners","San Antonio","San Antonio","CPA Firm",12,["Tax","Bookkeeping","CAS","QuickBooks"],true,true,["construction","restaurants"],["Elena","Ruiz","Managing Partner","Managing Partner","elena@alamoloedger.example"]),
  base("2","Mission Trail Accounting","San Antonio","San Antonio","Accounting Firm",8,["Tax","Bookkeeping","QuickBooks"],true,false,["trades"],["Marcus","Hill","Owner","Owner","marcus@missiontrail.example"],["Email","2026-08-04","No Response"]),
  base("3","Riverstone Advisory Group","New Braunfels","San Antonio","CAS / Advisory",18,["CAS","Bookkeeping","Payroll","Accounting"],true,false,["professional services"],["Avery","Cole","Partner","Partner","avery@riverstone.example"],["Meeting","2026-08-07","Meeting Scheduled"]),
  base("4","Gulf Harbor Tax & Books","Corpus Christi","Coastal Bend","Tax Firm",6,["Tax","Bookkeeping"],true,true,["hospitality","restaurants"],["Sofia","Garza","Owner","Owner","sofia@gulfharbor.example"]),
  base("5","Coastal Compass CPAs","Corpus Christi","Coastal Bend","CPA Firm",24,["Tax","Audit","CAS","Payroll"],false,false,["manufacturing"],["Nathan","Lee","Managing Director","Managing Director","nathan@coastalcompass.example"],["Phone","2026-07-28","Follow Up Later"]),
  base("6","Gateway Border Accounting","Laredo","Laredo","Accounting Firm",10,["Tax","Bookkeeping","QuickBooks"],true,true,["trucking","staffing"],["Marisol","Vela","Owner","Owner","marisol@gatewayborder.example"]),
  base("7","Palm Vista Advisors","McAllen","Rio Grande Valley","CAS / Advisory",14,["Tax","Bookkeeping","CAS","QuickBooks"],true,true,["medical","dental"],["Diego","Salinas","Managing Partner","Managing Partner","diego@palmvista.example"],["Email","2026-08-01","Interested"]),
  base("8","Citrus Grove Bookkeeping","McAllen","Rio Grande Valley","Bookkeeper",4,["Bookkeeping","QuickBooks"],true,true,["restaurants"],["Lucia","Mendez","Owner","Owner","lucia@citrusgrove.example"]),
  base("9","Resaca Business Services","Brownsville","Rio Grande Valley","Accounting Firm",7,["Tax","Bookkeeping","Payroll"],true,true,["home health"],["Adriana","Pena","Partner","Partner","adriana@resaca.example"]),
  base("10","Arroyo Tax Collective","Harlingen","Rio Grande Valley","Enrolled Agent",3,["Tax","Bookkeeping"],true,true,["construction"]),
  base("11","Permian Basin Ledger Co","Midland","West Texas","Accounting Firm",16,["Tax","Bookkeeping","CAS","Payroll"],true,false,["construction","trucking"],["Grant","Baker","Owner","Owner","grant@permianledger.example"],["Referral","2026-08-06","Referred"]),
  base("12","Prairie Sky CPAs","Odessa","West Texas","CPA Firm",21,["Tax","Audit","Accounting"],false,false,["manufacturing"],["Megan","Ortiz","Partner","Partner","megan@prairiesky.example"]),
  base("13","Peach Tree Books & Tax","Fredericksburg","Hill Country","Tax Firm",5,["Tax","Bookkeeping","QuickBooks"],true,false,["hospitality"],["Henry","Klein","Owner","Owner","henry@peachtree.example"]),
  base("14","Hill Country Balance","Kerrville","Hill Country","Bookkeeper",2,["Bookkeeping","Payroll","Xero"],true,false,["professional services"]),
  base("15","Bluebonnet Advisory Studio","Boerne","San Antonio","CAS / Advisory",9,["CAS","Bookkeeping","QuickBooks"],true,false,["medical","professional services"],["Jordan","Park","Managing Partner","Managing Partner","jordan@bluebonnet.example"]),
];

export const seedFirms: Firm[] = seeds.map(f => { const result=scoreFirm(f); return {...f,...result,scoreReason:result.reason,personalizationNote:personalization(f)}; });
