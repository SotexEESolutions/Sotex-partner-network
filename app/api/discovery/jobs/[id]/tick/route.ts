import { NextResponse } from "next/server";
import { mapGooglePlace, searchGooglePlaces } from "@/lib/discovery/google-places";
import { createClient } from "@/lib/supabase/server";

type JobRow={id:string;market:string;region:string;status:string;requested_by:string;target_candidates:number;records_found:number;records_imported:number;queries_attempted:number;actual_requests:number;candidates_duplicate_existing:number;firm_matches_flagged:number};
type QueryRow={id:string;category:string;query_text:string;page_size:number;page_number:number;next_page_token:string|null;attempt_count:number;places_returned:number;candidates_staged:number;duplicates_skipped:number;firm_matches_flagged:number};
function safeLog(operation:string,error:unknown){const code=typeof error==="object"&&error&&"code"in error?String(error.code):"unknown";console.error(`[Discovery] ${operation} failed (code: ${code})`);}

export async function POST(_request:Request,context:{params:Promise<{id:string}>}){
  const{id}=await context.params;const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"Authentication required."},{status:401});
  const{data:job,error:jobError}=await supabase.from("discovery_jobs").select("id,market,region,status,requested_by,target_candidates,records_found,records_imported,queries_attempted,actual_requests,candidates_duplicate_existing,firm_matches_flagged").eq("id",id).eq("requested_by",user.id).single<JobRow>();
  if(jobError||!job)return NextResponse.json({error:"Discovery job was not found."},{status:404});
  if(["Complete","Failed"].includes(job.status))return NextResponse.json({jobId:id,status:job.status});
  const today=new Date();today.setUTCHours(0,0,0,0);
  const{data:usage,error:usageError}=await supabase.from("discovery_jobs").select("actual_requests").gte("created_at",today.toISOString());
  const dailyLimit=Number(process.env.DISCOVERY_DAILY_REQUEST_LIMIT??60);
  const usedRequests=(usage??[]).reduce((sum,row)=>sum+Number(row.actual_requests??0),0);
  if(usageError||usedRequests>=dailyLimit)return NextResponse.json({error:"The daily discovery request limit has been reached."},{status:429});
  const{data:nextQuery,error:nextError}=await supabase.from("discovery_job_queries").select("*").eq("job_id",id).eq("status","Pending").order("created_at").limit(1).maybeSingle<QueryRow>();
  if(nextError)return NextResponse.json({error:"Discovery could not continue."},{status:500});
  if(!nextQuery){await supabase.from("discovery_jobs").update({status:"Complete",completed_at:new Date().toISOString()}).eq("id",id);return NextResponse.json({jobId:id,status:"Complete"});}
  const{data:claimed}=await supabase.from("discovery_job_queries").update({status:"Running",started_at:new Date().toISOString(),attempt_count:nextQuery.attempt_count+1}).eq("id",nextQuery.id).eq("status","Pending").select("id").maybeSingle();
  if(!claimed)return NextResponse.json({jobId:id,status:"Running"},{status:409});
  await supabase.from("discovery_jobs").update({status:"Running",started_at:new Date().toISOString(),error_message:null}).eq("id",id).eq("status","Pending");
  try{
    const remaining=Math.max(job.target_candidates-job.records_imported,0);
    if(remaining===0){const now=new Date().toISOString();await supabase.from("discovery_job_queries").update({status:"Skipped",completed_at:now,updated_at:now}).eq("job_id",id).in("status",["Pending","Running"]);await supabase.from("discovery_jobs").update({status:"Complete",completed_at:now}).eq("id",id);return NextResponse.json({jobId:id,status:"Complete",staged:0,duplicates:0,flagged:0});}
    const result=await searchGooglePlaces({query:nextQuery.query_text,pageToken:nextQuery.next_page_token,pageSize:Math.min(nextQuery.page_size,remaining)});
    const places=(result.places??[]).filter((place)=>place.id&&place.displayName?.text);
    const rows=places.slice(0,remaining).map((place)=>mapGooglePlace(place,{jobId:job.id,market:job.market,region:job.region,category:nextQuery.category}));
    const insertion=rows.length?await supabase.from("firm_candidates").upsert(rows,{onConflict:"source,source_record_id",ignoreDuplicates:true}).select("id,duplicate_status"):{data:[],error:null};
    if(insertion.error)throw insertion.error;
    const staged=insertion.data?.length??0,duplicates=rows.length-staged,flagged=(insertion.data??[]).filter((candidate)=>candidate.duplicate_status!=="No Match").length;
    const importedTotal=job.records_imported+staged,hasNext=Boolean(result.nextPageToken)&&nextQuery.page_number<3&&importedTotal<job.target_candidates,now=new Date().toISOString();
    await supabase.from("discovery_job_queries").update({status:hasNext?"Pending":"Complete",page_number:hasNext?nextQuery.page_number+1:nextQuery.page_number,next_page_token:hasNext?result.nextPageToken:null,places_returned:nextQuery.places_returned+places.length,candidates_staged:nextQuery.candidates_staged+staged,duplicates_skipped:nextQuery.duplicates_skipped+duplicates,firm_matches_flagged:nextQuery.firm_matches_flagged+flagged,completed_at:hasNext?null:now,updated_at:now,last_error:null}).eq("id",nextQuery.id);
    await supabase.from("discovery_jobs").update({records_found:job.records_found+places.length,records_imported:importedTotal,queries_attempted:job.queries_attempted+1,actual_requests:job.actual_requests+1,candidates_duplicate_existing:job.candidates_duplicate_existing+duplicates,firm_matches_flagged:job.firm_matches_flagged+flagged}).eq("id",id);
    if(importedTotal>=job.target_candidates){await supabase.from("discovery_job_queries").update({status:"Skipped",completed_at:now,updated_at:now}).eq("job_id",id).eq("status","Pending");await supabase.from("discovery_jobs").update({status:"Complete",completed_at:now}).eq("id",id);return NextResponse.json({jobId:id,status:"Complete",staged,duplicates,flagged});}
    return NextResponse.json({jobId:id,status:"Running",staged,duplicates,flagged});
  }catch(error){
    safeLog("Google Places tick",error);const failed=nextQuery.attempt_count+1>=3,now=new Date().toISOString();
    await supabase.from("discovery_job_queries").update({status:failed?"Failed":"Pending",last_error:"The provider request failed.",updated_at:now}).eq("id",nextQuery.id);
    await supabase.from("discovery_jobs").update({status:failed?"Failed":"Running",error_message:"A provider request failed. Try resuming the job.",...(failed?{completed_at:now}:{})}).eq("id",id);
    return NextResponse.json({error:"Discovery could not continue."},{status:502});
  }
}
