"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpRight, Building2, MapPin, Navigation, Phone, Plus, Route, Trash2 } from "lucide-react";
import { Select } from "@/components/form-controls";
import { PhoneLink } from "@/components/phone-link";
import type { AccessContext, Firm, Grade } from "@/lib/types";
import { appendRouteStop, buildGoogleMapsDirectionsUrl, buildGoogleMapsSearchUrl, firmToRouteStop, formatFirmAddress, hasMappableAddress, MAX_ROUTE_STOPS, parseRouteStops, ROUTE_STORAGE_KEY, serializeRouteStops, type RouteStop } from "@/lib/routes.mjs";
import { DISCOVERY_REGIONS } from "@/lib/discovery/markets";

const gradeClass=(grade:Grade)=>`grade grade-${grade.replace("+","plus").toLowerCase()}`;

type RoutePlannerProps={firms:Firm[];query:string;access:AccessContext;choose:(firm:Firm)=>void;notify:(message:string)=>void};

export function RoutePlanner({firms,query,access,choose,notify}:RoutePlannerProps){
  const [territory,setTerritory]=useState("All territories");
  const [region,setRegion]=useState("All regions");
  const [grade,setGrade]=useState("All grades");
  const [routeStops,setRouteStops]=useState<RouteStop[]>([]);

  useEffect(()=>{
    const frame=window.requestAnimationFrame(()=>setRouteStops(parseRouteStops(window.sessionStorage.getItem(ROUTE_STORAGE_KEY))));
    return ()=>window.cancelAnimationFrame(frame);
  },[]);

  const visible=useMemo(()=>firms.filter(firm=>{
    const matchesQuery=`${firm.name} ${firm.addressLine1} ${firm.city} ${firm.region}`.toLowerCase().includes(query.toLowerCase());
    const matchesTerritory=territory==="All territories"||firm.territoryId===territory;
    const matchesRegion=region==="All regions"||firm.region===region;
    const matchesGrade=grade==="All grades"||firm.grade===grade;
    return matchesQuery&&matchesTerritory&&matchesRegion&&matchesGrade;
  }).sort((a,b)=>b.score-a.score),[firms,query,territory,region,grade]);

  const missingAddress=visible.filter(firm=>!hasMappableAddress(firm)).length;
  const directionsUrl=buildGoogleMapsDirectionsUrl(routeStops);

  const saveRoute=(next:RouteStop[])=>{
    setRouteStops(next);
    window.sessionStorage.setItem(ROUTE_STORAGE_KEY,serializeRouteStops(next));
  };

  const addStop=(firm:Firm)=>{
    const result=appendRouteStop(routeStops,firmToRouteStop(firm));
    if(result.status==="missing-address"){notify("Add a complete street address before routing this firm.");return;}
    if(result.status==="duplicate"){notify(`${firm.name} is already on this route.`);return;}
    if(result.status==="full"){notify(`Routes are limited to ${MAX_ROUTE_STOPS} stops for reliable mobile handoff.`);return;}
    saveRoute(result.stops);
  };
  const removeStop=(id:string)=>saveRoute(routeStops.filter(value=>value.id!==id));
  const moveStop=(index:number,direction:-1|1)=>{
    const target=index+direction;
    if(target<0||target>=routeStops.length)return;
    const next=[...routeStops];
    [next[index],next[target]]=[next[target],next[index]];
    saveRoute(next);
  };

  return <section className="page route-page">
    <div className="page-title compact"><div><span className="eyebrow">FIELD PROSPECTING</span><h1>Route Planner</h1><p>Select up to {MAX_ROUTE_STOPS} firms or Discovery candidates, order the stops, then continue in Google Maps.</p></div>{directionsUrl?<a className="primary route-open" href={directionsUrl} target="_blank" rel="noreferrer"><Navigation size={17}/>Open route</a>:<button className="primary" disabled><Navigation size={17}/>Open route</button>}</div>
    <div className="filterbar route-filters"><Select value={territory} onChange={setTerritory} options={[{value:"All territories",label:"All territories"},...access.territories.map(item=>({value:item.id,label:item.name}))]}/><Select value={region} onChange={setRegion} options={["All regions",...DISCOVERY_REGIONS]}/><Select value={grade} onChange={setGrade} options={["All grades","A+","A","B","C","D","NR"]}/><button onClick={()=>{setTerritory("All territories");setRegion("All regions");setGrade("All grades")}}>Clear filters</button><span>{visible.length} firms · {missingAddress} need an address</span></div>
    <div className="route-layout">
      <div className="panel route-firms"><div className="panel-head"><div><h2>Available firms</h2><p>Highest-scoring prospects appear first.</p></div></div><div className="route-firm-list">{visible.length?visible.map(firm=>{const address=formatFirmAddress(firm),mapped=hasMappableAddress(firm),stopId=`firm:${firm.id}`,added=routeStops.some(stop=>stop.id===stopId);return <article className="route-firm" key={firm.id}><div className="route-firm-main"><div className="company-icon small-icon"><Building2 size={14}/></div><div><button className="route-firm-name" onClick={()=>choose(firm)}>{firm.name}</button><span><MapPin size={12}/>{address||`${firm.city}, ${firm.state}`}</span></div><span className={gradeClass(firm.grade)}>{firm.grade}</span></div><div className="route-firm-actions">{firm.phone?<PhoneLink phone={firm.phone}/>:<span className="route-missing"><Phone size={13}/>No phone</span>}<a href={buildGoogleMapsSearchUrl(firm)} target="_blank" rel="noreferrer"><MapPin size={13}/>Map</a><button disabled={!mapped||added||routeStops.length>=MAX_ROUTE_STOPS} title={!mapped?"A street address is required":added?"Already added to route":undefined} onClick={()=>addStop(firm)}><Plus size={13}/>{added?"Added":"Add stop"}</button></div></article>}):<div className="route-empty"><MapPin size={24}/><h3>No firms match these filters</h3><p>Clear a filter or adjust the global search.</p></div>}</div></div>
      <aside className="panel route-plan"><div className="panel-head"><div><h2>Today&apos;s route</h2><p>Starts from your current location.</p></div><span>{routeStops.length}/{MAX_ROUTE_STOPS}</span></div>{routeStops.length?<><ol className="route-stop-list">{routeStops.map((stop,index)=><li key={stop.id}><span className="route-stop-number">{index+1}</span><div><b>{stop.name}</b><span>{formatFirmAddress(stop)}</span>{stop.source==="Discovery"&&<em>Discovery candidate</em>}</div><div className="route-stop-actions"><button aria-label={`Move ${stop.name} up`} disabled={index===0} onClick={()=>moveStop(index,-1)}><ArrowUp size={14}/></button><button aria-label={`Move ${stop.name} down`} disabled={index===routeStops.length-1} onClick={()=>moveStop(index,1)}><ArrowDown size={14}/></button><button aria-label={`Remove ${stop.name}`} onClick={()=>removeStop(stop.id)}><Trash2 size={14}/></button></div></li>)}</ol><div className="route-plan-footer"><p><Route size={15}/>Google Maps will calculate driving times and navigation from your current location.</p><a className="primary route-open" href={directionsUrl} target="_blank" rel="noreferrer"><Navigation size={16}/>Open in Google Maps <ArrowUpRight size={14}/></a><button onClick={()=>saveRoute([])}>Clear route</button></div></>:<div className="route-empty"><Route size={26}/><h3>No stops selected</h3><p>Add firms or Discovery candidates to build a field prospecting route.</p></div>}</aside>
    </div>
  </section>;
}
