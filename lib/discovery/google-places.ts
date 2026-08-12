const GOOGLE_PLACES_URL="https://places.googleapis.com/v1/places:searchText";
const FIELD_MASK=["places.id","places.displayName","places.addressComponents","places.formattedAddress","places.websiteUri","places.nationalPhoneNumber","places.googleMapsUri","places.primaryType","nextPageToken"].join(",");
type AddressComponent={longText?:string;shortText?:string;types?:string[]};
export type GooglePlace={id?:string;displayName?:{text?:string};addressComponents?:AddressComponent[];formattedAddress?:string;websiteUri?:string;nationalPhoneNumber?:string;googleMapsUri?:string;primaryType?:string};
type GooglePlacesResponse={places?:GooglePlace[];nextPageToken?:string};
function component(place:GooglePlace,type:string,short=false){const match=place.addressComponents?.find((item)=>item.types?.includes(type));return(short?match?.shortText:match?.longText)??"";}

export function mapGooglePlace(place:GooglePlace,context:{jobId:string;market:string;region:string;category:string}){
  const street=[component(place,"street_number"),component(place,"route")].filter(Boolean).join(" ");
  return {discovery_job_id:context.jobId,source_record_id:place.id,firm_name:place.displayName?.text,website:place.websiteUri??null,phone:place.nationalPhoneNumber??null,address_line_1:street||place.formattedAddress||null,city:component(place,"locality")||component(place,"postal_town")||context.market,state:component(place,"administrative_area_level_1",true)||"TX",zip_code:component(place,"postal_code")||null,region:context.region,market:context.market,possible_firm_type:context.category,source:"Google Places API",source_url:place.googleMapsUri??null,description:`${context.category} discovered via Google Places in ${context.market}.`,confidence:"Medium",raw_data:{placeId:place.id,displayName:place.displayName?.text,formattedAddress:place.formattedAddress,websiteUri:place.websiteUri,nationalPhoneNumber:place.nationalPhoneNumber,googleMapsUri:place.googleMapsUri,primaryType:place.primaryType}};
}

export async function searchGooglePlaces(input:{query:string;pageToken?:string|null;pageSize?:number}):Promise<GooglePlacesResponse>{
  const apiKey=process.env.GOOGLE_PLACES_API_KEY;
  if(!apiKey)throw new Error("Google Places is not configured.");
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),10_000);
  try{const response=await fetch(GOOGLE_PLACES_URL,{method:"POST",headers:{"Content-Type":"application/json","X-Goog-Api-Key":apiKey,"X-Goog-FieldMask":FIELD_MASK},body:JSON.stringify({textQuery:input.query,pageSize:Math.min(input.pageSize??20,20),...(input.pageToken?{pageToken:input.pageToken}:{})}),signal:controller.signal,cache:"no-store"});
    if(!response.ok)throw new Error(`Google Places request failed (${response.status}).`);return await response.json() as GooglePlacesResponse;
  }finally{clearTimeout(timeout);}
}
