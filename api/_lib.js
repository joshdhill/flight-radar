// Shared server code for /api/planes and /api/military.
// Files in api/ that start with "_" are not deployed as their own endpoints on Vercel.

export const HOME = { lat: 39.1732, lon: -77.2717 };
const UA = 'plane-sight/1.0 (personal flight dashboard; github.com/joshdhill/flight-radar)';

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

/* ---------- routes (cached per callsign, checked against where the plane is) ---------- */
// A callsign can fly several legs a day, and route databases are sometimes out of date,
// so a route is only shown when the plane's current position lies along it.
const routeCache = new Map(); // callsign -> { at, legs: [[codeA, latA, lonA, codeB, latB, lonB], ...] }
const ROUTE_HIT_MS = 6 * 3600e3, ROUTE_MISS_MS = 3600e3;
export function looksLikeAirline(cs) { return /^[A-Z]{3}[0-9][0-9A-Z]{0,4}$/.test(cs || '') && !MIL_CALLSIGNS.test(cs); }
const R_NM = 3440.065;
function angDist(lat1, lon1, lat2, lon2) { return distanceNm(lat1, lon1, lat2, lon2) / R_NM; }
function bearingRad(lat1, lon1, lat2, lon2) {
  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
  return Math.atan2(y, x);
}
// Is (lat, lon) near the great-circle leg from A to B?
export function onLeg(lat, lon, leg) {
  const [, aLat, aLon, , bLat, bLon] = leg;
  if (![aLat, aLon, bLat, bLon].every(Number.isFinite)) return false;
  if (distanceNm(lat, lon, aLat, aLon) < 60 || distanceNm(lat, lon, bLat, bLon) < 60) return true;
  const d13 = angDist(aLat, aLon, lat, lon), d12 = angDist(aLat, aLon, bLat, bLon);
  const delta = bearingRad(aLat, aLon, lat, lon) - bearingRad(aLat, aLon, bLat, bLon);
  const xt = Math.asin(Math.sin(d13) * Math.sin(delta));
  const at = Math.acos(Math.max(-1, Math.min(1, Math.cos(d13) / Math.cos(xt)))) * (Math.cos(delta) < 0 ? -1 : 1);
  return Math.abs(xt) * R_NM < 150 && at * R_NM > -60 && at * R_NM < d12 * R_NM + 60;
}
function fresh(c, now) { return c && now - c.at < (c.legs.length ? ROUTE_HIT_MS : ROUTE_MISS_MS); }

async function lookupAdsbdb(cs) {
  try {
    const j = await getJson(`https://api.adsbdb.com/v0/callsign/${encodeURIComponent(cs)}`, 4000);
    const f = j.response && j.response.flightroute, o = f && f.origin, d = f && f.destination;
    const legs = o && d ? [[o.iata_code || o.icao_code, o.latitude, o.longitude, d.iata_code || d.icao_code, d.latitude, d.longitude]] : [];
    routeCache.set(cs, { at: Date.now(), legs });
  } catch {
    routeCache.set(cs, { at: Date.now(), legs: [] });
  }
}

// One batch request to adsb.lol's route service for every airline callsign we don't know yet.
async function routesetBatch(planes) {
  const res = await fetch('https://api.adsb.lol/api/0/routeset', {
    method: 'POST',
    headers: { 'User-Agent': UA, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ planes: planes.slice(0, 100).map((p) => ({ callsign: p.cs, lat: p.lat, lng: p.lon })) }),
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) return;
  const list = await res.json();
  const now = Date.now();
  for (const x of Array.isArray(list) ? list : []) {
    const ap = Array.isArray(x._airports) ? x._airports : [];
    if (!x.airport_codes || x.airport_codes === 'unknown' || ap.length < 2) continue;
    const legs = [];
    for (let i = 0; i + 1 < ap.length; i++) {
      const a = ap[i], b = ap[i + 1];
      legs.push([a.iata || a.icao, +a.lat, +a.lon, b.iata || b.icao, +b.lat, +b.lon]);
    }
    routeCache.set(x.callsign, { at: now, legs });
  }
}

// planes: [{ cs, lat, lon }] -> { callsign: "IAD-ORD" } for routes that fit the plane's position
export async function routesFor(planes, maxAdsbdb = 6) {
  const now = Date.now();
  const need = planes.filter((p) => looksLikeAirline(p.cs) && !fresh(routeCache.get(p.cs), now));
  if (need.length) {
    try { await routesetBatch(need); } catch { /* fall through to adsbdb */ }
    const rest = need.filter((p) => !fresh(routeCache.get(p.cs), now)).slice(0, maxAdsbdb);
    await Promise.all(rest.map((p) => lookupAdsbdb(p.cs)));
  }
  const out = {};
  for (const p of planes) {
    const c = routeCache.get(p.cs);
    const leg = c && c.legs.find((l) => onLeg(p.lat, p.lon, l));
    if (leg) out[p.cs] = `${leg[0]}-${leg[3]}`;
  }
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
