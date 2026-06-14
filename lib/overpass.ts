import { matchingRules } from "./categories";
import { buildAddressFromTags, escapeRegex, firstNumber, normalizePhoneId } from "./format";
import type { VendorContact } from "./types";

/**
 * Beberapa server publik Overpass. Kita RACE semuanya secara paralel:
 * endpoint pertama yang balik valid menang, sisanya di-abort. Ini menghindari
 * kasus "nunggu 45 detik di endpoint pertama yang ke-throttle".
 */
const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.osm.ch/api/interpreter",
];

const PER_ENDPOINT_TIMEOUT_MS = 20000;

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements?: OverpassElement[];
}

// ---------- Cache lokal (TTL 30 menit) ----------
const CACHE = new Map<string, { t: number; v: { results: VendorContact[]; truncated: boolean } }>();
const CACHE_TTL_MS = 30 * 60 * 1000;

function cacheKey(keyword: string, lat: number, lon: number, radiusKm: number): string {
  // Bundarkan koordinat ke ~1.1km agar cache lebih sering kena.
  return `${keyword.trim().toLowerCase()}|${lat.toFixed(2)},${lon.toFixed(2)}|${Math.round(radiusKm)}`;
}

// ---------- Pembangun query ----------
function radiusMeters(radiusKm: number): number {
  return Math.min(Math.max(Math.round(radiusKm * 1000), 1000), 100000);
}

// Kata umum yang tidak mempersempit hasil (dilewati saat tokenisasi nama).
const GENERIC_WORDS = new Set([
  "vendor", "jasa", "supplier", "penyedia", "agen", "distributor",
  "toko", "di", "dekat", "near", "dan", "atau", "the", "of", "for",
]);

/** Token signifikan dari keyword, untuk dicocokkan dengan nama POI. */
function nameTokens(keyword: string): string[] {
  return keyword
    .toLowerCase()
    .split(/[\s,./-]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !GENERIC_WORDS.has(t));
}

/**
 * Tag-tag OSM yang nilainya sering mendeskripsikan jenis bisnis.
 * Kita cari POI yang nilai tag-nya mengandung keyword (mis. shop=catering).
 */
const SEARCHABLE_TAG_KEYS = ["shop", "office", "amenity", "craft", "tourism", "leisure"];

/**
 * Satu query gabungan: cocokkan nama (token signifikan, di-OR) + nilai tag
 * + tag kategori spesifik. Tiga lapis pencarian ini memaksimalkan hasil OSM.
 *
 * Token pendek (<=3 char) pakai word-boundary agar tidak terlalu permisif
 * (mis. "wo" tidak nabrak "workshop").
 */
function buildQuery(keyword: string, lat: number, lon: number, rMeters: number): string {
  const around = "(around:" + rMeters + "," + lat + "," + lon + ")";
  const parts: string[] = [];
  const tokens = nameTokens(keyword);

  // ── Lapis 1: Cocokkan nama POI dengan token keyword ──────────────────────
  for (const tok of tokens) {
    const esc = escapeRegex(tok);
    const re = tok.length <= 3 ? "\\b" + esc + "\\b" : esc;
    parts.push('nwr["name"~"' + re + '",i]' + around);
  }

  // ── Lapis 2: Cocokkan NILAI tag (shop/office/amenity/craft/...) ──────────
  //    Menangkap bisnis yang di-tag shop=catering, office=caterer, dst.
  //    Hanya untuk token >= 4 karakter agar tidak terlalu lebar.
  for (const tok of tokens) {
    if (tok.length < 4) continue;
    const esc = escapeRegex(tok);
    for (const tagKey of SEARCHABLE_TAG_KEYS) {
      parts.push('nwr["' + tagKey + '"~"' + esc + '",i]' + around);
    }
  }

  // ── Lapis 3: Filter kategori spesifik dari CATEGORY_RULES ────────────────
  for (const f of [...new Set(matchingRules(keyword).flatMap((rule) => rule.filters))]) {
    parts.push("nwr" + f + around);
  }

  // Fallback: bila tidak ada token sama sekali, cari nama secara literal.
  if (parts.length === 0) {
    parts.push('nwr["name"~"' + escapeRegex(keyword.trim()) + '",i]' + around);
  }

  return "[out:json][timeout:18];(" + parts.map((p) => p + ";").join("") + ");out center tags 300;";
}

// ---------- Fetch dengan race antar endpoint ----------
async function fetchOne(ep: string, query: string, signal: AbortSignal): Promise<OverpassResponse> {
  const res = await fetch(ep, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "tool-contact-bisnis/1.0 (https://github.com/local)",
    },
    body: "data=" + encodeURIComponent(query),
    signal,
  });
  if (res.status === 429 || res.status >= 500) {
    throw new Error(`${ep} HTTP ${res.status}`);
  }
  if (!res.ok) throw new Error(`${ep} HTTP ${res.status}`);
  const json = (await res.json()) as OverpassResponse;
  if (!json || !Array.isArray(json.elements)) throw new Error(`${ep} format JSON aneh`);
  return json;
}

