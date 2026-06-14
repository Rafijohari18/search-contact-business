import type { LatLng } from "./types";

/**
 * Geocode alamat/kota bebas teks ke lat/lon memakai Nominatim (OpenStreetMap).
 * Kebijakan pakai Nominatim mewajibkan header User-Agent yang jelas.
 */
export async function geocode(query: string): Promise<LatLng | null> {
  const url =
    "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=id&q=" +
    encodeURIComponent(query);
  const res = await fetch(url, {
    headers: {
      "User-Agent": "tool-contact-bisnis/1.0 (https://github.com/local)",
      Accept: "application/json",
    },
    // hasil cache 24 jam di server (mengurangi beban Nominatim sesuai kebijakan)
    next: { revalidate: 86400 },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as Array<{
    lat: string;
    lon: string;
    display_name: string;
  }>;
  if (!Array.isArray(data) || data.length === 0) return null;
  return {
    lat: parseFloat(data[0].lat),
    lon: parseFloat(data[0].lon),
    label: data[0].display_name,
  };
}
