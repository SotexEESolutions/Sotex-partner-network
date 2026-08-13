import { NextResponse } from "next/server";
import { processWebResearchQueue } from "@/lib/discovery/web-research";

export const maxDuration=300;
export async function GET(request:Request){const secret=process.env.CRON_SECRET;if(!secret||request.headers.get("authorization")!==`Bearer ${secret}`)return NextResponse.json({error:"Unauthorized"},{status:401});try{return NextResponse.json(await processWebResearchQueue(Number(process.env.WEB_RESEARCH_DAILY_CANDIDATE_LIMIT??30)));}catch(error){console.error(`[Web Research] cron failed (code: ${error&&typeof error==="object"&&"code" in error?String(error.code):"unknown"})`);return NextResponse.json({error:"Research worker failed."},{status:500});}}
