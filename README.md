# Cari Vendor Bisnis 🔎

Web app sederhana untuk mencari **vendor bisnis** (mis. vendor WO / wedding organizer, catering, MUA, venue, toko bunga, toko kue, dll) lengkap dengan **nama, no HP, WhatsApp, alamat, website** di sekitar lokasi tertentu — dengan filter lokasi (kota / lokasi-saya / radius) dan **export CSV**.

Dibangun dengan **Next.js 14 (App Router) + TypeScript + Tailwind CSS**.

## Sumber data

| Sumber | Butuh key? | Biaya | Cakupan |
| --- | --- | --- | --- |
| **OpenStreetMap (Overpass)** | Tidak | Gratis (ODbL) | Bagus, tapi vendor spesifik kadang kurang lengkap; server publik kadang lambat |
| **Google Places** | Ya (`GOOGLE_MAPS_API_KEY`) | Berbayar per request | Paling lengkap & andal untuk vendor lokal Indonesia |

App pakai **OSM secara default** (jalan tanpa konfigurasi). Bila `GOOGLE_MAPS_API_KEY` diisi, Google Places otomatis tersedia & bisa dipilih di UI.

## Cara menjalankan

```bash
npm install
npm run dev
```

Buka http://localhost:3000.

(Opsional) aktifkan Google Places:

```bash
cp .env.example .env.local
# isi GOOGLE_MAPS_API_KEY=... (aktifkan "Places API" di Google Cloud)
npm run dev
```

## Cara pakai

1. Ketik kata kunci (mis. `vendor WO`, `wedding organizer`, `catering`).
2. Pilih lokasi: ketik kota **atau** klik **"Gunakan lokasi saya"**.
3. Atur **radius** (1–50 km) dan **urutan** (terdekat / nama).
4. Klik **Cari vendor** → hasil tampil dengan kontak (HP, WhatsApp, alamat, dll).
5. Klik **Export CSV** untuk mengunduh daftar lengkap (atribusi ODbL ikut untuk data OSM).

## Struktur

```
app/
  page.tsx              # UI (form, filter, hasil, export CSV)
  api/search/route.ts   # POST pencarian; GET konfigurasi (googleAvailable)
lib/
  overpass.ts           # query Overpass + RACE antar endpoint + cache lokal + normalisasi
  googlePlaces.ts       # Nearby Search + Place Details (opsional)
  geocode.ts            # Nominatim (alamat -> lat/lon)
  sources.ts            # pilih sumber, hitung jarak, dedup, sort, filter kontak, cap
  categories.ts         # keyword -> tag kategori (WO, catering, florist, ...)
  format.ts             # jarak, normalisasi HP->wa.me, alamat, CSV
  types.ts
```

## Performa & keandalan (OSM)

Agar hasil OSM cepat & tidak gampang kena throttle, app memakai beberapa strategi:

- **Race antar endpoint** — 5 server publik Overpass ditembak paralel; response pertama yang **berisi data** menang, sisanya di-abort. Mirror yang balik cepat tapi kosong dilewati. Tiap endpoint punya timeout sendiri (20s).
- **Cache lokal** — hasil pencarian di-cache 30 menit (key: keyword + koordinat ~1km + radius). Pencarian berulang instan, tidak membebani server.
- **Query cerdas** — keyword di-tokenisasi ("vendor WO" → cocokkan token `wo` dgn word-boundary, jadi menangkap nama seperti "WO Anggun") + di-padukan dengan tag kategori ter-indeks (mis. `shop=florist`) yang cepat.
- **Filter "hanya yang punya kontak"** — default aktif, fokus ke vendor yang ada HP/WhatsApp-nya.

## Catatan

- **ODbL:** data OpenStreetMap wajib atribusi — sudah disertakan di footer & file CSV.
- **Google Places:** tunduk ToS Google dan berbayar; key & biaya jadi tanggung jawab Anda.
- App **tidak** melakukan scraping halaman Google Maps langsung (rapuh & melanggar ToS) — memakai Places API resmi untuk jalur Google.
- Server publik Overpass menerapkan rate-limit per IP. Jika Anda meng-query sangat banyak/burst, semua endpoint bisa diblok sementara (HTTP 429/hang) dan app akan mengembalikan hasil kosong setelah timeout. Solusi: beri jeda antar pencarian, atau untuk beban berat self-host Overpass / pakai Google Places.

## Verifikasi cepat

```bash
npm run build          # validasi kompilasi TypeScript
curl -X POST http://localhost:3000/api/search \
  -H 'Content-Type: application/json' \
  -d '{"query":"wedding organizer","location":"Jakarta","radiusKm":15,"sort":"nearest","source":"osm"}'
```
