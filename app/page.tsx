"use client";

import { useEffect, useState } from "react";
import { toCSV } from "@/lib/format";
import type {
  SearchResponse,
  SortMode,
  SourceChoice,
  VendorContact,
} from "@/lib/types";

const EXAMPLES = [
  "vendor WO",
  "wedding organizer",
  "catering",
  "toko bunga",
  "MUA makeup",
  "gedung / venue",
  "toko kue",
];

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "vendor";
}

export default function Page() {
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [radiusKm, setRadiusKm] = useState(15);
  const [sort, setSort] = useState<SortMode>("nearest");
  const [source, setSource] = useState<SourceChoice>("auto");
  const [onlyWithContact, setOnlyWithContact] = useState(false);
  const [googleAvailable, setGoogleAvailable] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SearchResponse | null>(null);

  useEffect(() => {
    fetch("/api/search")
      .then((r) => r.json())
      .then((d) => setGoogleAvailable(!!d.googleAvailable))
      .catch(() => {});
  }, []);

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError("Browser ini tidak mendukung geolokasi. Ketik kota saja.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setLocation("");
        setLocating(false);
        setError(null);
      },
      (err) => {
        setError("Gagal mengambil lokasi: " + err.message);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!query.trim()) {
      setError("Isi kata kunci dulu (mis. 'vendor WO').");
      return;
    }
    if (!coords && !location.trim()) {
      setError("Isi lokasi (kota) atau klik 'Gunakan lokasi saya'.");
      return;
    }
    setLoading(true);
    setData(null);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: query.trim(),
          location: location.trim() || undefined,
          lat: coords?.lat,
          lon: coords?.lon,
          radiusKm,
          sort,
          source,
          onlyWithContact,
        }),
      });
      const json = await res.json();
      if (!res.ok) setError(json.error || "Gagal mencari vendor.");
      else setData(json as SearchResponse);
    } catch {
      setError("Gagal terhubung ke server. Pastikan app berjalan.");
    } finally {
      setLoading(false);
    }
  }

  function downloadCSV() {
    if (!data?.results.length) return;
    const csv = toCSV(data.results);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug(query)}-${data.results.length}-vendor.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="mx-auto max-w-5xl px-4 pb-20 pt-8">
      {/* Header */}
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
          🔎 Cari Vendor Bisnis
        </h1>
        <p className="mt-1 text-sm text-slate-600 sm:text-base">
          Cari vendor (WO, catering, MUA, venue, toko bunga, dll) lengkap dengan{" "}
          <strong>nama, no HP, WhatsApp &amp; alamat</strong> di sekitar lokasi
          Anda. Hasil bisa di-export ke CSV.
        </p>
      </header>

      {/* Form */}
      <form
        onSubmit={onSubmit}
        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
      >
        <div className="grid gap-4">
          {/* Kata kunci */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Kata kunci vendor
            </label>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="mis. vendor WO, wedding organizer, catering..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => setQuery(ex)}
                  className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>

          {/* Lokasi */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Lokasi / Kota
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => {
                  setLocation(e.target.value);
                  if (e.target.value) setCoords(null);
                }}
                placeholder="mis. Jakarta, Bandung, Surabaya..."
                disabled={!!coords}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-100"
              />
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={useMyLocation}
                disabled={locating}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 sm:w-auto"
              >
                📍 {coords ? "Lokasi aktif ✓" : locating ? "Mengambil..." : "Gunakan lokasi saya"}
              </button>
            </div>
          </div>

          {/* Radius + sort + source */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Radius: <span className="font-semibold text-brand-700">{radiusKm} km</span>
              </label>
              <input
                type="range"
                min={1}
                max={50}
                value={radiusKm}
                onChange={(e) => setRadiusKm(Number(e.target.value))}
                className="w-full accent-brand-600"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Urutkan</label>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortMode)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
              >
                <option value="nearest">Terdekat dulu</option>
                <option value="name">Nama (A-Z)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Sumber data
              </label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value as SourceChoice)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
              >
                <option value="auto">
                  Otomatis {googleAvailable ? "(Google)" : "(OpenStreetMap)"}
                </option>
                <option value="osm">OpenStreetMap (gratis)</option>
                <option value="google" disabled={!googleAvailable}>
                  Google Places {!googleAvailable ? "(butuh API key)" : ""}
                </option>
              </select>
            </div>
          </div>

          {/* Filter kontak */}
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={onlyWithContact}
              onChange={(e) => setOnlyWithContact(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 accent-brand-600"
            />
            Hanya tampilkan yang punya kontak (HP/WhatsApp)
          </label>

          {/* Submit */}
          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-60"
            >
              {loading ? "Mencari..." : "Cari vendor"}
            </button>
            {data && data.results.length > 0 && (
              <button
                type="button"
                onClick={downloadCSV}
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                ⬇ Export CSV ({data.results.length})
              </button>
            )}
          </div>
        </div>
      </form>

      {/* Error */}
      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Hasil */}
      {loading && (
        <div className="mt-8 text-center text-sm text-slate-500">Sedang mencari vendor...</div>
      )}

      {!loading && data && (
        <section className="mt-6">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-800">
              {data.count} vendor ditemukan
            </h2>
            <SourceBadge source={data.source} />
            <span className="text-xs text-slate-500">
              ({data.results.filter((v) => v.phone || v.whatsapp).length} punya kontak)
            </span>
          </div>

          {data.note && (
            <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
              ℹ️ {data.note}
            </p>
          )}

          {data.results.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
              Tidak ada vendor yang cocok. Coba kata kunci atau radius berbeda.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {data.results.map((v) => (
                <VendorCard key={v.id} v={v} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Footer / atribusi */}
      <footer className="mt-10 border-t border-slate-200 pt-4 text-xs text-slate-500">
        Data vendor dari OpenStreetMap (lisensi ODbL — atribusi wajib) dan/atau
        Google Places. Aplikasi untuk membantu riset kontak vendor; hormati
        ketentuan masing-masing sumber data.
      </footer>
    </main>
  );
}

function SourceBadge({ source }: { source: "osm" | "google" }) {
  return (
    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
      sumber: {source === "google" ? "Google Places" : "OpenStreetMap"}
    </span>
  );
}

function VendorCard({ v }: { v: VendorContact }) {
  const mapLink =
    v.source === "google"
      ? `https://www.google.com/maps/search/?api=1&query=${v.lat},${v.lon}`
      : `https://www.openstreetmap.org/?mlat=${v.lat}&mlon=${v.lon}#map=17/${v.lat}/${v.lon}`;

  return (
    <article className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-1 flex items-start justify-between gap-2">
        <h3 className="font-semibold leading-tight text-slate-900">{v.name}</h3>
        {v.distanceKm != null && (
          <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
            {v.distanceKm.toFixed(1)} km
          </span>
        )}
      </div>

      {v.category && (
        <span className="mb-2 inline-block w-fit rounded bg-slate-100 px-2 py-0.5 text-xs capitalize text-slate-600">
          {v.category}
        </span>
      )}

      {/* Kontak */}
      <div className="flex flex-wrap gap-2">
        {v.phone && (
          <a
            href={`tel:${v.phone}`}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            📞 {v.phone}
          </a>
        )}
        {v.whatsapp && (
          <a
            href={`https://wa.me/${v.whatsapp}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-lg border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-100"
          >
            💬 WhatsApp
          </a>
        )}
        {v.website && (
          <a
            href={v.website}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            🌐 Website
          </a>
        )}
        {v.email && (
          <a
            href={`mailto:${v.email}`}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            ✉️ Email
          </a>
        )}
      </div>

      {/* Alamat */}
      {v.address && (
        <p className="mt-2 text-sm text-slate-600">📍 {v.address}</p>
      )}

      <div className="mt-auto flex items-center gap-3 pt-2 text-xs">
        <a
          href={mapLink}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-brand-700 hover:underline"
        >
          Lihat di peta ↗
        </a>
        {v.rating != null && (
          <span className="text-amber-600">⭐ {v.rating.toFixed(1)}</span>
        )}
      </div>
    </article>
  );
}
