"use client";
/* eslint-disable react/jsx-no-target-blank */
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowUpRight, Check, CheckCircle2, ChevronDown, DatabaseZap, ExternalLink, FileSearch, Globe2, MapPin, Merge, Pause, Play, RotateCw, Search, ShieldCheck, X } from "lucide-react";
import type { DiscoveryJob, Firm, FirmCandidate } from "@/lib/types";
import { normalizeDomain } from "@/lib/discovery/core.mjs";
import { createClient } from "@/lib/supabase/client";
import { fetchCandidateById, fetchCandidates, fetchDiscoveryJobs, mapCandidateRow, type FirmCandidateRow } from "@/lib/supabase/candidates";
import { fetchFirmById } from "@/lib/supabase/firms";
import { tickDiscoveryJob } from "@/lib/discovery/api";
import { DiscoveryJobForm } from "@/components/discovery-job-form";

type Props={
  initialCandidates:FirmCandidate[]|null;
  jobs:DiscoveryJob[]|null;
  discoveryFailed:boolean;
  onFirmApproved:(firm:Firm)=>void;
  notify:(s:string)=>void;
};

function logSafeError(operation:string,error:unknown){
  const code=error&&typeof error==="object"&&"code"in error?String((error as {code?:unknown}).code):"unknown";
  console.error(`[Discovery] ${operation} failed (code: ${code})`);
}

const TICK_DELAY_MS=400;

