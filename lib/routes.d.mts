import type { Firm } from "./types";

export const MAX_ROUTE_STOPS: number;
export function formatFirmAddress(firm: Firm): string;
export function hasMappableAddress(firm: Firm): boolean;
export function buildGoogleMapsSearchUrl(firm: Firm): string;
export function buildGoogleMapsDirectionsUrl(firms: Firm[]): string;
