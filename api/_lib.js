// Shared server code for /api/planes and /api/military.
// Files in api/ that start with "_" are not deployed as their own endpoints on Vercel.

export const HOME = { lat: 39.1732, lon: -77.2717 };
const UA = 'over-germantown/1.0 (personal flight dashboard; github.com/joshdhill/flight-radar)';

// Three free community ADS-B feeds that use the same readsb/"v2" format.
// adsb.lol is first; the others are only used when it is slow, rate-limited or down.
const SOURCES = [
  { name: 'adsb.lol', point: (la, lo, r) => `https://api.adsb.lol/v2/point/${la}/${lo}/${r}`, mil: 'https://api.adsb.lol/v2/mil' },
  { name: 'airplanes.live', point: (la, lo, r) => `https://api.airplanes.live/v2/point/${la}/${lo}/${r}`, mil: 'https://api.airplanes.live/v2/mil' },
  { name: 'adsb.fi', point: (la, lo, r) => `https://opendata.adsb.fi/api/v2/lat/${la}/lon/${lo}/dist/${r}`, mil: 'https://opendata.adsb.fi/api/v2/mil' },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url, timeoutMs) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(timeoutMs) });
  const text = await res.text();
  if (!res.ok) throw new Error(`${new URL(url).host} answered ${res.status}`);
  if (!text.trim().startsWith('{')) throw new Error(`${new URL(url).host}: ${text.trim().slice(0, 60)}`); // e.g. "rate limit exceeded"
  return JSON.parse(text);
}

// Try each source in turn. adsb.lol gets one retry because it is occasionally slow.
export async function fetchFeed(kind, lat, lon, radius) {
  const errors = [];
  for (let i = 0; i < SOURCES.length; i++) {
    const s = SOURCES[i];
    const url = kind === 'mil' ? s.mil : s.point(lat, lon, radius);
    const tries = i === 0 ? 2 : 1;
    for (let t = 0; t < tries; t++) {
      try {
        const j = await getJson(url, i === 0 ? 12000 : 8000);
        return { source: s.name, now: j.now || Date.now(), ac: j.ac || j.aircraft || [] };
      } catch (e) {
        errors.push(e.message);
        if (t + 1 < tries) await sleep(1200);
      }
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

/* ---------- routes from adsbdb (cached, a few new lookups per request) ---------- */
const routeCache = new Map(); // callsign -> { at, route }
const ROUTE_HIT_MS = 6 * 3600e3, ROUTE_MISS_MS = 3600e3;
export function looksLikeAirline(cs) { return /^[A-Z]{3}[0-9][0-9A-Z]{0,4}$/.test(cs || '') && !MIL_CALLSIGNS.test(cs); }

async function lookupRoute(cs) {
  try {
    const j = await getJson(`https://api.adsbdb.com/v0/callsign/${encodeURIComponent(cs)}`, 4000);
    const f = j.response && j.response.flightroute;
    const o = f && f.origin, d = f && f.destination;
    const route = o && d ? `${o.iata_code || o.icao_code}-${d.iata_code || d.icao_code}` : '';
    routeCache.set(cs, { at: Date.now(), route });
  } catch {
    routeCache.set(cs, { at: Date.now(), route: '' });
  }
}

export async function routesFor(callsigns, maxNew = 8) {
  const now = Date.now(), todo = [];
  for (const cs of callsigns) {
    if (!looksLikeAirline(cs)) continue;
    const c = routeCache.get(cs);
    if (c && now - c.at < (c.route ? ROUTE_HIT_MS : ROUTE_MISS_MS)) continue;
    if (todo.length < maxNew) todo.push(cs);
  }
  await Promise.all(todo.map(lookupRoute));
  const out = {};
  for (const cs of callsigns) { const c = routeCache.get(cs); if (c && c.route) out[cs] = c.route; }
  return out;
}

/* ---------- helpers ---------- */
export function homeFrom(url) {
  const u = new URL(url);
  let lat = parseFloat(u.searchParams.get('lat')), lon = parseFloat(u.searchParams.get('lon'));
  // stay near Germantown so this endpoint can't be used as an open proxy for anywhere
  if (!Number.isFinite(lat) || Math.abs(lat - HOME.lat) > 0.5) lat = HOME.lat;
  if (!Number.isFinite(lon) || Math.abs(lon - HOME.lon) > 0.6) lon = HOME.lon;
  return { lat: +lat.toFixed(3), lon: +lon.toFixed(3) };
}

export function json(body, { status = 200, sMaxAge = 5 } = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // Short CDN cache so several screens share one fetch, without serving old positions.
      'cache-control': `public, s-maxage=${sMaxAge}, stale-while-revalidate=${Math.min(sMaxAge, 10)}`,
    },
  });
}
