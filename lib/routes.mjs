export const MAX_ROUTE_STOPS = 5;
export const ROUTE_STORAGE_KEY = "texas-accounting-partners:route-stops";

export function firmToRouteStop(firm) {
  return {
    id: `firm:${firm.id}`,
    recordId: firm.id,
    source: "Firm",
    name: firm.name,
    addressLine1: firm.addressLine1 ?? "",
    addressLine2: firm.addressLine2 ?? "",
    city: firm.city ?? "",
    state: firm.state ?? "",
    zipCode: firm.zipCode ?? "",
    googleMapsUrl: firm.googleMapsUrl ?? "",
    phone: firm.phone ?? "",
  };
}

export function candidateToRouteStop(candidate) {
  return {
    id: `candidate:${candidate.id}`,
    recordId: candidate.id,
    source: "Discovery",
    name: candidate.name,
    addressLine1: candidate.address ?? "",
    addressLine2: "",
    city: candidate.city ?? "",
    state: candidate.state ?? "",
    zipCode: candidate.zip ?? "",
    googleMapsUrl: "",
    phone: candidate.phone ?? "",
  };
}

export function parseRouteStops(raw) {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value.filter((stop) => stop && typeof stop.id === "string" && typeof stop.name === "string" && (stop.source === "Firm" || stop.source === "Discovery")).slice(0, MAX_ROUTE_STOPS);
  } catch {
    return [];
  }
}

export function serializeRouteStops(stops) {
  return JSON.stringify(stops.slice(0, MAX_ROUTE_STOPS));
}

export function appendRouteStop(stops, stop) {
  if (!hasMappableAddress(stop)) return { stops, status: "missing-address" };
  if (stops.some((item) => item.id === stop.id)) return { stops, status: "duplicate" };
  if (stops.length >= MAX_ROUTE_STOPS) return { stops, status: "full" };
  return { stops: [...stops, stop], status: "added" };
}

export function formatFirmAddress(firm) {
  return [firm.addressLine1, firm.addressLine2, firm.city, firm.state, firm.zipCode]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join(", ");
}

export function hasMappableAddress(firm) {
  return Boolean(String(firm.addressLine1 ?? "").trim() && String(firm.city ?? "").trim());
}

export function buildGoogleMapsSearchUrl(firm) {
  if (firm.googleMapsUrl) return firm.googleMapsUrl;
  const url = new URL("https://www.google.com/maps/search/");
  url.searchParams.set("api", "1");
  url.searchParams.set("query", formatFirmAddress(firm) || firm.name);
  return url.toString();
}

export function buildGoogleMapsDirectionsUrl(firms) {
  const stops = firms.filter(hasMappableAddress).slice(0, MAX_ROUTE_STOPS);
  if (!stops.length) return "";

  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");
  url.searchParams.set("destination", formatFirmAddress(stops.at(-1)));
  url.searchParams.set("travelmode", "driving");
  url.searchParams.set("dir_action", "navigate");
  if (stops.length > 1) {
    url.searchParams.set("waypoints", stops.slice(0, -1).map(formatFirmAddress).join("|"));
  }
  return url.toString();
}