/**
 * Tembak SEMUA endpoint paralel. Tiap endpoint punya timeout sendiri, dan yang
 * menang adalah response pertama yang BERISI DATA (elements > 0) — bukan yang
 * tercepat. Mirror yang balik cepat tapi kosong (HTTP 200, elements:[]) dilewati
 * (disimpan sebagai cadangan kosong). Begitu ada pemenang ber-data, sisanya
 * di-abort. Baru bila semua kosong/gagal, kembalikan hasil kosong.
 */
function raceEndpoints(query: string): Promise<OverpassResponse> {
  return new Promise<OverpassResponse>((resolve) => {
    let pending = ENDPOINTS.length;
    let bestEmpty: OverpassResponse | null = null;
    const controllers = ENDPOINTS.map(() => new AbortController());
    const timers: ReturnType<typeof setTimeout>[] = [];

    const abortOthers = (winnerIdx: number) => {
      timers.forEach((t, idx) => {
        clearTimeout(t);
        if (idx !== winnerIdx) controllers[idx].abort();
      });
    };

    const finishEmpty = () => {
      abortOthers(-1);
      resolve(bestEmpty ?? { elements: [] });
    };

    ENDPOINTS.forEach((ep, i) => {
      timers[i] = setTimeout(() => controllers[i].abort(), PER_ENDPOINT_TIMEOUT_MS);
      fetchOne(ep, query, controllers[i].signal)
        .then((json) => {
          if ((json.elements?.length ?? 0) > 0) {
            abortOthers(i);
            resolve(json); // pemenang: punya data
          } else {
            if (!bestEmpty) bestEmpty = json;
            pending -= 1;
            if (pending <= 0) finishEmpty();
          }
        })
        .catch(() => {
          pending -= 1;
          if (pending <= 0) finishEmpty();
        });
    });
  });
}

// ---------- Normalisasi ----------
function normalizeWebsite(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const s = raw.trim();
  if (!s) return undefined;
  const lower = s.toLowerCase();
  if (lower.startsWith("http://") || lower.startsWith("https://")) return s;
  return "https://" + s;
}

function deriveCategory(keyword: string, tags: Record<string, string>): string | undefined {
  const rules = matchingRules(keyword);
  if (rules.length) return rules[0].label;
  const k = tags.office || tags.shop || tags.amenity || tags.craft || tags.tourism || tags.leisure;
  return k ? k.replace(/_/g, " ") : undefined;
}

function normalizeElement(el: OverpassElement, keyword: string): VendorContact | null {
  const tags = el.tags || {};
  const name = tags.name || tags.brand;
  if (!name) return null;

  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  if (lat == null || lon == null) return null;

  const phone = firstNumber(
    tags.phone || tags["contact:phone"] || tags.mobile || tags["contact:mobile"],
  );
  const waRaw = firstNumber(tags["contact:whatsapp"] || tags.whatsapp || tags["phone:whatsapp"]);
  const whatsapp = waRaw
    ? normalizePhoneId(waRaw)
    : phone
      ? normalizePhoneId(phone)
      : undefined;

  const { address, city, postcode } = buildAddressFromTags(tags);

  return {
    id: `${el.type}-${el.id}`,
    name,
    category: deriveCategory(keyword, tags),
    phone,
    whatsapp,
    email: tags.email || tags["contact:email"],
    website: normalizeWebsite(tags.website || tags["contact:website"] || tags.url),
    address,
    city,
    postcode,
    lat,
    lon,
    source: "osm",
  };
}

// ---------- Entrypoint ----------
export async function searchOverpass(
  keyword: string,
  lat: number,
  lon: number,
  radiusKm: number,
): Promise<{ results: VendorContact[]; truncated: boolean }> {
  const key = cacheKey(keyword, lat, lon, radiusKm);
  const cached = CACHE.get(key);
  if (cached && Date.now() - cached.t < CACHE_TTL_MS) {
    return { ...cached.v, results: cached.v.results };
  }

  const rMeters = radiusMeters(radiusKm);
  const query = buildQuery(keyword, lat, lon, rMeters);

  // Satu query, di-race antar endpoint (first-data-wins) -> cepat & andal.
  const resp = await raceEndpoints(query).catch(() => emptyResp);

  // Dedup by id.
  const seen = new Set<string>();
  const merged: OverpassElement[] = [];
  for (const el of resp.elements || []) {
    const idKey = `${el.type}-${el.id}`;
    if (seen.has(idKey)) continue;
    seen.add(idKey);
    merged.push(el);
  }

  const results = merged
    .map((el) => normalizeElement(el, keyword))
    .filter((v): v is VendorContact => v !== null);

  const out = { results, truncated: merged.length >= 300 };
  CACHE.set(key, { t: Date.now(), v: out });
  return { results: out.results, truncated: out.truncated };
}

const emptyResp: OverpassResponse = { elements: [] };
