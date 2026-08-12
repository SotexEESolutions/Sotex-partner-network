import type { FirmCandidate, ResearchEvidence } from "@/lib/types";

export type DiscoveryQuery = { city:string; state:string; region:string; market:string; category:string; query:string };
export type StandardDiscoveryResult = Omit<FirmCandidate,"id"|"jobId"|"duplicateStatus"|"reviewStatus"|"createdAt"> & { rawData?:Record<string,unknown> };
export interface DiscoveryProvider { readonly name:string; discover(query:DiscoveryQuery):Promise<StandardDiscoveryResult[]>; }
export interface ResearchProvider { readonly name:string; research(firm:{name:string;website:string}):Promise<ResearchEvidence[]>; }
export interface ContactEnrichmentProvider { readonly name:string; findDecisionMakers(firm:{name:string;domain:string}):Promise<Array<{firstName:string;lastName:string;title:string;email?:string;sourceUrl:string}>>; }

export class ManualDiscoveryProvider implements DiscoveryProvider {
  readonly name="Manual research";
  async discover():Promise<StandardDiscoveryResult[]>{ return []; }
}

export const providerRegistry:{discovery:DiscoveryProvider[];research:ResearchProvider[];contacts:ContactEnrichmentProvider[]}={discovery:[new ManualDiscoveryProvider()],research:[],contacts:[]};
