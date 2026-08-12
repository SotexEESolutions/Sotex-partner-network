const LUSHA_API_URL="https://api.lusha.com/v3";

type UnknownRecord=Record<string,unknown>;
export type StagedLushaContact={
  providerRecordId:string;firstName:string|null;lastName:string|null;fullName:string|null;
  title:string|null;roleCategory:string|null;email:string|null;emailStatus:"Not Found"|"Unverified";
  directPhone:string|null;phoneStatus:"Not Found"|"Unverified";linkedinUrl:string|null;
  confidence:"High"|"Medium"|"Low";sourceUrl:string|null;rawData:UnknownRecord;
};

function record(value:unknown):UnknownRecord|null{return typeof value==="object"&&value!==null&&!Array.isArray(value)?value as UnknownRecord:null;}
function stringValue(value:unknown){return typeof value==="string"&&value.trim()?value.trim():null;}
function firstString(value:unknown,keys:string[]){const item=record(value);if(!item)return null;for(const key of keys){const found=stringValue(item[key]);if(found)return found;}return null;}
function firstArrayRecord(value:unknown){return Array.isArray(value)?record(value[0]):null;}
function roleFromTitle(title:string|null){if(!title)return null;const lower=title.toLowerCase();if(lower.includes("owner"))return"Owner";if(lower.includes("founder"))return"Founder";if(lower.includes("managing partner"))return"Managing Partner";if(lower.includes("partner"))return"Partner";if(lower.includes("principal"))return"Principal";if(lower.includes("director"))return"Managing Director";return"Decision Maker";}

async function lushaPost(path:string,body:unknown){
  const apiKey=process.env.LUSHA_API_KEY;if(!apiKey)throw Object.assign(new Error("Lusha is not configured."),{code:"not-configured"});
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),15_000);
  try{const response=await fetch(`${LUSHA_API_URL}${path}`,{method:"POST",headers:{"Content-Type":"application/json",api_key:apiKey},body:JSON.stringify(body),signal:controller.signal,cache:"no-store"});
    if(!response.ok)throw Object.assign(new Error("Lusha request failed."),{code:String(response.status)});
    return await response.json() as UnknownRecord;
  }finally{clearTimeout(timeout);}
}

function collectDecisionMakerPreviews(payload:UnknownRecord){
  const previews:UnknownRecord[]=[];
  const visit=(value:unknown)=>{if(Array.isArray(value)){for(const item of value)visit(item);return;}const item=record(value);if(!item)return;
    const id=stringValue(item.id)??stringValue(item.contactId);const title=stringValue(item.title)??stringValue(item.jobTitle);
    if(id&&(title||item.firstName||item.lastName||item.fullName||item.name))previews.push(item);
    for(const [key,nested] of Object.entries(item)){if(["results","decisionMakers","contacts","data","items"].includes(key))visit(nested);}
  };visit(payload.results);return Array.from(new Map(previews.map(item=>[String(item.id??item.contactId),item])).values());
}

function mapEnrichedContact(item:UnknownRecord,preview:UnknownRecord):StagedLushaContact{
  const firstName=stringValue(item.firstName)??stringValue(preview.firstName);
  const lastName=stringValue(item.lastName)??stringValue(preview.lastName);
  const combinedName=[firstName,lastName].filter(Boolean).join(" ")||null;
  const fullName=stringValue(item.fullName)??stringValue(item.name)??stringValue(preview.fullName)??stringValue(preview.name)??combinedName;
  const title=stringValue(item.title)??stringValue(item.jobTitle)??stringValue(preview.title)??stringValue(preview.jobTitle);
  const emailItem=firstArrayRecord(item.emails);const phoneItem=firstArrayRecord(item.phones);
  const email=firstString(emailItem,["email","emailAddress","address"])??stringValue(item.email);
  const directPhone=firstString(phoneItem,["number","phone","phoneNumber","internationalNumber"])??stringValue(item.phone);
  const linkedinUrl=stringValue(item.linkedinUrl)??stringValue(item.linkedin)??stringValue(preview.linkedinUrl)??stringValue(preview.linkedin);
  return{providerRecordId:String(item.id??item.contactId??preview.id??preview.contactId),firstName,lastName,fullName,title,roleCategory:roleFromTitle(title),email,emailStatus:email?"Unverified":"Not Found",directPhone,phoneStatus:directPhone?"Unverified":"Not Found",linkedinUrl,confidence:"Medium",sourceUrl:linkedinUrl,rawData:{provider:"Lusha",providerRecordId:String(item.id??item.contactId??preview.id??preview.contactId)}};
}

export async function findAndEnrichDecisionMakers(domain:string,limit=3){
  const previewPayload=await lushaPost("/contacts/decision-makers",{companies:[{domain,clientReferenceId:domain}],pagination:{page:1,size:Math.min(Math.max(limit,1),3)}});
  const previews=collectDecisionMakerPreviews(previewPayload).slice(0,limit);const ids=previews.map(item=>String(item.id??item.contactId)).filter(Boolean);
  if(ids.length===0)return[];
  const enrichedPayload=await lushaPost("/contacts/enrich",{ids,reveal:["emails","phones"]});
  const enriched=Array.isArray(enrichedPayload.results)?enrichedPayload.results.map(record).filter((item):item is UnknownRecord=>Boolean(item)):[];
  const byId=new Map(enriched.map(item=>[String(item.id??item.contactId),item]));
  return previews.map(preview=>mapEnrichedContact(byId.get(String(preview.id??preview.contactId))??preview,preview));
}
