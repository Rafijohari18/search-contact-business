import { NextResponse, type NextRequest } from "next/server";
import { geocode } from "@/lib/geocode";
import { runSearch } from "@/lib/sources";
import type { SearchParams } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

interface Body {
  query?: string;
  location?: string;
  lat?: number;
  lon?: number;
  radiusKm?: number;
  sort?: "nearest" | "name";
  source?: "osm" | "google" | "auto";
  onlyWithContact?: boolean;
}

/** GET /api/search -> konfigurasi (apakah Google Places tersedia). */
export async function GET() {
  return NextResponse.json({
    googleAvailable: !!process.env.GOOGLE_MAPS_API_KEY,
  });
}

/** POST /api/search -> cari vendor + kontak. */
export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }

  const query = (body.query || "").trim();
  if (!query) {
    return NextResponse.json({ error: "Kata kunci wajib diisi." }, { status: 400 });
  }

  const radiusKm = clamp(Number(body.radiusKm) || 15, 1, 100);
  const sort = body.sort === "name" ? "name" : "nearest";
  const source: SearchParams["source"] =
    body.source === "google" || body.source === "osm" || body.source === "auto"
      ? body.source
      : "auto";

  // Tentukan titik pusat pencarian.
  let center: { lat: number; lon: number; label?: string } | null = null;
  if (typeof body.lat === "number" && typeof body.lon === "number" && isFinite(body.lat) && isFinite(body.lon)) {
    center = { lat: body.lat, lon: body.lon };
  } else if (body.location && body.location.trim()) {
    try {
      center = await geocode(body.location.trim());
    } catch {
      center = null;
    }
    if (!center) {
      return NextResponse.json(
        {
          error: `Lokasi "${body.location}" tidak ditemukan. Coba nama kota/kabupaten yang lebih jelas (mis. "Jakarta", "Bandung, Jawa Barat").`,
        },
        { status: 400 },
      );
    }
  } else {
    return NextResponse.json(
      {
        error:
          'Isi lokasi (kota) atau klik "Gunakan lokasi saya" agar pencarian tahu area yang dicari.',
      },
      { status: 400 },
    );
  }

  const params: SearchParams = {
    query,
    radiusKm,
    sort,
    source,
    location: body.location,
    onlyWithContact: !!body.onlyWithContact,
  };

  try {
    const { results, source: usedSource, note } = await runSearch(params, center);
    let finalNote = note;
    if (results.length === 0 && usedSource === "osm") {
      finalNote =
        (finalNote ? finalNote + " " : "") +
        "Belum ada hasil dari OpenStreetMap untuk area ini. Coba kata kunci lain (mis. 'wedding', 'WO') atau aktifkan Google Places dengan mengisi GOOGLE_MAPS_API_KEY untuk data vendor yang lebih lengkap.";
    }
    return NextResponse.json({
      results,
      center,
      count: results.length,
      source: usedSource,
      note: finalNote,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Gagal mencari vendor.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
