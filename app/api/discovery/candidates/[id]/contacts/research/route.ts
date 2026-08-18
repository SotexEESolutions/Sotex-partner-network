import { NextResponse } from "next/server";
import { findAndEnrichDecisionMakers } from "@/lib/discovery/apollo";
import { findWebsiteDecisionMakers } from "@/lib/discovery/web-research";
import { createClient } from "@/lib/supabase/server";

function safeLog(operation:string,error:unknown){const code=typeof error==="object"&&error&&"code"in error?String(error.code):"unknown";console.error(`[Contact Research] ${operation} failed (code: ${code})`);}

export async function POST(_request:Request,context:{params:Promise<{id:string}>}){
  const{id}=await context.params;const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"Authentication required."},{status:401});
  const{data:candidate,error:candidateError}=await supabase.from("firm_candidates").select("id,firm_name,website,domain,city,state,review_status").eq("id",id).single<{id:string;firm_name:string;website:string|null;domain:string|null;city:string;state:string;review_status:string}>();
  if(candidateError||!candidate)return NextResponse.json({error:"Candidate was not found."},{status:404});
  if(!["New","Needs Review"].includes(candidate.review_status))return NextResponse.json({error:"This candidate is not available for contact research."},{status:409});
  if(!candidate.domain)return NextResponse.json({error:"A company website is required before contact research can run."},{status:422});

  await supabase.from("firm_candidates").update({contact_research_status:"Researching"}).eq("id",id);
  try{
    let websiteContacts:Awaited<ReturnType<typeof findWebsiteDecisionMakers>>=[];try{websiteContacts=await findWebsiteDecisionMakers(candidate);}catch(websiteError){safeLog("official website decision-maker research",websiteError);}const apolloContacts=websiteContacts.length?[]:await findAndEnrichDecisionMakers(candidate.domain,3);
    const rows=websiteContacts.length?websiteContacts.map((contact,index)=>({firm_candidate_id:id,provider:"Website",provider_record_id:`${(contact.email||"").toLowerCase()}|${(contact.linkedinUrl||"").toLowerCase()}|${(contact.fullName||`${contact.firstName||""} ${contact.lastName||""}`).toLowerCase()}`,first_name:contact.firstName??null,last_name:contact.lastName??null,full_name:contact.fullName??null,normalized_name:(contact.fullName??`${contact.firstName||""} ${contact.lastName||""}`).toLowerCase().replace(/[^a-z0-9]+/g," ").trim()||null,title:contact.title??null,role_category:"Decision Maker",email:contact.email??null,email_status:contact.email?"Unverified":"Not Found",direct_phone:contact.phone??null,phone_status:contact.phone?"Unverified":"Not Found",linkedin_url:contact.linkedinUrl??null,confidence:contact.confidence??"Medium",is_primary_contact:index===0,is_decision_maker:true,selected_for_approval:true,source_url:contact.sourceUrl??candidate.website,raw_data:{excerpt:contact.excerpt??null}})):apolloContacts.map((contact,index)=>({firm_candidate_id:id,provider:"Apollo",provider_record_id:contact.providerRecordId,first_name:contact.firstName,last_name:contact.lastName,full_name:contact.fullName,normalized_name:contact.fullName?contact.fullName.toLowerCase().replace(/[^a-z0-9]+/g," ").trim():null,title:contact.title,role_category:contact.roleCategory,email:contact.email,email_status:contact.emailStatus,direct_phone:contact.directPhone,phone_status:contact.phoneStatus,linkedin_url:contact.linkedinUrl,confidence:contact.confidence,is_primary_contact:index===0,is_decision_maker:true,selected_for_approval:true,source_url:contact.sourceUrl,raw_data:contact.rawData}));
    if(rows.length>0){
      const{error}=await supabase.from("candidate_contacts").upsert(rows,{onConflict:"firm_candidate_id,provider,provider_record_id"});if(error)throw error;
    }
    const status=rows.length>0?"Complete":"No Contact Found";const researchedAt=new Date().toISOString();
    await supabase.from("firm_candidates").update({contact_research_status:status,contact_researched_at:researchedAt}).eq("id",id);
    const{data:staged,error:stagedError}=await supabase.from("candidate_contacts").select("*").eq("firm_candidate_id",id).order("is_primary_contact",{ascending:false}).order("created_at");
    if(stagedError)throw stagedError;
    return NextResponse.json({status,contacts:staged??[]});
  }catch(error){
    safeLog("Apollo decision-maker research",error);await supabase.from("firm_candidates").update({contact_research_status:"Failed",contact_researched_at:new Date().toISOString()}).eq("id",id);
    const code=typeof error==="object"&&error&&"code"in error?String(error.code):"unknown";
    if(code==="not-configured")return NextResponse.json({error:"Contact enrichment is not configured."},{status:503});
    if(code==="401"||code==="403")return NextResponse.json({error:"Contact enrichment is not configured."},{status:503});
    if(code==="402")return NextResponse.json({error:"Contact enrichment credits are unavailable."},{status:402});
    if(code==="429")return NextResponse.json({error:"Contact enrichment is temporarily rate limited."},{status:429});
    return NextResponse.json({error:"Contacts could not be researched. Please try again."},{status:502});
  }
}
