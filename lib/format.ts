import type { VendorContact } from "./types";

/** Escape karakter khusus regex agar aman dipakai di name~"..." Overpass. */
export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Jarak haversine dalam kilometer antara dua titik. */
export function haversineKm(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number,
): number {
  const R = 6371;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Normalisasi nomor HP Indonesia ke format internasional tanpa "+" atau "0".
 *  0812...  -> 62812...
 *  +62812.. -> 62812...
 *  812...   -> 62812...
 */
export function normalizePhoneId(raw: string): string {
  let digits = (raw || "").replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  if (digits.startsWith("62")) return "62" + digits.slice(2);
  if (digits.startsWith("0")) return "62" + digits.slice(1);
  if (digits.startsWith("8")) return "62" + digits; // nomor lokal tanpa 0
  return digits;
}

/** Ambil nomor pertama bila ada beberapa (dipisah ; atau ,). */
export function firstNumber(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const parts = raw.split(/[;,]/).map((s) => s.trim()).filter(Boolean);
  return parts[0];
}

/** Rakit alamat dari tag addr:* OpenStreetMap. */
export function buildAddressFromTags(
  t: Record<string, string>,
): { address?: string; city?: string; postcode?: string } {
  const out: { address?: string; city?: string; postcode?: string } = {};
  const parts: string[] = [];
  const hn = t["addr:housenumber"] || t["addr:block_number"];
  const street = t["addr:street"] || t["addr:housename"];
  if (hn && street) parts.push(`${hn} ${street}`);
  else if (street) parts.push(street);
  else if (hn) parts.push(hn);

  const rt = t["addr:neighbourhood"] || t["addr:hamlet"] || t["addr:suburb"];
  if (rt) parts.push(rt);

  const city =
    t["addr:city"] || t["addr:town"] || t["addr:village"] || t["addr:county"] || t["addr:regency"];
  if (city) {
    parts.push(city);
    out.city = city;
  }

  const prov = t["addr:state"] || t["addr:province"];
  if (prov) parts.push(prov);

  const pc = t["addr:postcode"];
  if (pc) {
    parts.push(pc);
    out.postcode = pc;
  }

  if (parts.length) out.address = parts.join(", ");
  return out;
}

/** Bangun string CSV (RFC4180) dari daftar vendor. */
export function toCSV(rows: VendorContact[]): string {
  const headers = [
    "Nama",
    "Kategori",
    "Telepon",
    "WhatsApp",
    "Email",
    "Website",
    "Alamat",
    "Kota",
    "Kode Pos",
    "Jarak (km)",
    "Latitude",
    "Longitude",
    "Sumber",
  ];
  const esc = (v: unknown): string => {
    const s = v === undefined || v === null ? "" : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [headers.map(esc).join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.name,
        r.category,
        r.phone,
        r.whatsapp,
        r.email,
        r.website,
        r.address,
        r.city,
        r.postcode,
        r.distanceKm != null ? r.distanceKm.toFixed(2) : "",
        r.lat,
        r.lon,
        r.source,
      ]
        .map(esc)
        .join(","),
    );
  }
  // Atribusi wajib lisensi ODbL untuk data OpenStreetMap.
  const hasOsm = rows.some((r) => r.source === "osm");
  if (hasOsm) {
    lines.push("");
    lines.push(
      esc("Sumber: OpenStreetMap (https://www.openstreetmap.org) — data berlisensi ODbL"),
    );
  }
  return lines.join("\n");
}
