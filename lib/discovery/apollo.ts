const APOLLO_API_URL="https://api.apollo.io/api/v1";

type UnknownRecord=Record<string,unknown>;
export type StagedApolloContact={
  providerRecordId:string;firstName:string|null;lastName:string|null;fullName:string|null;
  title:string|null;roleCategory:string|null;email:string|null;emailStatus:"Not Found"|"Unverified"|"Verified"|"Invalid";
  directPhone:null;phoneStatus:"Not Found";linkedinUrl:string|null;
  confidence:"High"|"Medium"|"Low";sourceUrl:string|null;rawData:UnknownRecord;
};

function record(value:unknown):UnknownRecord|null{return typeof value==="object"&&value!==null&&!Array.isArray(value)?value as UnknownRecord:null;}
function stringValue(value:unknown){return typeof value==="string"&&value.trim()?value.trim():null;}
function roleFromTitle(title:string|null){if(!title)return null;const lower=title.toLowerCase();if(lower.includes("owner"))return"Owner";if(lower.includes("founder"))return"Founder";if(lower.includes("managing partner"))return"Managing Partner";if(lower.includes("partner"))return"Partner";if(lower.includes("principal"))return"Principal";if(lower.includes("director"))return"Managing Director";return"Decision Maker";}
function emailStatus(value:unknown,email:string|null):StagedApolloContact["emailStatus"]{const status=stringValue(value)?.toLowerCase();if(!email)return"Not Found";if(status==="verified")return"Verified";if(status==="invalid")return"Invalid";return"Unverified";}

async function apolloPost(path:string,params:URLSearchParams){
  const apiKey=process.env.APOLLO_API_KEY;if(!apiKey)throw Object.assign(new Error("Apollo is not configured."),{code:"not-configured"});
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),15_000);
  try{const response=await fetch(`${APOLLO_API_URL}${path}?${params}`,{method:"POST",headers:{Accept:"application/json","Content-Type":"application/json","x-api-key":apiKey},signal:controller.signal,cache:"no-store"});
    if(!response.ok)throw Object.assign(new Error("Apollo request failed."),{code:String(response.status)});
    return await response.json() as UnknownRecord;
  }finally{clearTimeout(timeout);}
}

const SEARCH_POOL_SIZE=25;

function searchParams(domain:string){const params=new URLSearchParams({page:"1",per_page:String(SEARCH_POOL_SIZE)});params.append("q_organization_domains_list[]",domain);return params;}

function decisionMakerScore(person:UnknownRecord){
  const title=stringValue(person.title)?.toLowerCase()??"";
  const priorities:[RegExp,number][]=[
    [/\b(owner|founder|co[- ]?founder)\b/,100],
    [/\b(managing partner|senior partner|partner)\b/,95],
    [/\b(chief executive officer|ceo|president)\b/,90],
    [/\b(principal|managing director)\b/,85],
    [/\b(chief operating officer|coo|chief financial officer|cfo)\b/,80],
    [/\b(vice president|vp|director|head of)\b/,65],
    [/\b(cpa|certified public accountant|enrolled agent|tax manager|accounting manager)\b/,50],
    [/\b(manager|accountant|tax professional|advisor|consultant)\b/,30],
  ];
  const titleScore=priorities.find(([pattern])=>pattern.test(title))?.[1]??0;
  const emailBonus=person.has_email===true?5:0;
  const linkedinBonus=stringValue(person.linkedin_url)?2:0;
  return titleScore+emailBonus+linkedinBonus;
}

function rankedPreviews(search:UnknownRecord,limit:number){
  if(!Array.isArray(search.people))return[];
  return search.people.map(record).filter((item):item is UnknownRecord=>Boolean(item)).map((person,index)=>({person,index,score:decisionMakerScore(person)})).sort((a,b)=>b.score-a.score||a.index-b.index).slice(0,limit).map(({person})=>person);
}

function mapEnrichedPerson(payload:UnknownRecord,fallbackId:string):StagedApolloContact|null{
  const person=record(payload.person);if(!person)return null;
  const providerRecordId=stringValue(person.id)??fallbackId;
  const firstName=stringValue(person.first_name);const lastName=stringValue(person.last_name);
  const combinedName=[firstName,lastName].filter(Boolean).join(" ")||null;
  const fullName=stringValue(person.name)??combinedName;
  if(!fullName)return null;
  const title=stringValue(person.title);const email=stringValue(person.email);const linkedinUrl=stringValue(person.linkedin_url);
  return{providerRecordId,firstName,lastName,fullName,title,roleCategory:roleFromTitle(title),email,emailStatus:emailStatus(person.email_status,email),directPhone:null,phoneStatus:"Not Found",linkedinUrl,confidence:emailStatus(person.email_status,email)==="Verified"?"High":"Medium",sourceUrl:linkedinUrl,rawData:{provider:"Apollo",providerRecordId}};
}

export async function findAndEnrichDecisionMakers(domain:string,limit=3){
  const boundedLimit=Math.min(Math.max(limit,1),3);
  const search=await apolloPost("/mixed_people/api_search",searchParams(domain));
  const previews=rankedPreviews(search,boundedLimit);
  const contacts:StagedApolloContact[]=[];
  for(const preview of previews){const id=stringValue(preview.id);if(!id)continue;const enriched=await apolloPost("/people/match",new URLSearchParams({id,domain}));const contact=mapEnrichedPerson(enriched,id);if(contact)contacts.push(contact);}
  return contacts;
}
