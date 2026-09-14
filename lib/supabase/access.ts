import type { SupabaseClient } from "@supabase/supabase-js";
import type { AccessContext, AppRole, AssignmentStatus, Profile, RecordVisibility, Territory, TerritoryAccessLevel, UserTerritory } from "@/lib/types";

type ProfileRow={id:string;full_name:string|null;email:string;role:AppRole;is_active:boolean;manager_user_id:string|null;created_at:string;updated_at:string};
type TerritoryRow={id:string;name:string;region:string;state:string;is_active:boolean;created_at:string;updated_at:string};
type AssignmentRow={id:string;user_id:string;territory_id:string;access_level:TerritoryAccessLevel;created_at:string};

export const mapProfile=(row:ProfileRow):Profile=>({id:row.id,fullName:row.full_name??row.email,email:row.email,role:row.role,isActive:row.is_active,managerUserId:row.manager_user_id??undefined,createdAt:row.created_at,updatedAt:row.updated_at});
export const mapTerritory=(row:TerritoryRow):Territory=>({id:row.id,name:row.name,region:row.region,state:row.state,isActive:row.is_active,createdAt:row.created_at,updatedAt:row.updated_at});
export const mapAssignment=(row:AssignmentRow):UserTerritory=>({id:row.id,userId:row.user_id,territoryId:row.territory_id,accessLevel:row.access_level,createdAt:row.created_at});

export async function fetchAccessContext(supabase:SupabaseClient):Promise<AccessContext>{
  const{data:{user},error:userError}=await supabase.auth.getUser();
  if(userError||!user)throw new Error("Authentication required");
  const[{data:current,error:currentError},{data:profiles,error:profilesError},{data:territories,error:territoriesError},{data:assignments,error:assignmentsError}]=await Promise.all([
    supabase.from("profiles").select("*").eq("id",user.id).single<ProfileRow>(),
    supabase.from("profiles").select("*").order("full_name").returns<ProfileRow[]>(),
    supabase.from("territories").select("*").order("name").returns<TerritoryRow[]>(),
    supabase.from("user_territories").select("*").returns<AssignmentRow[]>(),
  ]);
  if(currentError||!current||profilesError||territoriesError||assignmentsError)throw new Error("Access profile could not be loaded");
  return{currentUser:mapProfile(current),profiles:(profiles??[]).map(mapProfile),territories:(territories??[]).map(mapTerritory),assignments:(assignments??[]).map(mapAssignment)};
}

export async function updateProfileAccess(supabase:SupabaseClient,id:string,values:{role:AppRole;isActive:boolean;managerUserId?:string}):Promise<{profile:Profile}|{error:unknown}>{
  const{data,error}=await supabase.from("profiles").update({role:values.role,is_active:values.isActive,manager_user_id:values.managerUserId||null}).eq("id",id).select("*").single<ProfileRow>();
  return error||!data?{error}:{profile:mapProfile(data)};
}
export async function saveTerritory(supabase:SupabaseClient,input:{id?:string;name:string;region:string;state:string;isActive:boolean}):Promise<{territory:Territory}|{error:unknown}>{
  const payload={name:input.name,region:input.region,state:input.state,is_active:input.isActive};
  const query=input.id?supabase.from("territories").update(payload).eq("id",input.id):supabase.from("territories").insert(payload);
  const{data,error}=await query.select("*").single<TerritoryRow>();return error||!data?{error}:{territory:mapTerritory(data)};
}
export async function setUserTerritory(supabase:SupabaseClient,userId:string,territoryId:string,accessLevel:TerritoryAccessLevel):Promise<{assignment:UserTerritory}|{error:unknown}>{
  const{data,error}=await supabase.from("user_territories").upsert({user_id:userId,territory_id:territoryId,access_level:accessLevel},{onConflict:"user_id,territory_id"}).select("*").single<AssignmentRow>();return error||!data?{error}:{assignment:mapAssignment(data)};
}
export async function removeUserTerritory(supabase:SupabaseClient,id:string):Promise<{ok:true}|{error:unknown}>{const{error}=await supabase.from("user_territories").delete().eq("id",id);return error?{error}:{ok:true};}
export async function assignFirms(supabase:SupabaseClient,firmIds:string[],assignedUserId:string|null,status:AssignmentStatus):Promise<{count:number}|{error:unknown}>{const{data,error}=await supabase.rpc("assign_firms",{p_firm_ids:firmIds,p_assigned_user_id:assignedUserId,p_assignment_status:status});return error?{error}:{count:Number(data??0)};}

export function canManageTerritory(access:AccessContext,territoryId?:string){return access.currentUser.role==="Admin"||Boolean(territoryId&&access.currentUser.role==="Manager"&&access.assignments.some(a=>a.userId===access.currentUser.id&&a.territoryId===territoryId&&a.accessLevel==="Manage"));}
export function canEditFirm(access:AccessContext,firm:{territoryId?:string;assignedUserId?:string;recordVisibility:RecordVisibility;createdByUserId?:string}){return canManageTerritory(access,firm.territoryId)||(access.currentUser.role==="Rep"&&firm.assignedUserId===access.currentUser.id&&access.assignments.some(a=>a.userId===access.currentUser.id&&a.territoryId===firm.territoryId&&(a.accessLevel==="Work"||a.accessLevel==="Manage")))||(firm.recordVisibility==="Private"&&firm.createdByUserId===access.currentUser.id);}
