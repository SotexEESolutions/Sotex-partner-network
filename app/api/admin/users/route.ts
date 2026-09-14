import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient, createClient } from "@/lib/supabase/server";

const inviteSchema=z.object({email:z.string().email(),fullName:z.string().trim().min(2).max(120)});

export async function POST(request:Request){
  const supabase=await createClient();
  const{data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"Authentication required."},{status:401});
  const{data:profile}=await supabase.from("profiles").select("role,is_active").eq("id",user.id).single<{role:string;is_active:boolean}>();
  if(profile?.role!=="Admin"||!profile.is_active)return NextResponse.json({error:"Administrator access is required."},{status:403});
  const parsed=inviteSchema.safeParse(await request.json().catch(()=>null));
  if(!parsed.success)return NextResponse.json({error:"Enter a valid name and email address."},{status:400});
  const admin=createAdminClient();
  const{error}=await admin.auth.admin.inviteUserByEmail(parsed.data.email,{data:{full_name:parsed.data.fullName}});
  if(error){
    console.error(`[Admin] invite failed (code: ${error.status??"unknown"})`);
    return NextResponse.json({error:"The invitation could not be sent. The address may already be registered."},{status:409});
  }
  return NextResponse.json({ok:true},{status:201});
}
