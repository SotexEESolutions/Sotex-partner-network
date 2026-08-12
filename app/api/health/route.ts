import { NextResponse } from "next/server";
export function GET(){return NextResponse.json({status:"ok",service:"sotex-partner-network",databaseConfigured:Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL)});}
