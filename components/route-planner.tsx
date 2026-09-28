"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpRight, Building2, MapPin, Navigation, Phone, Plus, Route, Trash2 } from "lucide-react";
import { Select } from "@/components/form-controls";
import { PhoneLink } from "@/components/phone-link";
import type { AccessContext, Firm, Grade } from "@/lib/types";
import { buildGoogleMapsDirectionsUrl, buildGoogleMapsSearchUrl, formatFirmAddress, hasMappableAddress, MAX_ROUTE_STOPS } from "@/lib/routes.mjs";
import { DISCOVERY_REGIONS } from "@/lib/discovery/markets";

const gradeClass=(grade:Grade)=>`grade grade-${grade.replace("+","plus").toLowerCase()}`;

type RoutePlannerProps={firms:Firm[];query:string;access:AccessContext;choose:(firm:Firm)=>void;notify:(message:string)=>void};

export function RoutePlanner({firms,query,access,choose,notify}:RoutePlannerProps){
  const [territory,setTerritory]=useState("All territories");
  const [region,setRegion]=useState("All regions");
  const [grade,setGrade]=useState("All grades");
  const [routeIds,setRouteIds]=useState<string[]>([]);

  const visible=useMemo(()=>firms.filter(firm=>{
    const matchesQuery=`${firm.name} ${firm.addressLine1} ${firm.city} ${firm.region}`.toLowerCase().includes(query.toLowerCase());
    const matchesTerritory=territory==="All territories"||firm.territoryId===territory;
    const matchesRegion=region==="All regions"||firm.region===region;
    const matchesGrade=grade==="All grades"||firm.grade===grade;
    return matchesQuery&&matchesTerritory&&matchesRegion&&matchesGrade;
  }).sort((a,b)=>b.score-a.score),[firms,query,territory,region,grade]);

  const selected=routeIds.map(id=>firms.find(firm=>firm.id===id)).filter((firm):firm is Firm=>Boolean(firm));
  const missingAddress=visible.filter(firm=>!hasMappableAddress(firm)).length;
  const directionsUrl=buildGoogleMapsDirectionsUrl(selected);

  const addStop=(firm:Firm)=>{
    if(!hasMappableAddress(firm)){notify("Add a complete street address before routing this firm.");return;}
    if(routeIds.includes(firm.id))return;
    if(routeIds.length>=MAX_ROUTE_STOPS){notify(`Routes are limited to ${MAX_ROUTE_STOPS} stops for reliable mobile handoff.`);return;}
    setRouteIds(ids=>[...ids,firm.id]);
  };
  const removeStop=(id:string)=>setRouteIds(ids=>ids.filter(value=>value!==id));
  const moveStop=(index:number,direction:-1|1)=>setRouteIds(ids=>{
    const target=index+direction;
    if(target<0||target>=ids.length)return ids;
    const next=[...ids];
    [next[index],next[target]]=[next[target],next[index]];
    return next;
  });

  return <section className="page route-page">
    <div className="page-title compact"><div><span className="eyebrow">FIELD PROSPECTING</span><h1>Route Planner</h1><p>Select up to {MAX_ROUTE_STOPS} firms, order the stops, then continue in Google Maps.</p></div>{directionsUrl?<a className="primary route-open" href={directionsUrl} target="_blank" rel="noreferrer"><Navigation size={17}/>Open route</a>:<button className="primary" disabled><Navigation size={17}/>Open route</button>}</div>
    <div className="filterbar route-filters"><Select value={territory} onChange={setTerritory} options={[{value:"All territories",label:"All territories"},...access.territories.map(item=>({value:item.id,label:item.name}))]}/><Select value={region} onChange={setRegion} options={["All regions",...DISCOVERY_REGIONS]}/><Select value={grade} onChange={setGrade} options={["All grades","A+","A","B","C","D","NR"]}/><button onClick={()=>{setTerritory("All territories");setRegion("All regions");setGrade("All grades")}}>Clear filters</button><span>{visible.length} firms · {missingAddress} need an address</span></div>
    <div className="route-layout">
      <div className="panel route-firms"><div className="panel-head"><div><h2>Available firms</h2><p>Highest-scoring prospects appear first.</p></div></div><div className="route-firm-list">{visible.length?visible.map(firm=>{const address=formatFirmAddress(firm),mapped=hasMappableAddress(firm),added=routeIds.includes(firm.id);return <article className="route-firm" key={firm.id}><div className="route-firm-main"><div className="company-icon small-icon"><Building2 size={14}/></div><div><button className="route-firm-name" onClick={()=>choose(firm)}>{firm.name}</button><span><MapPin size={12}/>{address||`${firm.city}, ${firm.state}`}</span></div><span className={gradeClass(firm.grade)}>{firm.grade}</span></div><div className="route-firm-actions">{firm.phone?<PhoneLink phone={firm.phone}/>:<span className="route-missing"><Phone size={13}/>No phone</span>}<a href={buildGoogleMapsSearchUrl(firm)} target="_blank" rel="noreferrer"><MapPin size={13}/>Map</a><button disabled={!mapped||added||routeIds.length>=MAX_ROUTE_STOPS} title={!mapped?"A street address is required":added?"Already added to route":undefined} onClick={()=>addStop(firm)}><Plus size={13}/>{added?"Added":"Add stop"}</button></div></article>}):<div className="route-empty"><MapPin size={24}/><h3>No firms match these filters</h3><p>Clear a filter or adjust the global search.</p></div>}</div></div>
      <aside className="panel route-plan"><div className="panel-head"><div><h2>Today&apos;s route</h2><p>Starts from your current location.</p></div><span>{selected.length}/{MAX_ROUTE_STOPS}</span></div>{selected.length?<><ol className="route-stop-list">{selected.map((firm,index)=><li key={firm.id}><span className="route-stop-number">{index+1}</span><div><b>{firm.name}</b><span>{formatFirmAddress(firm)}</span></div><div className="route-stop-actions"><button aria-label={`Move ${firm.name} up`} disabled={index===0} onClick={()=>moveStop(index,-1)}><ArrowUp size={14}/></button><button aria-label={`Move ${firm.name} down`} disabled={index===selected.length-1} onClick={()=>moveStop(index,1)}><ArrowDown size={14}/></button><button aria-label={`Remove ${firm.name}`} onClick={()=>removeStop(firm.id)}><Trash2 size={14}/></button></div></li>)}</ol><div className="route-plan-footer"><p><Route size={15}/>Google Maps will calculate driving times and navigation from your current location.</p><a className="primary route-open" href={directionsUrl} target="_blank" rel="noreferrer"><Navigation size={16}/>Open in Google Maps <ArrowUpRight size={14}/></a><button onClick={()=>setRouteIds([])}>Clear route</button></div></>:<div className="route-empty"><Route size={26}/><h3>No stops selected</h3><p>Add firms from the list to build a field prospecting route.</p></div>}</aside>
    </div>
  </section>;
}
