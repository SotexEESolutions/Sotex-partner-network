export const DISCOVERY_CATEGORIES = ["CPA firm","accounting firm","bookkeeper","tax preparation service","enrolled agent","small business accountant","QuickBooks ProAdvisor","outsourced accounting"] as const;
export type DiscoveryCategory = (typeof DISCOVERY_CATEGORIES)[number];

export const DISCOVERY_MARKETS = [
  { key:"san-antonio", label:"San Antonio", city:"San Antonio", anchors:["San Antonio"], region:"San Antonio", target:30 },
  { key:"new-braunfels", label:"New Braunfels", city:"New Braunfels", anchors:["New Braunfels"], region:"Hill Country", target:20 },
  { key:"corpus-christi", label:"Corpus Christi / Coastal Bend", city:"Corpus Christi", anchors:["Corpus Christi"], region:"Coastal Bend", target:25 },
  { key:"laredo", label:"Laredo", city:"Laredo", anchors:["Laredo"], region:"Laredo", target:20 },
  { key:"rio-grande-valley", label:"Rio Grande Valley", city:"McAllen", anchors:["McAllen"], region:"Rio Grande Valley", target:30 },
  { key:"victoria", label:"Victoria / Crossroads", city:"Victoria", anchors:["Victoria"], region:"Crossroads", target:20 },
  { key:"west-texas", label:"West Texas", city:"Midland", anchors:["Midland","Odessa","Abilene","San Angelo","Lubbock"], region:"West Texas", target:30 },
  { key:"north-texas", label:"North Texas / Dallas–Fort Worth", city:"Dallas", anchors:["Dallas","Fort Worth","Arlington","Plano","Frisco"], region:"North Texas", target:30 },
  { key:"houston-gulf-coast", label:"Houston / Gulf Coast", city:"Houston", anchors:["Houston","Sugar Land","The Woodlands","Katy","Pearland"], region:"Gulf Coast", target:30 },
  { key:"el-paso", label:"El Paso / Far West Texas", city:"El Paso", anchors:["El Paso"], region:"Far West Texas", target:20 },
] as const;
export const DISCOVERY_REGIONS = [...new Set(DISCOVERY_MARKETS.map((market)=>market.region))];
export function getDiscoveryMarket(key:string){return DISCOVERY_MARKETS.find((market)=>market.key===key);}

export function estimateDiscoveryRequests(marketKeys:string[],categoryCount:number){
  return marketKeys.reduce((total,key)=>total+(getDiscoveryMarket(key)?.anchors.length??0)*categoryCount,0);
}
