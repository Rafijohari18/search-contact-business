import { normalizePhoneId } from "./format";
import type { VendorContact } from "./types";

const BASE = "https://maps.googleapis.com/maps/api/place";

interface GoogleGeometry {
  location: { lat: number; lng: number };
}
interface GooglePlace {
  place_id: string;
  name?: string;
  geometry?: GoogleGeometry;
  vicinity?: string;
  rating?: number;
  business_status?: string;
}
interface AddressComponent {
  long_name?: string;
  types?: string[];
}
interface PlaceDetails {
  name?: string;
  formatted_phone_number?: string;
  international_phone_number?: string;
  formatted_address?: string;
  address_components?: AddressComponent[];
  website?: string;
  url?: string;
  rating?: number;
  user_ratings_total?: number;
  business_status?: string;
  geometry?: GoogleGeometry;
}

function component(
  comps: AddressComponent[] | undefined,
  type: string,
): string | undefined {
  return comps?.find((c) => c.types?.includes(type))?.long_name;
}

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Google Places HTTP ${res.status}`);
  return res.json();
}

/** Nearby Search -> daftar place_id (1 halaman, ~20 tempat). */
async function nearbySearch(
  keyword: string,
  lat: number,
  lon: number,
  radiusMeters: number,
  key: string,
): Promise<GooglePlace[]> {
  const url =
    `${BASE}/nearbysearch/json?location=${lat},${lon}` +
    `&radius=${radiusMeters}&keyword=${encodeURIComponent(keyword)}&key=${key}`;
  const data = await fetchJson(url);
  if (data.status && data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    throw new Error(`Google NearbySearch: ${data.status} — ${data.error_message || ""}`);
  }
  return (data.results as GooglePlace[]) || [];
}

function toVendor(
  r: PlaceDetails & { place_id?: string },
  category: string | undefined,
): VendorContact | null {
  if (!r.name || !r.geometry?.location) return null;
  const phone = r.formatted_phone_number;
  const waSource = r.international_phone_number || r.formatted_phone_number;
  const whatsapp = waSource ? normalizePhoneId(waSource) : undefined;
  const city =
    component(r.address_components, "administrative_area_level_2") ||
    component(r.address_components, "locality") ||
    component(r.address_components, "administrative_area_level_3");
  return {
    id: `google-${r.place_id ?? r.name}`,
    name: r.name,
    category,
    phone,
    whatsapp,
    website: r.website,
    address: r.formatted_address,
    city,
    postcode: component(r.address_components, "postal_code"),
    lat: r.geometry.location.lat,
    lon: r.geometry.location.lng,
    rating: typeof r.rating === "number" ? r.rating : undefined,
    source: "google",
  };
}

export async function searchGooglePlaces(
  keyword: string,
  lat: number,
  lon: number,
  radiusKm: number,
  key: string,
): Promise<{ results: VendorContact[]; truncated: boolean }> {
  const radiusMeters = Math.min(Math.max(Math.round(radiusKm * 1000), 1000), 50000);
  const places = await nearbySearch(keyword, lat, lon, radiusMeters, key);

  const fields =
    "name,formatted_phone_number,international_phone_number,formatted_address,address_components,website,url,geometry,rating,user_ratings_total,business_status";

  const results: VendorContact[] = [];
  // Details di-parallel (terbatas) untuk mempercepat.
  const batch = places.slice(0, 40);
  await Promise.all(
    batch.map(async (p) => {
      try {
        const url = `${BASE}/details/json?place_id=${p.place_id}&fields=${fields}&language=id&key=${key}`;
        const data = await fetchJson(url);
        if (!data.result) return;
        const v = toVendor({ ...data.result, place_id: p.place_id }, undefined);
        if (v) {
          // Skip yang sudah tutup permanen.
          if (data.result.business_status === "CLOSED_BUSINESS") return;
          results.push(v);
        }
      } catch {
        // abaikan satu tempat gagal, lanjutkan yang lain
      }
    }),
  );

  return { results, truncated: places.length >= 20 };
}
