import { NextResponse } from "next/server";
import { z } from "zod";
import { DISCOVERY_CATEGORIES, DISCOVERY_MARKETS, estimateDiscoveryRequests, getDiscoveryMarket } from "@/lib/discovery/markets";
import { createClient } from "@/lib/supabase/server";

const schema=z.object({markets:z.array(z.string()).min(1).max(DISCOVERY_MARKETS.length),categories:z.array(z.enum(DISCOVERY_CATEGORIES)).min(1).max(DISCOVERY_CATEGORIES.length),idempotencyKey:z.string().uuid()});

export async function POST(request:Request){
  const supabase=await createClient();
  const{data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"Authentication required."},{status:401});
  const parsed=schema.safeParse(await request.json().catch(()=>null));
  if(!parsed.success)return NextResponse.json({error:"Invalid discovery request."},{status:400});
  const markets=parsed.data.markets.map(getDiscoveryMarket);
  if(markets.some((market)=>!market))return NextResponse.json({error:"Invalid discovery market."},{status:400});

  const today=new Date();today.setUTCHours(0,0,0,0);
  const{data:dailyJobs,error:dailyError}=await supabase.from("discovery_jobs").select("estimated_requests").gte("created_at",today.toISOString());
  if(dailyError)return NextResponse.json({error:"Discovery could not be started."},{status:500});
  const plannedRequests=estimateDiscoveryRequests(parsed.data.markets,parsed.data.categories.length);
  const dailyLimit=Number(process.env.DISCOVERY_DAILY_REQUEST_LIMIT??60);
  const usedRequests=(dailyJobs??[]).reduce((sum,job)=>sum+Number(job.estimated_requests??0),0);
  if(usedRequests+plannedRequests>dailyLimit)return NextResponse.json({error:"The daily discovery request limit has been reached."},{status:429});

  const jobs:{id:string;status:string}[]=[];
  for(const market of markets){
    if(!market)continue;
    const idempotencyKey=`${parsed.data.idempotencyKey}:${market.key}`;
    const{data:existing}=await supabase.from("discovery_jobs").select("id,status").eq("idempotency_key",idempotencyKey).maybeSingle();
    if(existing){jobs.push(existing);continue;}
    const queryCount=market.anchors.length*parsed.data.categories.length;
    const pageSize=market.anchors.length>1?Math.max(1,Math.ceil(market.target/market.anchors.length)):20;
    const{data:job,error:jobError}=await supabase.from("discovery_jobs").insert({city:market.city,market:market.label,region:market.region,state:"TX",search_category:"Multiple categories",search_query:`${queryCount} Google Places searches across ${market.label}`,source:"Google Places API",requested_categories:parsed.data.categories,target_candidates:market.target,queries_total:queryCount,estimated_requests:queryCount,requested_by:user.id,idempotency_key:idempotencyKey}).select("id,status").single();
    if(jobError||!job)return NextResponse.json({error:"Discovery could not be started."},{status:500});
    const queries=parsed.data.categories.flatMap((category)=>market.anchors.map((anchorCity)=>({job_id:job.id,market:market.label,anchor_city:anchorCity,page_size:pageSize,category,query_text:`${category} in ${anchorCity}, TX`})));
    const{error:queryError}=await supabase.from("discovery_job_queries").insert(queries);
    if(queryError){await supabase.from("discovery_jobs").delete().eq("id",job.id);return NextResponse.json({error:"Discovery could not be started."},{status:500});}
    jobs.push(job);
  }
  return NextResponse.json({jobs},{status:201});
}