export function Discovery({initialCandidates,jobs:initialJobs,discoveryFailed,onFirmApproved,notify}:Props){
  const [candidates,setCandidates]=useState<FirmCandidate[]>(initialCandidates??[]);
  const [jobs,setJobs]=useState<DiscoveryJob[]>(initialJobs??[]);
  const [selected,setSelected]=useState<string[]>([]);
  const [tab,setTab]=useState<"Review queue"|"Discovery jobs">("Review queue"); const [status,setStatus]=useState("All statuses"); const [query,setQuery]=useState("");
  const [pendingIds,setPendingIds]=useState<string[]>([]);
  const setPending=(id:string,pending:boolean)=>setPendingIds(ids=>pending?[...ids,id]:ids.filter(x=>x!==id));

  const [currentUserId,setCurrentUserId]=useState<string|null>(null);
  const [creatingJobs,setCreatingJobs]=useState(false);
  const [runningJobIds,setRunningJobIds]=useState<Set<string>>(new Set());
  const [jobRunError,setJobRunError]=useState("");
  const runningRef=useRef<Set<string>>(new Set());
  const pausedRef=useRef<Set<string>>(new Set());

  useEffect(()=>{
    const supabase=createClient();
    supabase.auth.getUser().then(({data})=>setCurrentUserId(data.user?.id??null)).catch(fetchError=>logSafeError("auth.getUser",fetchError));
  },[]);

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

  const refreshCandidatesAndJobs=async()=>{
    const supabase=createClient();
    try{
      const [freshCandidates,freshJobs]=await Promise.all([fetchCandidates(supabase),fetchDiscoveryJobs(supabase)]);
      setCandidates(freshCandidates);
      setJobs(freshJobs);
    }catch(refreshError){logSafeError("refreshCandidatesAndJobs",refreshError);}
  };

  const runJob=async(jobId:string)=>{
    if(runningRef.current.has(jobId))return;
    runningRef.current.add(jobId);
    pausedRef.current.delete(jobId);
    setRunningJobIds(new Set(runningRef.current));
    setJobRunError("");
    while(!pausedRef.current.has(jobId)){
      const result=await tickDiscoveryJob(jobId);
      if("error" in result){
        logSafeError("tickDiscoveryJob",result.error);
        setJobRunError(result.error);
        await refreshCandidatesAndJobs();
        break;
      }
      setJobs(js=>js.map(j=>j.id===jobId?{...j,status:result.status}:j));
      if(result.status==="Complete"||result.status==="Failed"){
        await refreshCandidatesAndJobs();
        if(result.status==="Complete")notify("Discovery job complete — review new candidates in the queue.");
        break;
      }
      if((result.staged??0)>0)await refreshCandidatesAndJobs();
      await new Promise(resolve=>setTimeout(resolve,TICK_DELAY_MS));
    }
    runningRef.current.delete(jobId);
    setRunningJobIds(new Set(runningRef.current));
  };

  const pauseJob=(jobId:string)=>{pausedRef.current.add(jobId)};

  const handleJobsCreated=async(newJobs:Array<{id:string;status:string}>)=>{
    await refreshCandidatesAndJobs();
    notify(`${newJobs.length} discovery job${newJobs.length===1?"":"s"} started`);
    for(const job of newJobs){
      await runJob(job.id);
    }
  };

  if(discoveryFailed){
    return <section className="page discovery-page"><div className="page-title compact"><div><span className="eyebrow">PROSPECT OPERATIONS</span><h1>Discovery</h1></div></div>
      <div className="empty"><AlertTriangle size={24}/><h3>Couldn&apos;t load Discovery data</h3><p>We couldn&apos;t load candidates and discovery jobs. Please try again.</p><button className="primary" onClick={()=>window.location.reload()}>Reload</button></div>
    </section>;
  }

  return <section className="page discovery-page"><div className="page-title compact"><div><span className="eyebrow">PROSPECT OPERATIONS</span><h1>Discovery</h1><p>Review real prospects before they enter your partner database.</p></div><button className="primary" onClick={()=>setTab("Discovery jobs")}><Play size={16}/>New discovery job</button></div>
    <div className="discovery-metrics">{[{label:"Candidates found",value:counts.found,Icon:DatabaseZap,tone:"sage"},{label:"New",value:counts.new,Icon:FileSearch,tone:"blue"},{label:"Approved",value:counts.approved,Icon:CheckCircle2,tone:"green"},{label:"Rejected",value:counts.rejected,Icon:X,tone:"red"},{label:"Duplicates",value:counts.duplicates,Icon:Merge,tone:"gold"},{label:"Needs review",value:counts.review,Icon:AlertTriangle,tone:"gold"}].map(({label,value,Icon,tone})=><div className="metric discovery-metric" key={label}><div className={`metric-icon ${tone}`}><Icon size={18}/></div><span>{label}</span><strong>{value}</strong></div>)}</div>
    <div className="discovery-tabs"><button className={tab==="Review queue"?"active":""} onClick={()=>setTab("Review queue")}>Review queue <em>{counts.new}</em></button><button className={tab==="Discovery jobs"?"active":""} onClick={()=>setTab("Discovery jobs")}>Discovery jobs <em>{jobs.length}</em></button></div>
    {tab==="Review queue"?<><div className="review-toolbar"><div className="review-search"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search candidates..."/></div><label className="select"><select value={status} onChange={e=>setStatus(e.target.value)}>{["All statuses","New","Approved","Rejected","Duplicate","Needs Review"].map(x=><option key={x}>{x}</option>)}</select><ChevronDown size={14}/></label><span>{visible.length} results</span></div>
      {selected.length>0&&<div className="bulkbar"><b>{selected.length} selected</b><button disabled title="Bulk approval isn't available yet — use the row actions"><Check size={14}/>Approve</button><button disabled title="Bulk rejection isn't available yet — use the row actions"><X size={14}/>Reject</button><button disabled title="Bulk status updates aren't available yet — use the row actions"><AlertTriangle size={14}/>Needs review</button><button onClick={()=>setSelected([])}>Clear</button></div>}
      <div className="candidate-list"><div className="candidate-head"><input aria-label="Select all candidates" type="checkbox" checked={visible.length>0&&selected.length===visible.length} onChange={e=>setSelected(e.target.checked?visible.map(c=>c.id):[])}/><span>Candidate</span><span>Firm profile</span><span>Source & confidence</span><span>Duplicate check</span><span>Actions</span></div>{visible.map(c=>{const pending=pendingIds.includes(c.id);const approvable=(c.reviewStatus==="New"||c.reviewStatus==="Needs Review")&&c.duplicateStatus==="No Match";return <article className={`candidate-row review-${c.reviewStatus.toLowerCase().replace(" ","-")}`} key={c.id}><input aria-label={`Select ${c.name}`} type="checkbox" checked={selected.includes(c.id)} onChange={()=>setSelected(s=>s.includes(c.id)?s.filter(x=>x!==c.id):[...s,c.id])}/><div className="candidate-company"><div className="company-icon">{c.name.split(" ").map(x=>x[0]).slice(0,2).join("")}</div><div><b>{c.name}</b><span><MapPin size={11}/>{c.city}, TX</span><a href={c.website} target="_blank">{normalizeDomain(c.website)} <ExternalLink size={10}/></a></div></div><div><span className="type-pill">{c.type}</span><p>{c.description}</p>{c.phone&&<small>{c.phone}</small>}</div><div className="source-cell"><b><Globe2 size={13}/>{c.source}</b><a href={c.sourceUrl} target="_blank">View evidence <ArrowUpRight size={11}/></a><span className={`confidence c-${c.confidence.toLowerCase()}`}>{c.confidence} confidence</span></div><div>{c.duplicateStatus==="No Match"?<span className="duplicate-ok"><ShieldCheck size={14}/>No match</span>:<span className="duplicate-warn"><AlertTriangle size={14}/>{c.duplicateStatus}</span>}</div><div className="candidate-actions">{c.reviewStatus==="New"||c.reviewStatus==="Needs Review"?<><button title={approvable?"Approve":"Resolve the duplicate match before approving"} className="approve" disabled={pending||!approvable} onClick={()=>approve(c)}><Check size={15}/></button><button title="Reject" disabled={pending} onClick={()=>setReviewStatus(c,"Rejected")}><X size={15}/></button>{c.reviewStatus==="New"&&<button title="Needs review" disabled={pending} onClick={()=>setReviewStatus(c,"Needs Review")}><AlertTriangle size={15}/></button>}</>:<span className={`review-label rl-${c.reviewStatus.toLowerCase()}`}>{c.reviewStatus}</span>}</div></article>;})}</div></>:<DiscoveryJobsPanel jobs={jobs} creatingJobs={creatingJobs} setCreatingJobs={setCreatingJobs} onJobsCreated={handleJobsCreated} runningJobIds={runningJobIds} currentUserId={currentUserId} jobRunError={jobRunError} onRun={runJob} onPause={pauseJob}/>}
  </section>
}

