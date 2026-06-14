/**
 * Pemetaan kata kunci -> tag OpenStreetMap + label kategori.
 * Memperluas jangkauan hasil: selain cocokkan nama (name~KW), kita juga
 * ambil POI ber-tag kategori yang relevan meski namanya tidak mengandung keyword.
 *
 * Filter disesuaikan untuk data OSM Indonesia yang lebih lengkap.
 */
export interface CategoryRule {
  match: RegExp;
  label: string;
  /** Fragment filter Overpass, mis. '["office"="wedding_planner"]'. */
  filters: string[];
}

export const CATEGORY_RULES: CategoryRule[] = [
  {
    match: /wedding|\bwo\b|organizer|organiser|wedding planner/i,
    label: "Wedding Organizer",
    filters: [
      '["office"="wedding_planner"]',
      '["office"="event_management"]',
      '["shop"="wedding"]',
      '["amenity"="events_venue"]',
    ],
  },
  {
    match: /catering|katering|jasa boga/i,
    label: "Catering",
    filters: [
      '["office"="caterer"]',
      '["shop"="caterer"]',
      '["catering"="yes"]',
      '["amenity"="restaurant"]',
      '["cuisine"="catering"]',
    ],
  },
  {
    match: /florist|toko bunga|dekorasi bunga/i,
    label: "Florist",
    filters: [
      '["shop"="florist"]',
      '["shop"="flowers"]',
      '["amenity"="florist"]',
    ],
  },
  {
    match: /salon|bridal|make ?up|\bmua\b|rias pengantin|rias/i,
    label: "Salon / Bridal / MUA",
    filters: [
      '["shop"="hairdresser"]',
      '["shop"="beauty"]',
      '["amenity"="beauty"]',
      '["shop"="cosmetics"]',
      '["shop"="bridal"]',
      '["craft"="beauty_treatment"]',
    ],
  },
  {
    match: /photo|foto|videografi|videographer/i,
    label: "Photo / Video",
    filters: [
      '["craft"="photographer"]',
      '["office"="photographer"]',
      '["shop"="photography"]',
      '["shop"="photo"]',
    ],
  },
  {
    match: /venue|gedung|aula|ballroom|\bhall\b|ball room|balai/i,
    label: "Venue / Gedung",
    filters: [
      '["amenity"="events_venue"]',
      '["amenity"="conference_centre"]',
      '["amenity"="banquet_hall"]',
      '["leisure"="sports_centre"]',
      '["tourism"="hotel"]',
      '["building"="civic"]',
    ],
  },
  {
    match: /bakery|toko kue|\bkue\b|roti|patiseri|pastry/i,
    label: "Bakery / Toko Kue",
    filters: [
      '["shop"="bakery"]',
      '["shop"="pastry"]',
      '["shop"="cake"]',
      '["amenity"="bakery"]',
    ],
  },
  {
    match: /dress|gaun|baju|tailor|penjahit|seamstress/i,
    label: "Dress / Tailor",
    filters: [
      '["shop"="clothes"]',
      '["craft"="tailor"]',
      '["shop"="tailor"]',
      '["shop"="wedding"]',
    ],
  },
  {
    match: /dekor|dekorasi|decoration|ornament/i,
    label: "Decoration",
    filters: [
      '["shop"="party"]',
      '["craft"="decorator"]',
      '["shop"="florist"]',
    ],
  },
  {
    match: /\bmc\b|master of ceremony|pembawa acara/i,
    label: "MC",
    filters: [],
  },
  {
    match: /entertainment|music|band|sound system|soundsystem|dj\b/i,
    label: "Entertainment / Sound",
    filters: [
      '["amenity"="music_venue"]',
      '["shop"="music"]',
      '["craft"="sound_engineer"]',
    ],
  },
  {
    match: /undangan|invitation|cetak|printing|percetakan/i,
    label: "Undangan / Cetak",
    filters: [
      '["shop"="copyshop"]',
      '["craft"="printer"]',
      '["shop"="stationery"]',
    ],
  },
  {
    match: /souvenir|hampers|hadiah|gift/i,
    label: "Souvenir / Gift",
    filters: [
      '["shop"="gift"]',
      '["shop"="souvenir"]',
      '["shop"="toys"]',
    ],
  },
  {
    match: /hotel|penginapan|villa|resort/i,
    label: "Hotel / Penginapan",
    filters: [
      '["tourism"="hotel"]',
      '["tourism"="motel"]',
      '["tourism"="guest_house"]',
      '["tourism"="hostel"]',
      '["tourism"="villa"]',
      '["tourism"="resort"]',
    ],
  },
  {
    match: /gedung pernikahan|balai|convention/i,
    label: "Gedung Pernikahan",
    filters: [
      '["amenity"="events_venue"]',
      '["amenity"="banquet_hall"]',
      '["amenity"="conference_centre"]',
    ],
  },
];

/** Aturan yang cocok dengan keyword user (untuk menambah union tag kategori). */
export function matchingRules(keyword: string): CategoryRule[] {
  return CATEGORY_RULES.filter((r) => r.match.test(keyword));
}
