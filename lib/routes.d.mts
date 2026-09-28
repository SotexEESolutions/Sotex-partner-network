import type { Firm, FirmCandidate } from "./types";

export type RouteStop = {
  id: string;
  recordId: string;
  source: "Firm" | "Discovery";
  name: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  zipCode: string;
  googleMapsUrl: string;
  phone: string;
};

export type AppendRouteStopResult = {stops: RouteStop[]; status: "added" | "duplicate" | "full" | "missing-address"};

export const MAX_ROUTE_STOPS: number;
export const ROUTE_STORAGE_KEY: string;
export function firmToRouteStop(firm: Firm): RouteStop;
export function candidateToRouteStop(candidate: FirmCandidate): RouteStop;
export function parseRouteStops(raw: string | null): RouteStop[];
export function serializeRouteStops(stops: RouteStop[]): string;
export function appendRouteStop(stops: RouteStop[], stop: RouteStop): AppendRouteStopResult;
export function formatFirmAddress(firm: Firm | RouteStop): string;
export function hasMappableAddress(firm: Firm | RouteStop): boolean;
export function buildGoogleMapsSearchUrl(firm: Firm | RouteStop): string;
export function buildGoogleMapsDirectionsUrl(firms: Array<Firm | RouteStop>): string;