function DiscoveryJobsPanel({jobs,creatingJobs,setCreatingJobs,onJobsCreated,runningJobIds,currentUserId,jobRunError,onRun,onPause}:{jobs:DiscoveryJob[];creatingJobs:boolean;setCreatingJobs:(x:boolean)=>void;onJobsCreated:(jobs:Array<{id:string;status:string}>)=>void;runningJobIds:Set<string>;currentUserId:string|null;jobRunError:string;onRun:(id:string)=>void;onPause:(id:string)=>void}){
  return <div className="jobs-layout">
    <DiscoveryJobForm creating={creatingJobs} onCreating={setCreatingJobs} onCreated={onJobsCreated}/>
    <div className="panel jobs-history full-width">
      <div className="panel-head"><div><h2>Job history</h2><p>Executed and in-progress discovery jobs from the database</p></div></div>
      {jobRunError&&<p className="evidence-status evidence-error job-run-error">{jobRunError}</p>}
      {jobs.length?jobs.map(j=>{
        const isRunning=runningJobIds.has(j.id);
        const isOwner=Boolean(currentUserId)&&j.requestedBy===currentUserId;
        const resumable=(j.status==="Pending"||j.status==="Running")&&isOwner;
        const progressPct=j.status==="Complete"?100:j.targetCandidates>0?Math.min(95,Math.round((j.recordsImported/j.targetCandidates)*100)):0;
        return <div className="job-history-row expanded" key={j.id}>
          <div className="job-history-top">
            <div><b>{j.market}</b><span>{j.requestedCategories.length?j.requestedCategories.join(", "):j.searchCategory}</span></div>
            <span className={`status ${j.status==="Complete"?"contacted":j.status==="Failed"?"new":"contacted"}`}>{j.status}</span>
            {resumable&&(isRunning?<button onClick={()=>onPause(j.id)}><Pause size={12}/>Pause</button>:<button onClick={()=>onRun(j.id)}><RotateCw size={12}/>Resume</button>)}
          </div>
          <div className="job-progress-track"><i style={{width:`${progressPct}%`}}/></div>
          <div className="job-history-counters">
            <span>{j.recordsImported}/{j.targetCandidates} candidates staged</span>
            <span>{j.candidatesDuplicateExisting} duplicates skipped</span>
            <span>{j.firmMatchesFlagged} firm matches flagged</span>
            <span>{j.queriesAttempted} pages attempted</span>
            <span>{j.actualRequests} of ~{j.estimatedRequests} requests</span>
            {j.estimatedCostUsd!==null&&<span>${j.estimatedCostUsd.toFixed(4)} estimated</span>}
          </div>
          {j.errorMessage&&<p className="job-history-error"><AlertTriangle size={12}/>{j.errorMessage}</p>}
        </div>;
      }):<p className="job-history-empty">No discovery jobs yet. Start one above.</p>}
    </div>
  </div>;
}
