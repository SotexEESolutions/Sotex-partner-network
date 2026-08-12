"use client";
/* eslint-disable react/jsx-no-target-blank */
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowUpRight, Check, CheckCircle2, ChevronDown, DatabaseZap, ExternalLink, FileSearch, Globe2, MapPin, Merge, Play, Search, ShieldCheck, X } from "lucide-react";
import type { DiscoveryJob, Firm, FirmCandidate } from "@/lib/types";
import { normalizeDomain } from "@/lib/discovery/core.mjs";
import { createClient } from "@/lib/supabase/client";
import { fetchCandidateById, mapCandidateRow, type FirmCandidateRow } from "@/lib/supabase/candidates";
import { fetchFirmById } from "@/lib/supabase/firms";

type Props={
  initialCandidates:FirmCandidate[]|null;
  jobs:DiscoveryJob[]|null;
  discoveryFailed:boolean;
  onFirmApproved:(firm:Firm)=>void;
  notify:(s:string)=>void;
};
const categories=["CPA Firm","Accountant","Bookkeeper","Enrolled Agent","Tax Preparation","CAS / Advisory","Small Business Accountant"];

function logSafeError(operation:string,error:unknown){
  const code=error&&typeof error==="object"&&"code"in error?String((error as {code?:unknown}).code):"unknown";
  console.error(`[Discovery] ${operation} failed (code: ${code})`);
}

