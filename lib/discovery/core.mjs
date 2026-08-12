export const normalizeName = value => String(value || "").toLowerCase().replace(/&/g," and ").replace(/[^a-z0-9]+/g," ").trim();
export const normalizeDomain = value => { try { return new URL(/^https?:\/\//.test(value)?value:`https://${value}`).hostname.replace(/^www\./,"").toLowerCase(); } catch { return ""; } };
export const normalizePhone = value => String(value||"").replace(/\D/g,"").slice(-10);

const similarity = (a,b) => { const x=normalizeName(a),y=normalizeName(b); if(x===y)return 1; const grams=s=>new Set([...Array(Math.max(0,s.length-2))].map((_,i)=>s.slice(i,i+3))); const ga=grams(x),gb=grams(y); if(!ga.size&&!gb.size)return 0; let hit=0;ga.forEach(g=>{if(gb.has(g))hit++});return (2*hit)/(ga.size+gb.size); };
export function detectDuplicate(candidate,firms){
  const domain=normalizeDomain(candidate.website||candidate.domain), phone=normalizePhone(candidate.phone);
  const exact=firms.find(f=>(domain&&normalizeDomain(f.website||f.domain)===domain)||(phone&&normalizePhone(f.phone)===phone)||(normalizeName(f.name||f.firm_name)===normalizeName(candidate.name||candidate.firm_name)&&String(f.city).toLowerCase()===String(candidate.city).toLowerCase())||(candidate.website&&String(f.website).toLowerCase()===String(candidate.website).toLowerCase()));
  if(exact)return {status:"Exact Match",firmId:exact.id};
  const possible=firms.find(f=>String(f.city).toLowerCase()===String(candidate.city).toLowerCase()&&similarity(f.name||f.firm_name,candidate.name||candidate.firm_name)>=.72);
  return possible?{status:"Possible Match",firmId:possible.id}:{status:"No Match"};
}
export function recommendPartnerType(firm){if(firm.services.includes("Payroll"))return "Wholesale Payroll Partner";if(firm.type==="CPA Firm"&&firm.services.includes("Bookkeeping"))return "Strategic CPA Partner";if(firm.type==="Enrolled Agent"||(firm.type==="Tax Firm"&&firm.smb))return "Tax / EA Partner";if(firm.type==="Bookkeeper")return "Bookkeeping Partner";if(firm.services.includes("Bookkeeping"))return "Referral Partner";return "Needs Research";}
export function isMailMergeEligible(firm){const primary=firm.contacts.find(c=>c.primary);return ["A","B"].includes(firm.grade)&&Boolean(primary?.email)&&primary.emailStatus!=="Invalid"&&!firm.outreach.some(o=>["Partner","Not Interested"].includes(o.status));}
