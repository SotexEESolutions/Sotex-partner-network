export const MAX_ROUTE_STOPS = 5;

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
