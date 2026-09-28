import assert from "node:assert/strict";
import test from "node:test";
import { appendRouteStop, buildGoogleMapsDirectionsUrl, buildGoogleMapsSearchUrl, candidateToRouteStop, firmToRouteStop, formatFirmAddress, hasMappableAddress, MAX_ROUTE_STOPS, parseRouteStops, serializeRouteStops } from "../lib/routes.mjs";

const firm=(id,addressLine1,city="San Antonio")=>({id,name:`Firm ${id}`,addressLine1,addressLine2:"",city,state:"TX",zipCode:"78205",googleMapsUrl:""});

test("formats and validates a firm address",()=>{
  assert.equal(formatFirmAddress(firm("1","100 Main St")),"100 Main St, San Antonio, TX, 78205");
  assert.equal(hasMappableAddress(firm("1","100 Main St")),true);
  assert.equal(hasMappableAddress(firm("2","")),false);
});

test("builds an ordered Google Maps route from the current location",()=>{
  const url=new URL(buildGoogleMapsDirectionsUrl([firm("1","100 Main St"),firm("2","200 Oak St"),firm("3","300 Pine St")]));
  assert.equal(url.hostname,"www.google.com");
  assert.equal(url.pathname,"/maps/dir/");
  assert.equal(url.searchParams.get("destination"),"300 Pine St, San Antonio, TX, 78205");
  assert.equal(url.searchParams.get("waypoints"),"100 Main St, San Antonio, TX, 78205|200 Oak St, San Antonio, TX, 78205");
  assert.equal(url.searchParams.get("origin"),null);
});

test("caps routes and respects an existing Maps URL",()=>{
  const firms=Array.from({length:MAX_ROUTE_STOPS+2},(_,index)=>firm(String(index),`${index} Main St`));
  const url=new URL(buildGoogleMapsDirectionsUrl(firms));
  assert.equal(url.searchParams.get("destination"),`${MAX_ROUTE_STOPS-1} Main St, San Antonio, TX, 78205`);
  const mapped={...firm("mapped","1 Main St"),googleMapsUrl:"https://maps.google.com/example"};
  assert.equal(buildGoogleMapsSearchUrl(mapped),mapped.googleMapsUrl);
});

test("converts an unapproved Discovery candidate into a temporary route stop",()=>{
  const stop=candidateToRouteStop({id:"candidate-1",name:"Prospect CPA",address:"42 Commerce St",city:"Austin",state:"TX",zip:"78701",phone:"512-555-0100"});
  assert.equal(stop.id,"candidate:candidate-1");
  assert.equal(stop.source,"Discovery");
  assert.equal(formatFirmAddress(stop),"42 Commerce St, Austin, TX, 78701");
});

test("route drafts reject missing, duplicate, and over-limit stops",()=>{
  const first=firmToRouteStop(firm("1","100 Main St"));
  assert.equal(appendRouteStop([],first).status,"added");
  assert.equal(appendRouteStop([first],first).status,"duplicate");
  const full=Array.from({length:MAX_ROUTE_STOPS},(_,index)=>firmToRouteStop(firm(String(index),`${index} Main St`)));
  assert.equal(appendRouteStop(full,firmToRouteStop(firm("extra","99 Main St"))).status,"full");
  assert.equal(appendRouteStop([],firmToRouteStop(firm("missing",""))).status,"missing-address");
});

test("route drafts round-trip safely through browser storage",()=>{
  const stops=[firmToRouteStop(firm("1","100 Main St"))];
  assert.deepEqual(parseRouteStops(serializeRouteStops(stops)),stops);
  assert.deepEqual(parseRouteStops("not-json"),[]);
  assert.deepEqual(parseRouteStops(JSON.stringify({id:"wrong-shape"})),[]);
});
