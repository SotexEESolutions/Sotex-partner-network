import assert from "node:assert/strict";
import test from "node:test";
import { buildGoogleMapsDirectionsUrl, buildGoogleMapsSearchUrl, formatFirmAddress, hasMappableAddress, MAX_ROUTE_STOPS } from "../lib/routes.mjs";

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
