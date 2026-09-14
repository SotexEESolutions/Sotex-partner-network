import { findAndEnrichDecisionMakers } from "@/lib/discovery/apollo";
import { mapGooglePlace, searchGooglePlaces } from "@/lib/discovery/google-places";
import type { ContactEnrichmentProvider, DiscoveryProvider, DiscoveryQuery, StandardDiscoveryResult } from "@/lib/discovery/providers";

export type ProviderCapability="Firm Discovery"|"Web Research"|"Contact Enrichment";
export type ProviderDescriptor={id:"google-places"|"firecrawl"|"apollo"|"lusha";label:string;capability:ProviderCapability;configured:boolean};

export class GooglePlacesAdapter implements DiscoveryProvider{
  readonly name="Google Places API";
  async discover(query:DiscoveryQuery):Promise<StandardDiscoveryResult[]>{
    const response=await searchGooglePlaces({query:query.query,pageSize:20});
    return(response.places??[]).filter(place=>place.id&&place.displayName?.text).map(place=>{
      const row=mapGooglePlace(place,{jobId:"adapter",market:query.market,region:query.region,category:query.category});
      return{name:row.firm_name??"",website:row.website??"",domain:"",phone:row.phone??"",address:row.address_line_1??"",city:row.city??query.city,state:row.state??query.state,zip:row.zip_code??"",region:row.region??query.region,market:row.market??query.market,type:row.possible_firm_type??query.category,source:row.source,sourceUrl:row.source_url??"",description:row.description,confidence:row.confidence==="High"?"High":row.confidence==="Low"?"Low":"Medium",contactResearchStatus:"Not Started",webResearchStatus:"Not Queued",visibility:"Private",rawData:row.raw_data};
    });
  }
}

export class ApolloAdapter implements ContactEnrichmentProvider{
  readonly name="Apollo";
  async findDecisionMakers(firm:{name:string;domain:string}){const contacts=await findAndEnrichDecisionMakers(firm.domain,3);return contacts.map(contact=>({firstName:contact.firstName??"",lastName:contact.lastName??"",title:contact.title??"",email:contact.email??undefined,sourceUrl:contact.sourceUrl??`https://${firm.domain}`}));}
}

export function providerCatalog():ProviderDescriptor[]{return[
  {id:"google-places",label:"Google Places",capability:"Firm Discovery",configured:Boolean(process.env.GOOGLE_PLACES_API_KEY)},
  {id:"firecrawl",label:"Firecrawl",capability:"Web Research",configured:Boolean(process.env.FIRECRAWL_API_KEY)},
  {id:"apollo",label:"Apollo",capability:"Contact Enrichment",configured:Boolean(process.env.APOLLO_API_KEY)},
  {id:"lusha",label:"Lusha",capability:"Contact Enrichment",configured:Boolean(process.env.LUSHA_API_KEY)},
]}
