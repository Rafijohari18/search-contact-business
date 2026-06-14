export type VendorSource = "osm" | "google";

export type SortMode = "nearest" | "name";

export type SourceChoice = "osm" | "google" | "auto";

/** Satu hasil vendor dengan kontak yang dibutuhkan bisnis. */
export interface VendorContact {
  id: string;
  name: string;
  category?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  website?: string;
  address?: string;
  city?: string;
  postcode?: string;
  lat: number;
  lon: number;
  distanceKm?: number;
  rating?: number;
  source: VendorSource;
}

export interface SearchParams {
  query: string;
  /** Alamat/kota bebas teks -> akan di-geocode. */
  location?: string;
  /** Bila ada, dipakai langsung (mis. dari browser geolocation). */
  lat?: number;
  lon?: number;
  radiusKm: number;
  sort: SortMode;
  source: SourceChoice;
  /** Sembunyikan hasil tanpa HP/WhatsApp. */
  onlyWithContact?: boolean;
}

export interface LatLng {
  lat: number;
  lon: number;
  label?: string;
}

export interface SearchResponse {
  results: VendorContact[];
  center?: LatLng;
  count: number;
  source: VendorSource;
  note?: string;
}
