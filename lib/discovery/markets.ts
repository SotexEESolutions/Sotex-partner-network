export const DISCOVERY_CATEGORIES = ["CPA firm","accounting firm","bookkeeper","tax preparation service","enrolled agent","small business accountant","QuickBooks ProAdvisor","outsourced accounting"] as const;
export type DiscoveryCategory = (typeof DISCOVERY_CATEGORIES)[number];

export const DISCOVERY_MARKETS = [
  { key:"san-antonio", label:"San Antonio", city:"San Antonio", region:"San Antonio", target:30 },
  { key:"new-braunfels", label:"New Braunfels", city:"New Braunfels", region:"Hill Country", target:20 },
  { key:"corpus-christi", label:"Corpus Christi / Coastal Bend", city:"Corpus Christi", region:"Coastal Bend", target:25 },
  { key:"laredo", label:"Laredo", city:"Laredo", region:"Laredo", target:20 },
  { key:"rio-grande-valley", label:"Rio Grande Valley", city:"McAllen", region:"Rio Grande Valley", target:30 },
  { key:"victoria", label:"Victoria / Crossroads", city:"Victoria", region:"Crossroads", target:20 },
] as const;
export function getDiscoveryMarket(key:string){return DISCOVERY_MARKETS.find((market)=>market.key===key);}