export function Discovery({initialCandidates,jobs,discoveryFailed,onFirmApproved,notify}:Props){
  const [candidates,setCandidates]=useState<FirmCandidate[]>(initialCandidates??[]);
  const [selected,setSelected]=useState<string[]>([]);
  const [tab,setTab]=useState<"Review queue"|"Discovery jobs">("Review queue"); const [status,setStatus]=useState("All statuses"); const [query,setQuery]=useState("");
  const [pendingIds,setPendingIds]=useState<string[]>([]);
  const setPending=(id:string,pending:boolean)=>setPendingIds(ids=>pending?[...ids,id]:ids.filter(x=>x!==id));

  const visible=useMemo(()=>candidates.filter(c=>(status==="All statuses"||c.reviewStatus===status)&&`${c.name} ${c.city} ${c.type}`.toLowerCase().includes(query.toLowerCase())),[candidates,status,query]);
  const counts={found:candidates.length,new:candidates.filter(c=>c.reviewStatus==="New").length,approved:candidates.filter(c=>c.reviewStatus==="Approved").length,rejected:candidates.filter(c=>c.reviewStatus==="Rejected").length,duplicates:candidates.filter(c=>c.duplicateStatus!=="No Match").length,review:candidates.filter(c=>c.reviewStatus==="Needs Review").length};

  const approve=async(candidate:FirmCandidate)=>{
    if(pendingIds.includes(candidate.id))return;
    setPending(candidate.id,true);
    const supabase=createClient();
    const {data:rpcResult,error}=await supabase.rpc("approve_firm_candidate",{candidate_id:candidate.id});
    const newFirmId=typeof rpcResult==="string"?rpcResult:null;
    if(error||!newFirmId){
      logSafeError("approve_firm_candidate",error);
      notify("This candidate could not be approved. Review its duplicate status and try again.");
      try{
        const fresh=await fetchCandidateById(supabase,candidate.id);
        setCandidates(cs=>cs.map(c=>c.id===fresh.id?fresh:c));
      }catch(refreshError){logSafeError("fetchCandidateById",refreshError);}
      setPending(candidate.id,false);
      return;
    }
    try{
      const [freshCandidate,firm]=await Promise.all([fetchCandidateById(supabase,candidate.id),fetchFirmById(supabase,newFirmId)]);
      setCandidates(cs=>cs.map(c=>c.id===freshCandidate.id?freshCandidate:c));
      setSelected(s=>s.filter(x=>x!==candidate.id));
      onFirmApproved(firm);
      notify(`${firm.name} approved and added to Firms`);
    }catch(refreshError){
      logSafeError("post-approval refresh",refreshError);
      notify("Approved, but we couldn't refresh the details. Please reload.");
    }
    setPending(candidate.id,false);
  };

  const setReviewStatus=async(candidate:FirmCandidate,reviewStatus:"Rejected"|"Needs Review")=>{
    if(pendingIds.includes(candidate.id))return;
    setPending(candidate.id,true);
    const supabase=createClient();
    const {data,error}=await supabase.from("firm_candidates").update({review_status:reviewStatus}).eq("id",candidate.id).select("*").single<FirmCandidateRow>();
    if(error||!data){
      logSafeError("update review_status",error);
      notify("This candidate could not be updated. Please try again.");
      setPending(candidate.id,false);
      return;
    }
    const fresh=mapCandidateRow(data);
    setCandidates(cs=>cs.map(c=>c.id===fresh.id?fresh:c));
    setSelected(s=>s.filter(x=>x!==candidate.id));
    notify(`${candidate.name} marked ${reviewStatus.toLowerCase()}`);
    setPending(candidate.id,false);
  };

  if(discoveryFailed){
    return <section className="page discovery-page"><div className="page-title compact"><div><span className="eyebrow">PROSPECT OPERATIONS</span><h1>Discovery</h1></div></div>
      <div className="empty"><AlertTriangle size={24}/><h3>Couldn&apos;t load Discovery data</h3><p>We couldn&apos;t load candidates and discovery jobs. Please try again.</p><button className="primary" onClick={()=>window.location.reload()}>Reload</button></div>
    </section>;
  }

  return <section className="page discovery-page"><div className="page-title compact"><div><span className="eyebrow">PROSPECT OPERATIONS</span><h1>Discovery</h1><p>Review real prospects before they enter your partner database.</p></div><button className="primary" disabled title="Discovery job creation isn't configured yet" onClick={()=>setTab("Discovery jobs")}><Play size={16}/>New discovery job</button></div>
    <div className="discovery-metrics">{[{label:"Candidates found",value:counts.found,Icon:DatabaseZap,tone:"sage"},{label:"New",value:counts.new,Icon:FileSearch,tone:"blue"},{label:"Approved",value:counts.approved,Icon:CheckCircle2,tone:"green"},{label:"Rejected",value:counts.rejected,Icon:X,tone:"red"},{label:"Duplicates",value:counts.duplicates,Icon:Merge,tone:"gold"},{label:"Needs review",value:counts.review,Icon:AlertTriangle,tone:"gold"}].map(({label,value,Icon,tone})=><div className="metric discovery-metric" key={label}><div className={`metric-icon ${tone}`}><Icon size={18}/></div><span>{label}</span><strong>{value}</strong></div>)}</div>
    <div className="discovery-tabs"><button className={tab==="Review queue"?"active":""} onClick={()=>setTab("Review queue")}>Review queue <em>{counts.new}</em></button><button className={tab==="Discovery jobs"?"active":""} onClick={()=>setTab("Discovery jobs")}>Discovery jobs <em>{jobs?.length??0}</em></button></div>
    {tab==="Review queue"?<><div className="review-toolbar"><div className="review-search"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search candidates..."/></div><label className="select"><select value={status} onChange={e=>setStatus(e.target.value)}>{["All statuses","New","Approved","Rejected","Duplicate","Needs Review"].map(x=><option key={x}>{x}</option>)}</select><ChevronDown size={14}/></label><span>{visible.length} results</span></div>
      {selected.length>0&&<div className="bulkbar"><b>{selected.length} selected</b><button disabled title="Bulk approval isn't available yet — use the row actions"><Check size={14}/>Approve</button><button disabled title="Bulk rejection isn't available yet — use the row actions"><X size={14}/>Reject</button><button disabled title="Bulk status updates aren't available yet — use the row actions"><AlertTriangle size={14}/>Needs review</button><button onClick={()=>setSelected([])}>Clear</button></div>}
      <div className="candidate-list"><div className="candidate-head"><input aria-label="Select all candidates" type="checkbox" checked={visible.length>0&&selected.length===visible.length} onChange={e=>setSelected(e.target.checked?visible.map(c=>c.id):[])}/><span>Candidate</span><span>Firm profile</span><span>Source & confidence</span><span>Duplicate check</span><span>Actions</span></div>{visible.map(c=>{const pending=pendingIds.includes(c.id);const approvable=(c.reviewStatus==="New"||c.reviewStatus==="Needs Review")&&c.duplicateStatus==="No Match";return <article className={`candidate-row review-${c.reviewStatus.toLowerCase().replace(" ","-")}`} key={c.id}><input aria-label={`Select ${c.name}`} type="checkbox" checked={selected.includes(c.id)} onChange={()=>setSelected(s=>s.includes(c.id)?s.filter(x=>x!==c.id):[...s,c.id])}/><div className="candidate-company"><div className="company-icon">{c.name.split(" ").map(x=>x[0]).slice(0,2).join("")}</div><div><b>{c.name}</b><span><MapPin size={11}/>{c.city}, TX</span><a href={c.website} target="_blank">{normalizeDomain(c.website)} <ExternalLink size={10}/></a></div></div><div><span className="type-pill">{c.type}</span><p>{c.description}</p>{c.phone&&<small>{c.phone}</small>}</div><div className="source-cell"><b><Globe2 size={13}/>{c.source}</b><a href={c.sourceUrl} target="_blank">View evidence <ArrowUpRight size={11}/></a><span className={`confidence c-${c.confidence.toLowerCase()}`}>{c.confidence} confidence</span></div><div>{c.duplicateStatus==="No Match"?<span className="duplicate-ok"><ShieldCheck size={14}/>No match</span>:<span className="duplicate-warn"><AlertTriangle size={14}/>{c.duplicateStatus}</span>}</div><div className="candidate-actions">{c.reviewStatus==="New"||c.reviewStatus==="Needs Review"?<><button title={approvable?"Approve":"Resolve the duplicate match before approving"} className="approve" disabled={pending||!approvable} onClick={()=>approve(c)}><Check size={15}/></button><button title="Reject" disabled={pending} onClick={()=>setReviewStatus(c,"Rejected")}><X size={15}/></button>{c.reviewStatus==="New"&&<button title="Needs review" disabled={pending} onClick={()=>setReviewStatus(c,"Needs Review")}><AlertTriangle size={15}/></button>}</>:<span className={`review-label rl-${c.reviewStatus.toLowerCase()}`}>{c.reviewStatus}</span>}</div></article>;})}</div></>:<DiscoveryJobsPanel jobs={jobs??[]}/>}
  </section>
}

