// Shared server code for /api/planes and /api/military.
// Files in api/ that start with "_" are not deployed as their own endpoints on Vercel.
// These functions only pass the community feed through (the feeds don't allow calls straight from a
// web page). Routes and aircraft details are looked up by the page itself, so each call stays short.

export const HOME = { lat: 39.1732, lon: -77.2717 };
const UA = 'plane-sight/1.0 (personal flight dashboard; github.com/joshdhill/flight-radar)';

// Three free community ADS-B feeds that use the same readsb/"v2" format.
// adsb.lol is first; the others are only used when it is slow, rate-limited or down.
const SOURCES = [
  { name: 'adsb.lol', point: (la, lo, r) => `https://api.adsb.lol/v2/point/${la}/${lo}/${r}`, mil: 'https://api.adsb.lol/v2/mil' },
  { name: 'airplanes.live', point: (la, lo, r) => `https://api.airplanes.live/v2/point/${la}/${lo}/${r}`, mil: 'https://api.airplanes.live/v2/mil' },
  { name: 'adsb.fi', point: (la, lo, r) => `https://opendata.adsb.fi/api/v2/lat/${la}/lon/${lo}/dist/${r}`, mil: 'https://opendata.adsb.fi/api/v2/mil' },
];

async function getJson(url, timeoutMs) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(timeoutMs) });
  const text = await res.text();
  if (!res.ok) throw new Error(`${new URL(url).host} answered ${res.status}`);
  if (!text.trim().startsWith('{')) throw new Error(`${new URL(url).host}: ${text.trim().slice(0, 60)}`); // e.g. "rate limit exceeded"
  return JSON.parse(text);
}

// Try each source in turn; the page retries on its own, so no second try here (keeps each call short).
export async function fetchFeed(kind, lat, lon, radius) {
  const errors = [];
  for (let i = 0; i < SOURCES.length; i++) {
    const s = SOURCES[i];
    const url = kind === 'mil' ? s.mil : s.point(lat, lon, radius);
    try {
      const j = await getJson(url, i === 0 ? 8000 : 6000);
      return { source: s.name, now: j.now || Date.now(), ac: j.ac || j.aircraft || [] };
    } catch (e) {
      errors.push(e.message);
    }
  }
  throw new Error(errors.join('; '));
}

/* ---------- military detection ---------- */
// 1) the aircraft database flag readsb/adsb.lol publish (dbFlags bit 1 = military)
// 2) the US military block of ICAO addresses (AE0000-AFFFFF)
// 3) well-known US military callsign prefixes
const MIL_CALLSIGNS = /^(RCH|SAM|PAT|CNV|SPAR|EXEC|AF[12]$|VENUS|NAVY|ARMY|USAF|KING|TEAL|EVAC|BLUE|JEDI|GOLD|SKULL|DUKE|IRON|HAWK)/;
export function militaryFlag(a) {
  if (a.dbFlags & 1) return 'db';
  const n = parseInt(a.hex || '', 16);
  if (n >= 0xae0000 && n <= 0xafffff) return 'hex';
  const cs = (a.flight || '').trim();
  if (cs && MIL_CALLSIGNS.test(cs)) return 'cs';
  return '';
}

/* ---------- distance ---------- */
const toRad = (d) => (d * Math.PI) / 180;
export function distanceNm(lat1, lon1, lat2, lon2) {
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * 3440.065 * Math.asin(Math.sqrt(h));
}

/* ---------- compact rows ---------- */
// [hex, callsign, reg, type, category, alt, gs, track, vs, lat, lon, ageSec, mil, route, squawk, posSource]
export function compactRow(a, route) {
  if (typeof a.lat !== 'number' || typeof a.lon !== 'number') return null;
  if (a.alt_baro === 'ground') return null;
  if ((a.category || '').startsWith('C')) return null; // ground vehicles
  const alt = typeof a.alt_baro === 'number' ? a.alt_baro : typeof a.alt_geom === 'number' ? a.alt_geom : null;
  if (alt === null) return null;
  if ((a.seen_pos ?? a.seen ?? 0) > 60) return null;
  return [
    a.hex, (a.flight || '').trim(), a.r || '', a.t || '', a.category || '', Math.round(alt),
    Math.round(a.gs || 0), Math.round(a.track ?? a.true_heading ?? 0), Math.round(a.baro_rate ?? a.geom_rate ?? 0),
    +a.lat.toFixed(5), +a.lon.toFixed(5), +(a.seen_pos ?? a.seen ?? 0).toFixed(1),
    militaryFlag(a), route || '', a.squawk || '', a.type || '',
  ];
}

/* ---------- helpers ---------- */
export function homeFrom(url) {
  const u = new URL(url);
  let lat = parseFloat(u.searchParams.get('lat')), lon = parseFloat(u.searchParams.get('lon'));
  // home can be anywhere; anything that isn't a valid position falls back to Germantown.
  // Two decimals (about half a mile) is plenty for a 30 nm search, and keeps the exact spot private.
  if (!Number.isFinite(lat) || Math.abs(lat) > 85 || !Number.isFinite(lon) || Math.abs(lon) > 180) { lat = HOME.lat; lon = HOME.lon; }
  return { lat: +lat.toFixed(2), lon: +lon.toFixed(2) };
}

// The CDN keeps each answer for a few seconds, so every screen with the same home shares one fetch.
// Pages move planes along between updates, so a few seconds of age doesn't show.
export function json(body, { status = 200, sMaxAge = 8 } = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // browsers always ask again (max-age=0); the CDN answers repeat asks for a few seconds
      'cache-control': `public, max-age=0, s-maxage=${sMaxAge}`,
    },
  });
}
