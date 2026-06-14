import { haversineKm } from "./format";
import { searchGooglePlaces } from "./googlePlaces";
import { searchOverpass } from "./overpass";
import type { LatLng, SearchParams, VendorContact, VendorSource } from "./types";

export function googleKeyAvailable(): boolean {
  return !!process.env.GOOGLE_MAPS_API_KEY;
}

/** Tentukan sumber aktual dari pilihan user (osm / google / auto). */
export function resolveSource(choice: SearchParams["source"]): VendorSource {
  if (choice === "osm") return "osm";
  if (choice === "google") return "google";
  return googleKeyAvailable() ? "google" : "osm";
}

/**
 * Jalankan pencarian ke sumber terpilih, lalu:
 *  - hitung jarak dari pusat
 *  - dedup (by id, lalu by nomor HP / nama)
 *  - filter dalam radius
 *  - sort (terdekat / nama)
 *  - cap ~200 hasil
 */
export async function runSearch(
  params: SearchParams,
  center: LatLng,
): Promise<{ results: VendorContact[]; source: VendorSource; note?: string }> {
  const source = resolveSource(params.source);

  let raw: VendorContact[];
  let note: string | undefined;

  if (source === "google") {
    if (!googleKeyAvailable()) {
      throw new Error(
        "Sumber Google dipilih tapi GOOGLE_MAPS_API_KEY belum diset di server.",
      );
    }
    const r = await searchGooglePlaces(
      params.query,
      center.lat,
      center.lon,
      params.radiusKm,
      process.env.GOOGLE_MAPS_API_KEY as string,
    );
    raw = r.results;
    if (r.truncated) note = "Hasil Google dibatasi ~40 tempat teratas per pencarian.";
  } else {
    const r = await searchOverpass(params.query, center.lat, center.lon, params.radiusKm);
    raw = r.results;
    if (r.truncated)
      note =
        "Hasil OSM dibatasi 250 teratas — coba kecilkan radius atau perjelas kata kunci agar lebih fokus.";
  }

  // Hitung jarak dari pusat.
  const withDist: VendorContact[] = raw.map((v) => ({
    ...v,
    distanceKm: haversineKm(center.lat, center.lon, v.lat, v.lon),
  }));

  // Dedup by id, lalu by nomor HP / nama.
  const seen = new Set<string>();
  const dedup: VendorContact[] = [];
  for (const v of withDist) {
    if (seen.has(v.id)) continue;
    const keyPhone = v.whatsapp || v.phone;
    const key = keyPhone ? `p:${keyPhone}` : `n:${v.name.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(v.id);
    seen.add(key);
    dedup.push(v);
  }

  // Filter dalam radius (pengaman; "around" Overpass sudah membatasi).
  let inRange = dedup.filter((v) => (v.distanceKm ?? 0) <= params.radiusKm + 0.1);

  // Opsional: hanya yang punya kontak (HP/WhatsApp).
  if (params.onlyWithContact) {
    inRange = inRange.filter((v) => !!(v.phone || v.whatsapp));
  }

  // Sort.
  const sorted = inRange.sort((a, b) =>
    params.sort === "name"
      ? a.name.localeCompare(b.name, "id")
      : (a.distanceKm ?? 0) - (b.distanceKm ?? 0),
  );

  // Cap 200.
  const MAX = 200;
  const capped = sorted.slice(0, MAX);
  if (sorted.length > MAX) {
    note = (note ? note + " " : "") + `Dibatasi 200 dari ${sorted.length} hasil.`;
  }

  return { results: capped, source, note };
}