function DiscoveryJobsPanel({jobs}:{jobs:DiscoveryJob[]}){return <div className="jobs-layout"><div className="panel jobs-panel"><div className="panel-head"><div><h2>San Antonio market plan</h2><p>Seven controlled query patterns · ingestion not configured</p></div><span className="job-goal">Goal 150–250</span></div>{categories.map((c,i)=><div className="job-row" key={c}><div className="job-index">{String(i+1).padStart(2,"0")}</div><div><b>{c}</b><span>{c.toLowerCase()} San Antonio TX</span></div><span className="source-tag">Not configured</span><button disabled title="Discovery job ingestion isn't configured yet"><Play size={13}/>Run query</button></div>)}</div><aside className="panel provider-card"><Globe2 size={22}/><h3>Provider architecture ready</h3><p>Discovery, website research, and contact enrichment return standardized records before touching the master database.</p><ul><li><Check size={13}/>Manual research connected</li><li><span/>Google Places needs credentials</li><li><span/>Apollo needs credentials</li><li><span/>Lusha needs credentials</li></ul></aside><div className="panel jobs-history"><div className="panel-head"><div><h2>Job history</h2><p>Executed discovery jobs from the database</p></div></div>{jobs.length?jobs.map(j=><div className="job-history-row" key={j.id}><div><b>{j.searchCategory}</b><span>{j.city} · {j.source}</span></div><span className={`status ${j.status==="Complete"?"contacted":"new"}`}>{j.status}</span><span>{j.recordsFound} found · {j.recordsImported} imported · {j.recordsRejected} rejected</span></div>):<p className="job-history-empty">No discovery jobs yet. Executed jobs will appear here.</p>}</div></div>}
